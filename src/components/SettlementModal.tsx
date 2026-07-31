import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Expense } from '../types';
import { X } from 'lucide-react';
import { settleExpenseAllRemaining } from '../lib/settlementUtils';

interface SettlementModalProps {
  selectedExpenseIds: string[];
  onClose: () => void;
}

export default function SettlementModal({ selectedExpenseIds, onClose }: SettlementModalProps) {
  const { activeSpaceId, members, activeIdentityId, user } = useAppContext();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!activeSpaceId || selectedExpenseIds.length === 0) return;
      
      const exps: Expense[] = [];
      for (const id of selectedExpenseIds) {
        const docSnap = await getDoc(doc(db, 'expenses', id));
        if (docSnap.exists()) {
          exps.push({ id: docSnap.id, ...docSnap.data() } as Expense);
        }
      }
      setExpenses(exps);
      setLoading(false);
    };
    fetchData();
  }, [activeSpaceId, selectedExpenseIds]);

  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || 'Unknown';

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const netBalances: Record<string, Record<string, number>> = {};
  let totalCalculated = 0;

  expenses.forEach(exp => {
    if (!netBalances[exp.currency]) netBalances[exp.currency] = {};
    const equalShare = exp.totalAmount / exp.participants.length;
    
    Object.entries(exp.paidBy).forEach(([payer, amtValue]) => {
      const amt = amtValue as number;
      netBalances[exp.currency][payer] = (netBalances[exp.currency][payer] || 0) + amt;
      totalCalculated += amt;
    });
    
    exp.participants.forEach(p => {
      netBalances[exp.currency][p] = (netBalances[exp.currency][p] || 0) - equalShare;
    });
  });

  expenses.forEach(exp => {
    (exp.settlements || []).forEach(s => {
      const cur = s.currency || exp.currency;
      if (!netBalances[cur]) netBalances[cur] = {};
      netBalances[cur][s.debtorId] = (netBalances[cur][s.debtorId] || 0) + s.amount;
      netBalances[cur][s.creditorId] = (netBalances[cur][s.creditorId] || 0) - s.amount;
    });
  });

  const transactions: { currency: string, from: string, to: string, amount: number }[] = [];
  
  Object.keys(netBalances).forEach(currency => {
    const debtors: { id: string, amount: number }[] = [];
    const creditors: { id: string, amount: number }[] = [];
    
    Object.entries(netBalances[currency]).forEach(([m, amt]) => {
      if (amt < -0.01) debtors.push({ id: m, amount: Math.abs(amt) });
      else if (amt > 0.01) creditors.push({ id: m, amount: amt });
    });

    debtors.sort((a,b) => b.amount - a.amount);
    creditors.sort((a,b) => b.amount - a.amount);

    let d = 0;
    let c = 0;
    while (d < debtors.length && c < creditors.length) {
      const amount = Math.min(debtors[d].amount, creditors[c].amount);
      if (amount > 0.01) {
        transactions.push({ currency, from: debtors[d].id, to: creditors[c].id, amount });
        debtors[d].amount -= amount;
        creditors[c].amount -= amount;
      }
      if (debtors[d].amount < 0.01) d++;
      if (creditors[c].amount < 0.01) c++;
    }
  });

  const handleConfirm = async () => {
    setSettling(true);
    try {
      for (const exp of expenses) {
        await settleExpenseAllRemaining(exp, activeIdentityId || 'system');
      }

      const currentMember = members.find(m => m.id === activeIdentityId);
      const actorName = currentMember?.name || user?.displayName || 'Someone';

      const notificationMessage = selectedExpenseIds.length === 1 
        ? `completed settlement for expense "${expenses[0]?.title || 'Unknown'}"`
        : `completed settlement for ${selectedExpenseIds.length} expense(s)`;

      await addDoc(collection(db, 'notifications'), {
        spaceId: activeSpaceId,
        type: 'settlement_completed',
        actorName,
        message: notificationMessage,
        timestamp: Date.now()
      });

      onClose();
    } catch (e) {
      console.error(e);
      alert('Error settling');
    } finally {
      setSettling(false);
    }
  };

  const currencySymbol = (cur: string) => cur === 'Taka' ? '৳' : cur === 'INR' ? '₹' : '$';
  const isSingle = selectedExpenseIds.length === 1;

  const renderSingleSummary = () => {
    if (!isSingle) return null;
    const exp = expenses[0];
    if (!exp) return null;
    const curSym = currencySymbol(exp.currency);
    const equalShare = exp.totalAmount / exp.participants.length;
    const currencyNet = netBalances[exp.currency] || {};

    return (
      <div className="p-3.5 glass rounded-2xl space-y-2.5">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-1">Total Paid</h3>
          {Object.entries(exp.paidBy).map(([payer, amtValue]) => (
            <div key={payer} className="flex justify-between items-center text-xs">
              <span className="font-medium">{getMemberName(payer)}</span>
              <span className="font-bold">{curSym}{amtValue as number}</span>
            </div>
          ))}
        </div>
        
        <div className="pt-2 border-t border-white/10">
          <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-0.5">Equal Share</h3>
          <p className="text-xs font-medium">{curSym}{equalShare.toFixed(2)} per participant</p>
        </div>

        <div className="pt-2 border-t border-white/10">
          <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-1">Recoverable</h3>
          {exp.participants.map(p => {
            const bal = currencyNet[p] || 0;
            if (bal > 0.01) {
              return (
                <div key={p} className="flex justify-between items-center text-xs">
                  <span className="font-medium">{getMemberName(p)} receives {curSym}{bal.toFixed(2)}</span>
                </div>
              );
            } else if (bal < -0.01) {
              return (
                <div key={p} className="flex justify-between items-center text-xs">
                  <span className="font-medium opacity-70">{getMemberName(p)} owes {curSym}{Math.abs(bal).toFixed(2)}</span>
                </div>
              );
            } else {
              return (
                <div key={p} className="flex justify-between items-center text-xs">
                  <span className="font-medium opacity-50">{getMemberName(p)} is settled</span>
                </div>
              );
            }
          })}
        </div>
      </div>
    );
  };

  const renderMultiSummary = () => {
    if (isSingle) return null;
    return (
      <div className="p-3.5 glass rounded-2xl space-y-2.5">
        <p className="text-xs font-medium leading-relaxed">
          Please verify the settlement breakdown of each selected expense from the Settlement page before confirming.
        </p>
        <div className="pt-2 border-t border-white/10">
          <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-1">Selected Expenses</h3>
          <ul className="list-disc pl-4 space-y-0.5">
            {expenses.map(e => (
              <li key={e.id} className="text-xs font-bold">{e.title}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div className="glass-panel w-full max-w-sm rounded-3xl overflow-hidden flex flex-col max-h-[92vh] border border-white/20 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 overflow-y-auto space-y-3">
          <div className="flex justify-between items-center pb-1 border-b border-white/10">
            <h2 className="text-base font-bold tracking-tight">
              {isSingle ? 'Expense Settlement' : `Settle (${expenses.length}) Expenses`}
            </h2>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {isSingle ? renderSingleSummary() : renderMultiSummary()}

          <div className="p-3.5 glass rounded-2xl space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-70">Net Transfer Breakdown</h3>
            {transactions.length === 0 ? (
              <div className="text-center text-green-500 font-bold py-1 text-xs">
                Everything is settled up!
              </div>
            ) : (
              <div className="space-y-1.5">
                {transactions.map((t, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-white/5 rounded-xl border border-white/10 text-xs">
                    <div>
                      <span className="font-bold">{getMemberName(t.from)}</span>
                      <span className="opacity-70 mx-1">pays</span>
                      <span className="font-bold">{getMemberName(t.to)}</span>
                    </div>
                    <div className="font-extrabold text-blue-400">
                      {currencySymbol(t.currency)}{t.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-3 glass rounded-2xl text-[11px] font-medium opacity-80 leading-snug text-center">
            {isSingle ? (
              "Transfers are minimized by offsetting debts and credits between members to require the fewest transactions."
            ) : (
              "Transfers above are minimum transactions combining all selected expenses. Individual breakdowns remain on Settlement page."
            )}
          </div>
        </div>
        
        {transactions.length > 0 ? (
          <div className="p-3.5 border-t border-white/10 bg-white/5 flex gap-2.5">
            <button onClick={onClose} className="flex-1 glass-button py-2 text-xs font-bold">Cancel</button>
            <button onClick={handleConfirm} disabled={settling} className="flex-1 glass-button py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-sm border-none shadow-lg">
              {settling ? 'Settling...' : 'Confirm Settle'}
            </button>
          </div>
        ) : (
          <div className="p-3.5 border-t border-white/10 bg-white/5 flex gap-2">
            <button onClick={onClose} className="flex-1 glass-button py-2 bg-white/10 text-xs font-bold">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
