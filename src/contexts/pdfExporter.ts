import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Space, Member, Expense } from '../types';
import { calculateExpenseTransactions, getExpenseStatus } from './settlementUtils';
import { format } from 'date-fns';

function cleanCurrencySymbol(symbol: string): string {
  if (!symbol) return 'USD';
  const s = symbol.trim();
  if (s === '৳') return 'BDT';
  if (s === '₹') return 'INR';
  if (s === '€') return 'EUR';
  if (s === '£') return 'GBP';
  if (s === '¥') return 'JPY';
  return s;
}

function calculateNetMinimumTransfers(expenses: Expense[]): { from: string; to: string; amount: number; currency: string }[] {
  const balances: Record<string, number> = {};
  let defaultCurrency = '৳';

  expenses.forEach(exp => {
    if (!exp.participants || exp.participants.length === 0) return;
    const share = exp.totalAmount / exp.participants.length;
    if (exp.currency) defaultCurrency = exp.currency.trim();

    // Payers
    Object.entries(exp.paidBy || {}).forEach(([payer, amt]) => {
      balances[payer] = (balances[payer] || 0) + Number(amt || 0);
    });

    // Participants
    exp.participants.forEach(p => {
      balances[p] = (balances[p] || 0) - share;
    });
  });

  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  Object.entries(balances).forEach(([mId, amt]) => {
    if (amt < -0.01) debtors.push({ id: mId, amount: Math.abs(amt) });
    else if (amt > 0.01) creditors.push({ id: mId, amount: amt });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const netTxs: { from: string; to: string; amount: number; currency: string }[] = [];
  let d = 0;
  let c = 0;

  const dCopy = debtors.map(x => ({ ...x }));
  const cCopy = creditors.map(x => ({ ...x }));

  while (d < dCopy.length && c < cCopy.length) {
    const amt = Math.min(dCopy[d].amount, cCopy[c].amount);
    if (amt > 0.01) {
      const fixedAmt = Number(amt.toFixed(2));
      netTxs.push({
        from: dCopy[d].id,
        to: cCopy[c].id,
        amount: fixedAmt,
        currency: defaultCurrency,
      });
      dCopy[d].amount -= amt;
      cCopy[c].amount -= amt;
    }
    if (dCopy[d].amount < 0.01) d++;
    if (cCopy[c].amount < 0.01) c++;
  }

  return netTxs;
}

export function exportSpaceDataToPDF(
  space: Space,
  members: Member[],
  expenses: Expense[],
  filter: 'all' | 'settled' | 'unsettled' = 'all'
) {
  const doc = new jsPDF();
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || id || 'Unknown';
  const exportTime = format(new Date(), 'dd MMM yyyy, HH:mm:ss');

  let currentY = 15;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(37, 99, 235); // Blue
  doc.text('Expense Splitter Report', 14, currentY);

  currentY += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on ${exportTime}`, 14, currentY);

  currentY += 10;

  // 1. Space Information
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text('1. Space Information', 14, currentY);
  currentY += 4;

  autoTable(doc, {
    startY: currentY,
    head: [['Attribute', 'Value']],
    body: [
      ['Space Name', space.name],
      ['Space Type', space.type.toUpperCase()],
      ['Export Date & Time', exportTime],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 2. Active Space Members
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text('2. Space Members', 14, currentY);
  currentY += 4;

  const membersBody = members.map(m => [
    m.name,
    m.isTemporary ? 'Guest' : 'Member',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Member Name', 'Role / Status']],
    body: membersBody.length > 0 ? membersBody : [['No members found', '-']],
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 3. Expense Report
  if (currentY > 230) {
    doc.addPage();
    currentY = 15;
  }

  // Filter expenses according to selected filter
  const filteredExpenses = expenses.filter(exp => {
    const status = getExpenseStatus(exp);
    if (filter === 'settled') return status === 'Fully Settled';
    if (filter === 'unsettled') return status !== 'Fully Settled';
    return true;
  });

  const filterTitle = 
    filter === 'settled' 
      ? '3. Expense Report (Settled Only)' 
      : filter === 'unsettled' 
      ? '3. Expense Report (Unsettled Only)' 
      : '3. Expense Report (All Expenses)';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text(filterTitle, 14, currentY);
  currentY += 4;

  const expensesBody = filteredExpenses.map(exp => {
    const dateStr = exp.date ? format(new Date(exp.date), 'dd/MM/yyyy') : '-';
    const currencyStr = cleanCurrencySymbol(exp.currency);
    const totalAmtStr = `${currencyStr} ${exp.totalAmount.toFixed(2)}`;

    // Paid By
    const paidByStr = Object.entries(exp.paidBy || {})
      .map(([pId, amt]) => `${getMemberName(pId)}: ${currencyStr} ${amt.toFixed(2)}`)
      .join(', ');

    // Participants
    const participantsList = (exp.participants || []).map(pId => getMemberName(pId));
    const participantsStr = participantsList.join(', ');

    // Equal Share
    const numP = participantsList.length || 1;
    const equalShareVal = (exp.totalAmount / numP).toFixed(2);
    const equalShareStr = `${currencyStr} ${equalShareVal} / person`;

    // Settlement Status
    const status = getExpenseStatus(exp);

    // Settled Date & Settled By
    let settledInfo = 'Not Settled';
    if (exp.settledAt) {
      const settledDate = format(new Date(exp.settledAt), 'dd/MM/yyyy');
      const settledBy = getMemberName(exp.settledById || '');
      settledInfo = `${settledDate}${settledBy ? ` by ${settledBy}` : ''}`;
    } else if (status === 'Partially Settled') {
      settledInfo = 'Partially Settled';
    }

    return [
      exp.title,
      dateStr,
      totalAmtStr,
      paidByStr,
      participantsStr,
      equalShareStr,
      status,
      settledInfo,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'Title',
        'Date',
        'Amount',
        'Paid By',
        'Participants',
        'Equal Share',
        'Status',
        'Settled Date & By',
      ],
    ],
    body: expensesBody.length > 0 
      ? expensesBody 
      : [['No matching expenses recorded', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 30 }, // Title
      1: { cellWidth: 18 }, // Date
      2: { cellWidth: 20 }, // Amount
      3: { cellWidth: 28 }, // Paid By
      4: { cellWidth: 28 }, // Participants
      5: { cellWidth: 20 }, // Equal Share
      6: { cellWidth: 18 }, // Status
      7: { cellWidth: 20 }, // Settled Date & By
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 4. Transaction Flow Section
  if (filteredExpenses.length === 1) {
    // Single Expense Transaction Flow Table
    if (currentY > 230) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text('Transaction Flow', 14, currentY);
    currentY += 4;

    const singleExp = filteredExpenses[0];
    const txs = calculateExpenseTransactions(singleExp);
    const currSymbol = singleExp.currency?.trim() || cleanCurrencySymbol(singleExp.currency);

    const txsBody = txs.length > 0
      ? txs.map(tx => [getMemberName(tx.from), getMemberName(tx.to), `${currSymbol}${tx.amount.toFixed(2)}`])
      : [['-', '-', 'No transfers required']];

    autoTable(doc, {
      startY: currentY,
      head: [['From', 'To', 'Amount']],
      body: txsBody,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 60 },
        2: { cellWidth: 62 },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  } else if (filteredExpenses.length > 1) {
    // Multiple Expenses: Individual Transaction Flow tables per expense
    if (currentY > 230) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text('Transaction Flow (Per Expense)', 14, currentY);
    currentY += 6;

    filteredExpenses.forEach(exp => {
      if (currentY > 230) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      doc.text(`Expense: ${exp.title}`, 14, currentY);
      currentY += 4;

      const txs = calculateExpenseTransactions(exp);
      const currSymbol = exp.currency?.trim() || cleanCurrencySymbol(exp.currency);

      const txsBody = txs.length > 0
        ? txs.map(tx => [getMemberName(tx.from), getMemberName(tx.to), `${currSymbol}${tx.amount.toFixed(2)}`])
        : [['-', '-', 'No transfers required']];

      autoTable(doc, {
        startY: currentY,
        head: [['From', 'To', 'Amount']],
        body: txsBody,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 60 },
          2: { cellWidth: 62 },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    });

    // Net Minimum Transfer Table (ONLY for multiple expenses)
    if (currentY > 220) {
      doc.addPage();
      currentY = 15;
    } else {
      currentY += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text('Net Minimum Transfer', 14, currentY);
    currentY += 4;

    const netTxs = calculateNetMinimumTransfers(filteredExpenses);
    const netBody = netTxs.length > 0
      ? netTxs.map(tx => [
          getMemberName(tx.from),
          getMemberName(tx.to),
          `${tx.currency}${tx.amount.toFixed(2)}`,
        ])
      : [['-', '-', 'No net transfers required']];

    autoTable(doc, {
      startY: currentY,
      head: [['From', 'To', 'Amount']],
      body: netBody,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 60 },
        2: { cellWidth: 62 },
      },
    });
  }

  // Clean Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Expense Splitter • Page ${i} of ${totalPages} • Exported on ${exportTime}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  // Save file with clean name
  const safeSpaceName = space.name.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `ExpenseReport_${safeSpaceName}_${filter}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  doc.save(fileName);
}