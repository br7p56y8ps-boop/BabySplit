import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Space, Member, Expense } from '../types';
import { calculateExpenseTransactions, getExpenseStatus } from './settlementUtils';

function cleanCurrencySymbol(c?: string): string {
  if (!c) return '৳';
  const lower = c.toLowerCase().trim();
  if (lower === 'taka' || lower === 'bdt' || lower === '৳') return '৳';
  if (lower === 'inr' || lower === '₹') return '₹';
  if (lower === 'usd' || lower === '$') return '$';
  return c.trim();
}

/**
 * Calculates net minimum transfers ONLY for active / unsettled expenses.
 * Fully settled expense cards are completely excluded from this calculation.
 */
function calculateNetMinimumTransfers(expenses: Expense[]): { from: string; to: string; amount: number; currency: string }[] {
  const balances: Record<string, number> = {};
  let defaultCurrency = '৳';

  // Only consider expenses that are NOT fully settled
  const activeExpenses = expenses.filter(exp => getExpenseStatus(exp) !== 'Fully Settled');

  activeExpenses.forEach(exp => {
    if (!exp.participants || exp.participants.length === 0) return;
    const share = exp.totalAmount / exp.participants.length;
    if (exp.currency) defaultCurrency = cleanCurrencySymbol(exp.currency);

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
  filter: 'all' | 'settled' | 'unsettled'
) {
  const doc = new jsPDF();
  const safeSpaceName = space.name || 'Space';

  const getMemberName = (id: string) => {
    const m = members.find((mem) => mem.id === id);
    return m ? m.name : 'Unknown';
  };

  // Filter expenses based on user export selection
  const filteredExpenses = expenses.filter((exp) => {
    const status = getExpenseStatus(exp);
    if (filter === 'settled') return status === 'Fully Settled';
    if (filter === 'unsettled') return status !== 'Fully Settled';
    return true;
  });

  let currentY = 15;

  // Document Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(16, 185, 129); // Emerald color
  doc.text(`${safeSpaceName} - Financial Summary`, 14, currentY);

  currentY += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on: ${format(new Date(), 'PPpp')} | Filter: ${filter.toUpperCase()}`, 14, currentY);

  currentY += 10;

  // 1. Space Information Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text('Space Information', 14, currentY);

  currentY += 4;
  autoTable(doc, {
    startY: currentY,
    head: [['Space Name', 'Type', 'Total Members', 'Created Date']],
    body: [
      [
        space.name,
        space.type.toUpperCase(),
        members.length.toString(),
        space.createdAt ? format(new Date(space.createdAt), 'PPP') : 'N/A',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 2. Members List Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text('Space Members', 14, currentY);

  currentY += 4;
  const membersBody = members.map((m, idx) => [
    (idx + 1).toString(),
    m.name,
    m.isPreset ? 'Preset Member' : m.isTemporary ? 'Temporary Member' : 'Regular Member',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Member Name', 'Role/Type']],
    body: membersBody.length > 0 ? membersBody : [['-', 'No members found', '-']],
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 3. Expense Report Section (Includes Settled & Partial cards with whole-row highlights)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text('Expense Report', 14, currentY);

  currentY += 4;
  const expensesBody = filteredExpenses.map((exp) => {
    const currencyStr = cleanCurrencySymbol(exp.currency);
    
    const paidByStr = Object.entries(exp.paidBy || {})
      .map(([mId, amt]) => `${getMemberName(mId)}: ${currencyStr}${amt}`)
      .join(', ');

    const participantsStr = (exp.participants || [])
      .map((mId) => getMemberName(mId))
      .join(', ');

    const pCount = exp.participants?.length || 1;
    const shareAmt = (exp.totalAmount / pCount).toFixed(2);
    const equalShareStr = `${currencyStr}${shareAmt} / person`;

    const status = getExpenseStatus(exp);

    let settledInfo = 'Not Settled';
    if (exp.settledAt) {
      const settledDate = format(new Date(exp.settledAt), 'PP');
      const settledBy = exp.settledById ? getMemberName(exp.settledById) : 'System';
      settledInfo = `${settledDate}\nBy: ${settledBy}`;
    }

    return [
      exp.title,
      format(new Date(exp.date), 'PP'),
      `${currencyStr}${exp.totalAmount}`,
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
    body:
      expensesBody.length > 0
        ? expensesBody
        : [['No matching expenses recorded', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 18 },
      2: { cellWidth: 20 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 20 },
      6: { cellWidth: 18 },
      7: { cellWidth: 20 },
    },
    // Whole row highlighting based on expense status
    didParseCell: (data) => {
      if (data.section === 'body' && filteredExpenses[data.row.index]) {
        const exp = filteredExpenses[data.row.index];
        const status = getExpenseStatus(exp);

        if (status === 'Fully Settled') {
          data.cell.styles.fillColor = [236, 253, 245]; // Soft Emerald tint
          data.cell.styles.textColor = [6, 78, 59];
        } else if (status === 'Partially Settled') {
          data.cell.styles.fillColor = [254, 243, 199]; // Soft Amber tint
          data.cell.styles.textColor = [120, 53, 15];
        }
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 4. Per-Expense Transaction Flow Section
  if (filteredExpenses.length > 0) {
    if (currentY > 220) {
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

      const status = getExpenseStatus(exp);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      doc.text(`Expense: ${exp.title} [${status.toUpperCase()}]`, 14, currentY);
      currentY += 4;

      const txs = calculateExpenseTransactions(exp);
      const currSymbol = exp.currency?.trim() || cleanCurrencySymbol(exp.currency);

      const txsBody = txs.length > 0
        ? txs.map(tx => [getMemberName(tx.from), getMemberName(tx.to), `${currSymbol}${tx.amount.toFixed(2)}`])
        : [['-', '-', 'No transfers required / Fully Settled']];

      autoTable(doc, {
        startY: currentY,
        head: [['From', 'To', 'Amount']],
        body: txsBody,
        theme: 'grid',
        headStyles: { fillColor: status === 'Fully Settled' ? [16, 185, 129] : [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 60 },
          2: { cellWidth: 62 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && status === 'Fully Settled') {
            data.cell.styles.fillColor = [240, 253, 244];
          }
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    });
  }

  // Check active expenses (excluding settled cards)
  const activeExpenses = filteredExpenses.filter(exp => getExpenseStatus(exp) !== 'Fully Settled');

  // 5. Net Minimum Transfer Flow OR "All Expenses Settled" Container Box
  if (currentY > 210) {
    doc.addPage();
    currentY = 15;
  } else {
    currentY += 4;
  }

  if (activeExpenses.length === 0) {
    // -------------------------------------------------------------
    // SCENARIO A: NO ACTIVE EXPENSE LEFT (ALL SETTLED)
    // Erase Net Minimum Transfer Flow and show broad highlighted box
    // -------------------------------------------------------------
    const boxX = 14;
    const boxWidth = doc.internal.pageSize.width - 28;
    const startYBox = currentY;
    
    // Draw Box Content
    currentY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(6, 95, 70); // Dark Emerald
    doc.text('All Expenses Settled!', boxX + 8, currentY);

    currentY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 118, 110);
    
    const descLines = doc.splitTextToSize(
      'There are no active expenses remaining to settle. All accounts within this space are fully balanced and settled.',
      boxWidth - 16
    );
    doc.text(descLines, boxX + 8, currentY);

    // Tight Border Calculation: End border exactly 1 line break offset (~6pt padding) below text
    const textHeight = descLines.length * 4.5;
    const endYBox = currentY + textHeight + 2; 

    // Draw Container Box Background & Border
    doc.setDrawColor(16, 185, 129);
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(boxX, startYBox, boxWidth, endYBox - startYBox, 3, 3, 'FD');

    // Re-render text on top of filled rectangle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(6, 95, 70);
    doc.text('All Expenses Settled!', boxX + 8, startYBox + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 118, 110);
    doc.text(descLines, boxX + 8, startYBox + 15);

    currentY = endYBox + 10;

    // Show Settled Transactions Flow Summary Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text('Settled Transactions Flows', 14, currentY);
    currentY += 4;

    const settledTxsBody: string[][] = [];
    filteredExpenses.forEach(exp => {
      const txs = calculateExpenseTransactions(exp);
      const currSymbol = exp.currency?.trim() || cleanCurrencySymbol(exp.currency);
      txs.forEach(tx => {
        settledTxsBody.push([
          exp.title,
          getMemberName(tx.from),
          getMemberName(tx.to),
          `${currSymbol}${tx.amount.toFixed(2)}`,
          'Settled'
        ]);
      });
    });

    autoTable(doc, {
      startY: currentY,
      head: [['Expense', 'From', 'To', 'Amount', 'Status']],
      body: settledTxsBody.length > 0 ? settledTxsBody : [['-', '-', '-', '-', 'Fully Settled']],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          data.cell.styles.fillColor = [240, 253, 244];
        }
      }
    });

  } else {
    // -------------------------------------------------------------
    // SCENARIO B: ACTIVE EXPENSES EXIST
    // Render Net Minimum Transfer Flow with Full Highlighting & Note
    // -------------------------------------------------------------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129);
    doc.text('Net Minimum Transfer Flow', 14, currentY);

    currentY += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    const noteText = "Note: Per-expense transaction flows above are provided for full transparency. Transactions should be completed according to the Net Minimum Transfer Flow table below to minimize the total number of transfers.";
    const splitNote = doc.splitTextToSize(noteText, doc.internal.pageSize.width - 28);
    doc.text(splitNote, 14, currentY);

    currentY += (splitNote.length * 4) + 3;

    // Calculate Net Minimum Transfers purely on UNSETTLED / active cards
    const netTxs = calculateNetMinimumTransfers(activeExpenses);
    const netBody = netTxs.length > 0
      ? netTxs.map(tx => [
          getMemberName(tx.from),
          getMemberName(tx.to),
          `${tx.currency}${tx.amount.toFixed(2)}`,
          'Pending Action'
        ])
      : [['-', '-', 'No net transfers required', 'Settled']];

    autoTable(doc, {
      startY: currentY,
      head: [['From', 'To', 'Net Transfer Amount', 'Action Status']],
      body: netBody,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      styles: { 
        fontSize: 9, 
        cellPadding: 3,
        fontStyle: 'bold',
        fillColor: [240, 253, 244], // Fully highlighted cells
        textColor: [6, 78, 59]
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 45 },
        2: { cellWidth: 50 },
        3: { cellWidth: 42 },
      },
    });
  }

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Save PDF file
  const fileName = `ExpenseReport_${safeSpaceName}_${filter}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  doc.save(fileName);
}