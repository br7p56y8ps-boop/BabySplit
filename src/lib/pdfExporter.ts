import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Space, Member, Expense } from '../types';
import { 
  calculateExpenseTransactions, 
  getExpenseStatus, 
  calculateNetTransfers, 
  isTransactionSettled 
} from '../lib/settlementUtils';
import { format } from 'date-fns';

/**
 * Returns currency symbol instead of text code
 */
function getCurrencySymbol(symbol: string): string {
  if (!symbol) return '$';
  const s = symbol.trim();
  if (s === 'BDT' || s === 'Taka' || s === '৳') return '৳';
  if (s === 'INR' || s === 'Rupee' || s === '₹') return '₹';
  if (s === 'EUR' || s === '€') return '€';
  if (s === 'GBP' || s === '£') return '£';
  if (s === 'JPY' || s === '¥') return '¥';
  if (s === 'USD' || s === '$') return '$';
  return s;
}

/**
 * Helper to load images asynchronously into jsPDF
 */
const loadImage = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

export async function exportSpaceDataToPDF(
  space: Space,
  members: Member[],
  expenses: Expense[],
  filter: 'all' | 'settled' | 'unsettled' = 'all'
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || id || 'Unknown';
  const exportTime = format(new Date(), 'dd MMM yyyy, HH:mm:ss');

  let currentY = 12;

  // 1. App Icon Header
  try {
    const iconImg = await loadImage('public/icon-512.png');
    if (iconImg) {
      const iconSize = 16;
      doc.addImage(iconImg, 'PNG', (pageWidth - iconSize) / 2, currentY, iconSize, iconSize);
      currentY += iconSize + 4;
    }
  } catch (e) {
    // Fallback gracefully if image path is not found
  }

  // 2. Main Title: BabySplit (Centered, Bold, Navy Blue, Largest)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(26, 54, 93); // Navy Blue
  doc.text('BabySplit', pageWidth / 2, currentY, { align: 'center' });
  currentY += 7;

  // 3. Subtitle / App Description
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Grey
  const descText = 'App that Split expenses effortlessly across public and private spaces. Real-time settlements, minimal transaction routing, and full transparency.';
  const splitDesc = doc.splitTextToSize(descText, pageWidth - 40);
  doc.text(splitDesc, pageWidth / 2, currentY, { align: 'center' });
  currentY += splitDesc.length * 4.5 + 4;

  // 4. Report Tag (Centered, Bold, Underlined, Black)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text('Report', pageWidth / 2, currentY, { align: 'center' });
  const reportTextWidth = doc.getTextWidth('Report');
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.line((pageWidth - reportTextWidth) / 2, currentY + 1, (pageWidth + reportTextWidth) / 2, currentY + 1);

  currentY += 12;

  // Helper for Section Headings (No numbering, Bold, Underlined, Black font)
  const renderHeading = (title: string, xPos: number, yPos: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(title, xPos, yPos);
    const textWidth = doc.getTextWidth(title);
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.line(xPos, yPos + 1, xPos + textWidth, yPos + 1);
  };

  // 5. Side-by-Side Tables: Space Information & Space Members
  renderHeading('Space Information', 14, currentY);
  renderHeading('Space Members', 108, currentY);

  currentY += 4;

  // Prepare 3x2 Grid for Space Members (fitting 3 lines)
  const memberNames = members.map(m => m.name);
  const membersGridBody: string[][] = [];
  for (let i = 0; i < 3; i++) {
    const m1 = memberNames[i * 2] || '—';
    const m2 = memberNames[i * 2 + 1] || '—';
    membersGridBody.push([m1, m2]);
  }

  // Left Table: Space Information (3 lines)
  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: pageWidth - 102 },
    tableWidth: 88,
    head: [['Attribute', 'Value']],
    body: [
      ['Space Name', space.name],
      ['Space Type', space.type.toUpperCase()],
      ['Export Date & Time', exportTime],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
  });

  // Right Table: Space Members (3x2 grid fitting same 3 lines)
  autoTable(doc, {
    startY: currentY,
    margin: { left: 108, right: 14 },
    tableWidth: 88,
    head: [['Member Name (1)', 'Member Name (2)']],
    body: membersGridBody,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.5, halign: 'center' },
  });

  currentY = Math.max((doc as any).lastAutoTable.finalY, currentY + 32) + 10;

  // Filter expenses according to selection
  const filteredExpenses = expenses.filter(exp => {
    const status = getExpenseStatus(exp);
    if (filter === 'settled') return status === 'Fully Settled';
    if (filter === 'unsettled') return status !== 'Fully Settled';
    return true;
  });

  // 6. Expense Overview Table
  if (currentY > 210) {
    doc.addPage();
    currentY = 15;
  }

  const overviewTitle = 
    filter === 'settled' 
      ? 'Expense Overview (Settled Only)' 
      : filter === 'unsettled' 
      ? 'Expense Overview (Unsettled Only)' 
      : 'Expense Overview';

  renderHeading(overviewTitle, 14, currentY);
  currentY += 4;

  const expensesBody = filteredExpenses.map(exp => {
    const dateStr = exp.date ? format(new Date(exp.date), 'dd/MM/yyyy') : '-';
    const currencySym = getCurrencySymbol(exp.currency);
    const totalAmtStr = `${currencySym} ${exp.totalAmount.toFixed(2)}`;

    // Paid By
    const paidByStr = Object.entries(exp.paidBy || {})
      .map(([pId, amt]) => `${getMemberName(pId)}: ${currencySym} ${amt.toFixed(2)}`)
      .join('\n');

    // Participants
    const participantsList = (exp.participants || []).map(pId => getMemberName(pId));
    const participantsStr = participantsList.join(', ');

    // Equal Share
    const numP = participantsList.length || 1;
    const equalShareVal = (exp.totalAmount / numP).toFixed(2);
    const equalShareStr = `${currencySym} ${equalShareVal} / person`;

    // Settlement Status
    const status = getExpenseStatus(exp);

    // Settled Date & By
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
      0: { cellWidth: 25 },
      1: { cellWidth: 18 },
      2: { cellWidth: 20, fontStyle: 'bold', textColor: [37, 99, 235] },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 },
      5: { cellWidth: 20, textColor: [75, 85, 99] },
      6: { cellWidth: 18 },
      7: { cellWidth: 21 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.raw) {
        const statusVal = data.row.raw[6];
        if (data.column.index === 6) {
          if (statusVal === 'Fully Settled') {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          } else if (statusVal === 'Unsettled') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (statusVal === 'Partially Settled') {
            data.cell.styles.textColor = [217, 119, 6];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 7. Itemized Expense Payment Flow
  if (currentY > 210) {
    doc.addPage();
    currentY = 15;
  }

  renderHeading('Itemized Expense Payment Flow', 14, currentY);
  currentY += 4;

  const itemizedTxRows: any[] = [];
  filteredExpenses.forEach(exp => {
    const txs = calculateExpenseTransactions(exp);
    const currencySym = getCurrencySymbol(exp.currency);

    if (txs.length === 0) {
      const expStatus = getExpenseStatus(exp);
      itemizedTxRows.push([
        { content: exp.title, rowSpan: 1, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' } }, 
        '—', 
        '—', 
        'No transfer required', 
        expStatus === 'Fully Settled' ? 'Settled' : 'Unsettled'
      ]);
    } else {
      txs.forEach((tx, idx) => {
        const settled = isTransactionSettled(exp, tx);
        const row: any[] = [];
        
        // Merging Expense Title cell across all flows for this expense
        if (idx === 0) {
          row.push({ 
            content: exp.title, 
            rowSpan: txs.length, 
            styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' } 
          });
        }

        row.push(
          getMemberName(tx.from),
          getMemberName(tx.to),
          `${currencySym} ${tx.amount.toFixed(2)}`,
          settled ? 'Settled' : 'Unsettled'
        );
        itemizedTxRows.push(row);
      });
    }
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Expense Title', 'Payer (From)', 'Receiver (To)', 'Amount', 'Flow Status']],
    body: itemizedTxRows.length > 0 ? itemizedTxRows : [['No transaction flows', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rawRow = data.row.raw as any[];
        const flowStatusCell = rawRow[rawRow.length - 1]; 
        const amountCellIndex = rawRow.length - 2;

        if (data.column.index === amountCellIndex || data.column.index === rawRow.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          if (flowStatusCell === 'Settled') {
            data.cell.styles.textColor = [22, 163, 74];
          } else {
            data.cell.styles.textColor = [220, 38, 38];
          }
        }
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 8. Net Minimum Transfer Flow
  if (currentY > 190) {
    doc.addPage();
    currentY = 15;
  }

  renderHeading('Net Minimum Transfer Flow', 14, currentY);
  currentY += 4;

  const netTransfers = calculateNetTransfers 
    ? calculateNetTransfers(filteredExpenses, members) 
    : [];

  if (netTransfers.length === 0) {
    autoTable(doc, {
      startY: currentY,
      head: ['Settlement Status'],
      body: [['All member balances are fully settled! No transfers required.']],
      theme: 'plain',
      styles: { fontSize: 9, fontStyle: 'bold', textColor: [22, 163, 74] },
    });
  } else {
    const netRows = netTransfers.map((t: any) => {
      const fromName = t.fromName || getMemberName(t.from);
      const toName = t.toName || getMemberName(t.to);
      const sym = getCurrencySymbol(t.currency || '');
      return [fromName, toName, `${sym} ${t.amount.toFixed(2)}` ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['From (Payer)', 'To (Receiver)', 'Net Transfer Amount']],
      body: netRows,
      theme: 'striped',
      headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // --- BUILD SPACED & NEAT MEMBER AUDIT EXAMPLE ---
  const sampleMemberId = netTransfers.length > 0 ? netTransfers[0].from : members[0]?.id;
  const sampleMemberName = getMemberName(sampleMemberId);

  let totalPaid = 0;
  let totalOwed = 0;
  const breakdownLines: string[] = [];
  const primaryCurrency = getCurrencySymbol(filteredExpenses[0]?.currency || '');

  filteredExpenses.forEach(exp => {
    const currSym = getCurrencySymbol(exp.currency);
    const paid = exp.paidBy?.[sampleMemberId] || 0;
    const isParticipant = exp.participants?.includes(sampleMemberId);
    const numP = exp.participants?.length || 1;
    const share = isParticipant ? (exp.totalAmount / numP) : 0;

    if (paid > 0 || share > 0) {
      totalPaid += paid;
      totalOwed += share;
      const netExp = paid - share;
      const sign = netExp >= 0 ? '+' : '';
      
      // Clean single line per expense using plain terms
      breakdownLines.push(
        `• ${exp.title} — Paid: ${currSym} ${paid.toFixed(2)}   |   Should Pay: ${currSym} ${share.toFixed(2)}   |   Net: ${sign}${currSym} ${netExp.toFixed(2)}`
      );
    }
  });

  const netBalance = totalPaid - totalOwed;
  const finalTransferTarget = netTransfers.find((t: any) => t.from === sampleMemberId);
  const targetReceiverName = finalTransferTarget 
    ? (finalTransferTarget.toName || getMemberName(finalTransferTarget.to)) 
    : 'Receiver';

  // Spaced line-height calculation for a neat layout
  const lineSpacing = 5.5; 
  const baseBoxHeight = 28;
  const exampleHeaderHeight = breakdownLines.length > 0 ? 10 : 0;
  const exampleLinesHeight = breakdownLines.length * lineSpacing;
  const exampleSummaryHeight = breakdownLines.length > 0 ? 16 : 0;
  
  const boxHeight = baseBoxHeight + exampleHeaderHeight + exampleLinesHeight + exampleSummaryHeight;

  // Check page overflow
  if (currentY + boxHeight > pageHeight - 20) {
    doc.addPage();
    currentY = 15;
  }

  // Draw Single Unified Calculation Container Box
  doc.setFillColor(243, 244, 246);
  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(14, currentY, pageWidth - 28, boxHeight, 2, 2, 'FD');

  let textY = currentY + 7;

  // Standard Calculation Explanations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text('How Net Minimum Transfers are Calculated:', 18, textY);

  textY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('1. Net Balance Calculation: Each member\'s total payments are balanced against their total assigned expense shares.', 18, textY);
  
  textY += 5;
  doc.text('2. Debt Minimization: Individual per-expense transfers are combined to settle all space debts in the minimum possible transactions.', 18, textY);

  // Append Spaced Member Audit Breakdown
  if (breakdownLines.length > 0) {
    textY += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 138); // Dark Navy Blue
    doc.text(`3. Detailed Calculation Example for ${sampleMemberName}:`, 18, textY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(75, 85, 99);

    // Neat, spaced-out lines for each expense
    breakdownLines.forEach(line => {
      textY += lineSpacing;
      doc.text(line, 22, textY);
    });

    // Summary Totals Line
    textY += 6.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(17, 24, 39);
    doc.text(
      `Total Paid: ${primaryCurrency} ${totalPaid.toFixed(2)}    −    Total Should Pay: ${primaryCurrency} ${totalOwed.toFixed(2)}    =    Net Difference: ${primaryCurrency} ${netBalance.toFixed(2)}`,
      22,
      textY
    );

    // Final Action Line (Plain, clear language)
    textY += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    if (netBalance < 0) {
      doc.setTextColor(220, 38, 38); // Red
      doc.text(
        `→ Final Action: ${sampleMemberName} pays ${primaryCurrency} ${Math.abs(netBalance).toFixed(2)} directly to ${targetReceiverName}`,
        22,
        textY
      );
    } else {
      doc.setTextColor(22, 163, 74); // Green
      doc.text(
        `→ Final Action: ${sampleMemberName} receives ${primaryCurrency} ${netBalance.toFixed(2)} in total settlement`,
        22,
        textY
      );
    }
  }

  currentY += boxHeight + 12;

  // 9. Member Signatures Block (3x2 Grid at Last Page Bottom)
  const sigBlockHeight = 65;
  if (currentY + sigBlockHeight > pageHeight - 20) {
    doc.addPage();
    currentY = 20;
  }

  renderHeading('Space Members Signatures & Approvals', 14, currentY);
  currentY += 10;

  // Render Members in 3x2 Grid
  const gridCols = 3;
  const marginX = 14;
  const totalWidth = pageWidth - marginX * 2;
  const colWidth = totalWidth / gridCols;
  const rowHeight = 22;

  members.forEach((member, idx) => {
    const row = Math.floor(idx / gridCols);
    const col = idx % gridCols;

    const cellX = marginX + col * colWidth + colWidth / 2;
    const cellY = currentY + row * rowHeight;

    // Handwritten Blue Signature (Pen Style)
    doc.setFont('times', 'italic');
    doc.setFontSize(18);
    doc.setTextColor(29, 78, 216); // Royal Blue Pen Ink
    doc.text(member.name, cellX, cellY + 6, { align: 'center' });

    // Printed Member Name (Bold Black)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39); // Bold Black
    doc.text(member.name.toUpperCase(), cellX, cellY + 13, { align: 'center' });
  });

  const totalRows = Math.ceil(members.length / gridCols) || 1;
  currentY += totalRows * rowHeight + 12;

  // End of Report Divider & Text
  doc.setLineWidth(0.5);
  doc.setDrawColor(229, 231, 235);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(75, 85, 99);
  doc.text('End of Report', pageWidth / 2, currentY, { align: 'center' });

  // Clean Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `BabySplit • Page ${i} of ${totalPages} • Exported on ${exportTime}`,
      14,
      pageHeight - 8
    );
  }

  // Save file with clean name
  const safeSpaceName = space.name.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `BabySplit_${safeSpaceName}_${filter}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  doc.save(fileName);
}
