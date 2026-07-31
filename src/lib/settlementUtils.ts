import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Expense, ExpenseSettlement, Member } from '../types';

export interface Transaction {
  id: string;
  from: string; // debtorId
  to: string; // creditorId
  amount: number;
  currency: string;
}

export interface NetTransfer {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
  currency?: string;
}

export function calculateExpenseTransactions(exp: Expense): Transaction[] {
  if (!exp.participants || exp.participants.length === 0) return [];
  const equalShare = exp.totalAmount / exp.participants.length;
  const balances: Record<string, number> = {};

  // Add paid amounts
  for (const [payer, amt] of Object.entries(exp.paidBy || {})) {
    balances[payer] = (balances[payer] || 0) + Number(amt || 0);
  }

  // Subtract equal share for participants
  exp.participants.forEach(p => {
    balances[p] = (balances[p] || 0) - equalShare;
  });

  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  Object.entries(balances).forEach(([memberId, amt]) => {
    if (amt < -0.01) debtors.push({ id: memberId, amount: Math.abs(amt) });
    else if (amt > 0.01) creditors.push({ id: memberId, amount: amt });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const txs: Transaction[] = [];
  let d = 0;
  let c = 0;

  const dCopy = debtors.map(x => ({ ...x }));
  const cCopy = creditors.map(x => ({ ...x }));

  while (d < dCopy.length && c < cCopy.length) {
    const amt = Math.min(dCopy[d].amount, cCopy[c].amount);
    if (amt > 0.01) {
      const fixedAmt = Number(amt.toFixed(2));
      txs.push({
        id: `${dCopy[d].id}_${cCopy[c].id}_${fixedAmt}`,
        from: dCopy[d].id,
        to: cCopy[c].id,
        amount: fixedAmt,
        currency: exp.currency || 'Taka',
      });
      dCopy[d].amount -= amt;
      cCopy[c].amount -= amt;
    }
    if (dCopy[d].amount < 0.01) d++;
    if (cCopy[c].amount < 0.01) c++;
  }

  return txs;
}

export function isTransactionSettled(exp: Expense, tx: Transaction): boolean {
  if (!exp.settlements || exp.settlements.length === 0) return false;
  return exp.settlements.some(
    s => s.debtorId === tx.from && s.creditorId === tx.to && Math.abs(s.amount - tx.amount) < 0.02
  );
}

export function calculateExpenseSettlementSummary(exp: Expense): { totalOwed: number; totalSettled: number } {
  const txs = calculateExpenseTransactions(exp);
  let totalOwed = 0;
  let totalSettled = 0;

  if (txs.length === 0) {
    if (exp.status === 'Fully Settled') {
      return { totalOwed: 0, totalSettled: exp.totalAmount };
    }
    return { totalOwed: exp.totalAmount, totalSettled: 0 };
  }

  txs.forEach(tx => {
    if (isTransactionSettled(exp, tx)) {
      totalSettled += tx.amount;
    } else {
      totalOwed += tx.amount;
    }
  });

  return { totalOwed, totalSettled };
}

export function getExpenseStatus(exp: Expense): 'Unsettled' | 'Partially Settled' | 'Fully Settled' {
  const txs = calculateExpenseTransactions(exp);

  if (txs.length === 0) {
    return exp.status || 'Unsettled';
  }

  // If settlements array is explicitly present on the object
  if (Array.isArray(exp.settlements)) {
    const settledCount = txs.filter(tx => isTransactionSettled(exp, tx)).length;
    if (settledCount >= txs.length && txs.length > 0) return 'Fully Settled';
    if (settledCount > 0) return 'Partially Settled';
    return 'Unsettled';
  }

  // Fallback for legacy items where settlements field is undefined
  if (exp.status === 'Fully Settled') return 'Fully Settled';
  if (exp.status === 'Partially Settled') return 'Partially Settled';

  return 'Unsettled';
}

export async function settleSingleTransaction(
  exp: Expense,
  tx: Transaction,
  settledById: string
) {
  const now = Date.now();
  const batchId = `batch_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const newSettlement: ExpenseSettlement = {
    id: `${tx.from}_${tx.to}_${now}`,
    debtorId: tx.from,
    creditorId: tx.to,
    amount: tx.amount,
    currency: tx.currency,
    settledAt: now,
    settledById: settledById || 'unknown',
    batchId,
  };

  const existingSettlements = exp.settlements || [];
  const updatedSettlements = [...existingSettlements, newSettlement];

  const txs = calculateExpenseTransactions(exp);
  const isNowFullySettled = txs.every(t => 
    updatedSettlements.some(s => s.debtorId === t.from && s.creditorId === t.to && Math.abs(s.amount - t.amount) < 0.02)
  );

  const newStatus = isNowFullySettled ? 'Fully Settled' : 'Partially Settled';

  const updateData: any = {
    settlements: updatedSettlements,
    status: newStatus,
    updatedAt: now,
  };

  if (isNowFullySettled) {
    updateData.settledAt = now;
    updateData.settledById = settledById || 'unknown';
  }

  await updateDoc(doc(db, 'expenses', exp.id), updateData);
}

export async function settleExpenseAllRemaining(
  exp: Expense,
  settledById: string
) {
  const now = Date.now();
  const batchId = `batch_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const txs = calculateExpenseTransactions(exp);
  const existingSettlements = exp.settlements || [];

  const newSettlements: ExpenseSettlement[] = [];

  txs.forEach(tx => {
    const alreadySettled = existingSettlements.some(
      s => s.debtorId === tx.from && s.creditorId === tx.to && Math.abs(s.amount - tx.amount) < 0.02
    );
    if (!alreadySettled) {
      newSettlements.push({
        id: `${tx.from}_${tx.to}_${now}_${Math.random().toString(36).substring(2, 5)}`,
        debtorId: tx.from,
        creditorId: tx.to,
        amount: tx.amount,
        currency: tx.currency,
        settledAt: now,
        settledById: settledById || 'unknown',
        batchId,
      });
    }
  });

  const updatedSettlements = [...existingSettlements, ...newSettlements];

  await updateDoc(doc(db, 'expenses', exp.id), {
    settlements: updatedSettlements,
    status: 'Fully Settled',
    settledAt: now,
    settledById: settledById || 'unknown',
    updatedAt: now,
  });
}

export async function undoExpenseFullSettlement(exp: Expense) {
  const settlements = exp.settlements || [];
  if (settlements.length === 0) {
    await updateDoc(doc(db, 'expenses', exp.id), {
      settlements: [],
      status: 'Unsettled',
      settledAt: null,
      settledById: null,
      updatedAt: Date.now(),
    });
    return;
  }

  // Identify the latest batchId or the latest settledAt timestamp
  const latestSettlementTime = Math.max(...settlements.map(s => s.settledAt || 0));
  const latestSettlements = settlements.filter(s => (s.settledAt || 0) === latestSettlementTime);
  const latestBatchId = latestSettlements[0]?.batchId;

  let remainingSettlements: ExpenseSettlement[] = [];
  if (latestBatchId) {
    remainingSettlements = settlements.filter(s => s.batchId !== latestBatchId);
  } else {
    remainingSettlements = settlements.filter(s => (s.settledAt || 0) !== latestSettlementTime);
  }

  const txs = calculateExpenseTransactions(exp);
  const settledCount = txs.filter(tx => 
    remainingSettlements.some(s => s.debtorId === tx.from && s.creditorId === tx.to && Math.abs(s.amount - tx.amount) < 0.02)
  ).length;

  let newStatus: 'Unsettled' | 'Partially Settled' = 'Unsettled';
  if (remainingSettlements.length > 0 && settledCount > 0 && settledCount < txs.length) {
    newStatus = 'Partially Settled';
  } else {
    // If no partial transactions remain or if remaining would still be fully settled, clear settlements to revert to Unsettled
    newStatus = 'Unsettled';
    remainingSettlements = [];
  }

  await updateDoc(doc(db, 'expenses', exp.id), {
    settlements: remainingSettlements,
    status: newStatus,
    settledAt: null,
    settledById: null,
    updatedAt: Date.now(),
  });
}

export async function undoSingleTransactionSettlement(exp: Expense, tx: Transaction) {
  const existingSettlements = exp.settlements || [];
  const index = existingSettlements.findIndex(
    s => s.debtorId === tx.from && s.creditorId === tx.to && Math.abs(s.amount - tx.amount) < 0.02
  );

  if (index === -1) return;

  const updatedSettlements = [...existingSettlements];
  updatedSettlements.splice(index, 1);

  const txs = calculateExpenseTransactions(exp);
  const remainingSettledCount = txs.filter(t => 
    updatedSettlements.some(s => s.debtorId === t.from && s.creditorId === t.to && Math.abs(s.amount - t.amount) < 0.02)
  ).length;

  let newStatus: 'Unsettled' | 'Partially Settled' | 'Fully Settled' = 'Unsettled';
  if (updatedSettlements.length > 0 && remainingSettledCount > 0) {
    if (remainingSettledCount >= txs.length) {
      newStatus = 'Fully Settled';
    } else {
      newStatus = 'Partially Settled';
    }
  }

  const updateData: any = {
    settlements: updatedSettlements,
    status: newStatus,
    updatedAt: Date.now(),
  };

  if (newStatus !== 'Fully Settled') {
    updateData.settledAt = null;
    updateData.settledById = null;
  }

  await updateDoc(doc(db, 'expenses', exp.id), updateData);
}

/**
 * Calculates simplified net transfers across all provided expenses using a greedy algorithm.
 */
export function calculateNetTransfers(expenses: Expense[], members: Member[]): NetTransfer[] {
  const balances: Record<string, number> = {};

  // Initialize balances for all members
  members.forEach(m => {
    balances[m.id] = 0;
  });

  // Aggregate net balance across all provided expenses
  expenses.forEach(exp => {
    const totalAmount = exp.totalAmount || 0;
    const participants = exp.participants || [];
    const sharePerPerson = participants.length > 0 ? totalAmount / participants.length : 0;

    // Add paid amounts (creditors)
    if (exp.paidBy) {
      Object.entries(exp.paidBy).forEach(([payerId, amount]) => {
        balances[payerId] = (balances[payerId] || 0) + Number(amount || 0);
      });
    }

    // Subtract owed amounts (debtors)
    participants.forEach(participantId => {
      balances[participantId] = (balances[participantId] || 0) - sharePerPerson;
    });
  });

  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || id;

  const debtors: { id: string; name: string; amount: number }[] = [];
  const creditors: { id: string; name: string; amount: number }[] = [];

  Object.entries(balances).forEach(([id, netAmount]) => {
    const rounded = Math.round(netAmount * 100) / 100;
    if (rounded < -0.01) {
      debtors.push({ id, name: getMemberName(id), amount: Math.abs(rounded) });
    } else if (rounded > 0.01) {
      creditors.push({ id, name: getMemberName(id), amount: rounded });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers: NetTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settlementAmount = Math.min(debtor.amount, creditor.amount);

    if (settlementAmount > 0.01) {
      const fixedAmt = Math.round(settlementAmount * 100) / 100;
      transfers.push({
        from: debtor.id,
        fromName: debtor.name,
        to: creditor.id,
        toName: creditor.name,
        amount: fixedAmt,
        currency: expenses[0]?.currency || 'Taka',
      });
    }

    debtor.amount -= settlementAmount;
    creditor.amount -= settlementAmount;

    if (debtor.amount <= 0.01) i++;
    if (creditor.amount <= 0.01) j++;
  }

  return transfers;
}
