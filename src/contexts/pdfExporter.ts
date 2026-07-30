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

    // Compact Arrow Transaction Flow (One transaction per line)
    const txs = calculateExpenseTransactions(exp);
    const currSymbol = exp.currency?.trim() || currencyStr;
    const flowStr = txs.length > 0 
      ? txs.map(tx => `${getMemberName(tx.from)} → ${getMemberName(tx.to)} : ${currSymbol}${tx.amount.toFixed(2)}`).join('\n')
      : 'No transfers';

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
      flowStr,
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
        'Transaction Flow',
        'Settled Date & By',
      ],
    ],
    body: expensesBody.length > 0 
      ? expensesBody 
      : [['No matching expenses recorded', '-', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 22 }, // Title
      1: { cellWidth: 16 }, // Date
      2: { cellWidth: 18 }, // Amount
      3: { cellWidth: 22 }, // Paid By
      4: { cellWidth: 22 }, // Participants
      5: { cellWidth: 18 }, // Equal Share
      6: { cellWidth: 18 }, // Status
      7: { cellWidth: 28 }, // Transaction Flow (Arrow format, line-wrapped)
      8: { cellWidth: 22 }, // Settled Date & By
    },
  });

  // Footer on all pages
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