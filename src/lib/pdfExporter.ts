import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Space, Member, Expense } from '../types';
import { calculateExpenseTransactions, getExpenseStatus, calculateNetTransfers } from '../lib/settlementUtils';
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

export function exportSpaceDataToPDF(
  space: Space,
  members: Member[],
  expenses: Expense[],
  filter: 'all' | 'settled' | 'unsettled' = 'all'
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
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

  // Filter expenses according to selected filter
  const filteredExpenses = expenses.filter(exp => {
    const status = getExpenseStatus(exp);
    if (filter === 'settled') return status === 'Fully Settled';
    if (filter === 'unsettled') return status !== 'Fully Settled';
    return true;
  });

  // 3. Clean Expense Report (No squished transaction column)
  if (currentY > 220) {
    doc.addPage();
    currentY = 15;
  }

  const filterTitle = 
    filter === 'settled' 
      ? '3. Expense Overview (Settled Only)' 
      : filter === 'unsettled' 
      ? '3. Expense Overview (Unsettled Only)' 
      : '3. Expense Overview (All Expenses)';

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
      .join('\n');

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
      0: { cellWidth: 25 }, // Title
      1: { cellWidth: 18 }, // Date
      2: { cellWidth: 20 }, // Amount
      3: { cellWidth: 30 }, // Paid By
      4: { cellWidth: 30 }, // Participants
      5: { cellWidth: 20 }, // Equal Share
      6: { cellWidth: 18 }, // Status
      7: { cellWidth: 21 }, // Settled Info
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 4. Dedicated Expense Transaction Flow Table
  if (currentY > 220) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text('4. Itemized Expense Payment Flows', 14, currentY);
  currentY += 4;

  const itemizedTxRows: string[][] = [];
  filteredExpenses.forEach(exp => {
    const txs = calculateExpenseTransactions(exp);
    const currencyStr = cleanCurrencySymbol(exp.currency);
    const status = getExpenseStatus(exp);

    if (txs.length === 0) {
      itemizedTxRows.push([exp.title, '—', '—', 'No transfer required', status]);
    } else {
      txs.forEach(tx => {
        itemizedTxRows.push([
          exp.title,
          getMemberName(tx.from),
          getMemberName(tx.to),
          `${currencyStr} ${tx.amount.toFixed(2)}`,
          status,
        ]);
      });
    }
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Expense Title', 'Payer (From)', 'Receiver (To)', 'Amount', 'Expense Status']],
    body: itemizedTxRows.length > 0 ? itemizedTxRows : [['No transaction flows', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 5. Net Minimum Transfer Flow Section
  if (currentY > 210) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text('5. Net Minimum Transfer Flow (Final Space Settlement)', 14, currentY);
  currentY += 4;

  // Calculate overall net transfers for active space expenses
  const netTransfers = calculateNetTransfers 
    ? calculateNetTransfers(filteredExpenses, members) 
    : [];

  if (netTransfers.length === 0) {
    autoTable(doc, {
      startY: currentY,
      head: ['Settlement Status'],
      body: [['All member balances are fully settled! No transfers required.']],
      theme: 'plain',
      styles: { fontSize: 9, fontStyle: 'bold', textColor: [16, 185, 129] },
    });
  } else {
    const netRows = netTransfers.map((t: any) => [
      t.fromName || getMemberName(t.from),
      t.toName || getMemberName(t.to),
      `${cleanCurrencySymbol(t.currency || '')} ${t.amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['From (Payer)', 'To (Receiver)', 'Net Transfer Amount']],
      body: netRows,
      theme: 'striped',
      headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
    });
  }

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Calculation Note Box
  if (currentY > 250) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFillColor(243, 244, 246);
  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(14, currentY, pageWidth - 28, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text('How Net Minimum Transfers are Calculated:', 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('1. Net Balance Calculation: Each member\'s total payments are balanced against their total assigned expense shares.', 18, currentY + 12);
  doc.text('2. Debt Minimization: Individual per-expense transfers are combined. Net creditors (+) and net debtors (-) are matched', 18, currentY + 17);
  doc.text('   using a greedy minimization algorithm to settle all space debts in the minimum possible transactions.', 18, currentY + 22);

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
