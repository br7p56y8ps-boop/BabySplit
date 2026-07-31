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
 * Returns plain text currency codes.
 * Standard jsPDF fonts do not support Unicode symbols (৳, ₹, €, £).
 * Using text prevents gibberish characters in the exported PDF.
 */
function getCurrencySymbol(symbol: string): string {
  if (!symbol) return 'USD';
  const s = symbol.trim();
  if (s === '৳' || s === 'Taka' || s === 'BDT') return 'BDT';
  if (s === '₹' || s === 'Rupee' || s === 'INR') return 'INR';
  if (s === '€' || s === 'EUR') return 'EUR';
  if (s === '£' || s === 'GBP') return 'GBP';
  if (s === '¥' || s === 'JPY') return 'JPY';
  if (s === '$' || s === 'USD') return '$';
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
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const getMemberName = (id: string) => members.find(m => m.id === id)?.name || id || 'Unknown';
    const exportTime = format(new Date(), 'dd MMM yyyy, HH:mm:ss');

    let currentY = 12;

    // 1. App Icon Header (Size 26, 3 line breaks space after)
    try {
      const iconImg = await loadImage('/icon-512.png');
      if (iconImg) {
        const iconSize = 26;
        const iconX = (pageWidth - iconSize) / 2;
        
        doc.addImage(iconImg, 'PNG', iconX, currentY, iconSize, iconSize);
        doc.setLineWidth(0.5);
        doc.setDrawColor(0, 0, 0);
        doc.rect(iconX, currentY, iconSize, iconSize); // Black border
        
        currentY += iconSize + 12; // 3 line breaks spacing after icon
      }
    } catch (e) {
      // Fallback gracefully if image path is not found
    }

    // 2. Main Title: BabySplit (Font Size 26)
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
    
    currentY += splitDesc.length * 4.5 + 20; // 5 line breaks spacing after description

    // 4. Report Tag (Increased font size 20, with light Navy Blue / Yellow Container)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    const reportText = 'Report';
    const reportWidth = doc.getTextWidth(reportText);
    const boxPaddingX = 8;
    const boxHeight = 10;
    const boxX = (pageWidth - reportWidth) / 2 - boxPaddingX;
    const boxY = currentY - 7.5;
    const boxW = reportWidth + (boxPaddingX * 2);

    // Light Yellow Fill with Soft Navy Border
    doc.setFillColor(254, 249, 195); // Soft Light Yellow
    doc.setDrawColor(26, 54, 93);    // Navy Blue Border
    doc.setLineWidth(0.6);
    doc.roundedRect(boxX, boxY, boxW, boxHeight + 2, 2, 2, 'FD');

    // Navy Blue Report Text
    doc.setTextColor(26, 54, 93);
    doc.text(reportText, pageWidth / 2, currentY, { align: 'center' });

    currentY += 22; // 5 line breaks spacing after Report tag

    // Helper for Section Headings
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

    currentY += 5; // Tight gap between heading and table content

    const memberNames = members.map(m => m.name);
    const membersGridBody: string[][] = [];
    for (let i = 0; i < 3; i++) {
      const m1 = memberNames[i * 2] || '—';
      const m2 = memberNames[i * 2 + 1] || '—';
      membersGridBody.push([m1, m2]);
    }

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

    // Space after section content before next heading
    currentY = Math.max((doc as any).lastAutoTable.finalY, currentY + 32) + 18;

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
    currentY += 5; // Tight gap between heading and table content

    const expensesBody = filteredExpenses.map(exp => {
      const dateStr = exp.date ? format(new Date(exp.date), 'dd/MM/yyyy') : '-';
      const currencySym = getCurrencySymbol(exp.currency);
      const totalAmtStr = `${currencySym} ${exp.totalAmount.toFixed(2)}`;

      const paidByStr = Object.entries(exp.paidBy || {})
        .map(([pId, amt]) => `${getMemberName(pId)}: ${currencySym} ${amt.toFixed(2)}`)
        .join('\n');

      const participantsList = (exp.participants || []).map(pId => getMemberName(pId));
      const participantsStr = participantsList.join(', ');

      const numP = participantsList.length || 1;
      const equalShareVal = (exp.totalAmount / numP).toFixed(2);
      const equalShareStr = `${currencySym} ${equalShareVal} / person`;

      const status = getExpenseStatus(exp);

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
        2: { cellWidth: 22, fontStyle: 'bold', textColor: [37, 99, 235] },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
        5: { cellWidth: 22, textColor: [75, 85, 99] },
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

    // Space after section content before next heading
    currentY = (doc as any).lastAutoTable.finalY + 18;

    // 7. Itemized Expense Payment Flow
    if (currentY > 210) {
      doc.addPage();
      currentY = 15;
    }

    renderHeading('Itemized Expense Payment Flow', 14, currentY);
    currentY += 5; // Tight gap between heading and table content

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
          if (data.column.index === 3 || data.column.index === 4) {
            const rawRow = data.row.raw as any[];
            const flowStatusCell = rawRow[rawRow.length - 1]; 
            
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

    // Space after section content before next heading
    currentY = (doc as any).lastAutoTable.finalY + 18;

    // 8. Net Minimum Transfer Flow
    if (currentY > 190) {
      doc.addPage();
      currentY = 15;
    }

    renderHeading('Net Minimum Transfer Flow', 14, currentY);
    currentY += 5; // Tight gap between heading and table content

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

    // Space after section content before next block
    currentY = (doc as any).lastAutoTable.finalY + 16;

    // --- 9. UNIFORM TABLE & SPACED EXAMPLE AUDIT ---
    const sampleMemberId = netTransfers.length > 0 ? netTransfers[0].from : members[0]?.id;
    const sampleMemberName = getMemberName(sampleMemberId);

    let totalPaid = 0;
    let totalOwed = 0;
    const tableBodyRaw: Array<{ title: string; currSym: string; paid: number; share: number; netExp: number }> = [];
    const primaryCurrency = getCurrencySymbol(filteredExpenses[0]?.currency || '');

    // Build Table Data
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
        
        tableBodyRaw.push({
          title: exp.title,
          currSym,
          paid,
          share,
          netExp
        });
      }
    });

    const netBalance = totalPaid - totalOwed;
    const finalTransferTarget = netTransfers.find((t: any) => t.from === sampleMemberId);
    const targetReceiverName = finalTransferTarget 
      ? (finalTransferTarget.toName || getMemberName(finalTransferTarget.to)) 
      : 'Receiver';

    // Calculate Box Height beforehand
    const topTextGap = 32; 
    const rowEstimate = 7.5;
    const tableEstHeight = tableBodyRaw.length > 0 ? (tableBodyRaw.length + 1) * rowEstimate + 6 : 0;
    const bottomTextGap = tableBodyRaw.length > 0 ? 32 : 0;
    const paddingBottom = 6;
    
    const containerBoxHeight = topTextGap + tableEstHeight + bottomTextGap + paddingBottom;

    if (currentY + containerBoxHeight > pageHeight - 15) {
      doc.addPage();
      currentY = 15;
    }

    // Draw Grey Container background
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(209, 213, 219);
    doc.roundedRect(14, currentY, pageWidth - 28, containerBoxHeight, 2, 2, 'FD');

    let textY = currentY + 7;

    // Apply Uniform Text Style for top of container
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128); // Standard Grey

    doc.text('How Net Minimum Transfers are Calculated:', 18, textY);
    textY += 5;
    
    doc.text('1. Net Balance Calculation: Each member\'s total payments are balanced against their total assigned expense shares. Think of it as UPI diet mode — same debts settled, way fewer transfers.', 18, textY);
    textY += 5;
    
    // FIXED: Changed this string to use double quotes to prevent unescaped single quotes from breaking the build
    doc.text("2. Debt Minimization: Individual per-expense transfers are combined to settle all space debts in the minimum possible transactions. No middlemen, no chains, no 'wait who owes who again' — just the shortest route to zero balance.", 18, textY);
    textY += 5;

    doc.text('3. For Instance- ', 18, textY);
    textY += 5;

    doc.text(`From the above Expenses, taking as an example of '${sampleMemberName}' ; the net transfer was simplified as-`, 18, textY);
    textY += 4; 

    // Add Inner Table with custom colored cell rendering
    if (tableBodyRaw.length > 0) {
      const tableBodyForAutoTable = tableBodyRaw.map(r => [
        r.title,
        '', 
        `${r.currSym} ${r.share.toFixed(2)}`,
        ''  
      ]);

      autoTable(doc, {
        startY: textY,
        margin: { left: 18, right: 18 },
        tableWidth: pageWidth - 36,
        head: [['Title', 'Paid', 'Equal Shares', 'Net Amount']],
        body: tableBodyForAutoTable,
        theme: 'grid',
        styles: { 
          font: 'helvetica',
          fontSize: 8, 
          cellPadding: 2, 
          textColor: [107, 114, 128], 
          lineColor: [209, 213, 219],
          lineWidth: 0.1
        },
        headStyles: { 
          fillColor: [229, 231, 235], 
          textColor: [107, 114, 128], 
          fontStyle: 'normal' 
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 35 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
        },
        didDrawCell: (data) => {
          if (data.section === 'body') {
            const rowData = tableBodyRaw[data.row.index];
            if (!rowData) return;

            const textYPos = data.cell.y + (data.cell.height / 2) + 1;
            const textXPos = data.cell.x + 2;

            // Paid Column Custom Formatting
            if (data.column.index === 1) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(107, 114, 128); // Grey Currency
              const currText = `${rowData.currSym} `;
              doc.text(currText, textXPos, textYPos);

              const currWidth = doc.getTextWidth(currText);
              if (rowData.paid > 0) {
                doc.setTextColor(22, 163, 74); // Green if paid > 0
              } else {
                doc.setTextColor(107, 114, 128); // Grey if 0
              }
              doc.text(rowData.paid.toFixed(2), textXPos + currWidth, textYPos);
            }

            // Net Amount Column Custom Formatting
            if (data.column.index === 3) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(107, 114, 128); // Grey Currency
              const currText = `${rowData.currSym} `;
              doc.text(currText, textXPos, textYPos);

              const currWidth = doc.getTextWidth(currText);
              const sign = rowData.netExp >= 0 ? '+' : '-';
              const amtValStr = `${sign}${Math.abs(rowData.netExp).toFixed(2)}`;

              if (rowData.netExp >= 0) {
                doc.setTextColor(22, 163, 74); // Green for positive
              } else {
                doc.setTextColor(220, 38, 38); // Red for negative
              }
              doc.text(amtValStr, textXPos + currWidth, textYPos);
            }
          }
        }
      });

      textY = (doc as any).lastAutoTable.finalY + 7;

      // --- Bottom Summary Lines (Aligned with Equal Shares & Net Amount Columns) ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      
      const equalSharesColX = pageWidth - 88; // Aligns with Equal Shares column
      const netAmountColX = pageWidth - 53;   // Aligns with Net Amount column
      const actionColor = netBalance >= 0 ? [22, 163, 74] : [220, 38, 38]; 

      // 1. Total Paid
      doc.setTextColor(0, 0, 0); 
      doc.text('Total Paid', equalSharesColX, textY);
      doc.setTextColor(0, 0, 0); 
      const currStr1 = `${primaryCurrency} `;
      doc.text(currStr1, netAmountColX, textY);
      doc.setTextColor(22, 163, 74); 
      doc.text(totalPaid.toFixed(2), netAmountColX + doc.getTextWidth(currStr1), textY);
      textY += 5;

      // 2. Should Pay/Receive
      doc.setTextColor(0, 0, 0); 
      doc.text('Should Pay/Receive', equalSharesColX, textY);
      doc.setTextColor(0, 0, 0); 
      const currStr2 = `${primaryCurrency} `;
      doc.text(currStr2, netAmountColX, textY);
      doc.setTextColor(actionColor[0], actionColor[1], actionColor[2]);
      doc.text(totalOwed.toFixed(2), netAmountColX + doc.getTextWidth(currStr2), textY);
      textY += 5;

      // 3. Net Difference
      const netSign = netBalance >= 0 ? '+' : '-';
      doc.setTextColor(0, 0, 0); 
      doc.text('Net Difference', equalSharesColX, textY);
      doc.setTextColor(0, 0, 0); 
      const currStr3 = `${primaryCurrency} `;
      doc.text(currStr3, netAmountColX, textY);
      doc.setTextColor(actionColor[0], actionColor[1], actionColor[2]);
      doc.text(`${netSign}${Math.abs(netBalance).toFixed(2)}`, netAmountColX + doc.getTextWidth(currStr3), textY);
      textY += 7;

      // 4. Final Action: Bold Label + Highlighted Container with Mixed Text Colors
      const titleX = 18;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      const actionTitle = 'Final Action:';
      doc.text(actionTitle, titleX, textY);
      
      const actionTitleWidth = doc.getTextWidth(actionTitle) + 4; 
      const badgeX = titleX + actionTitleWidth;

      let part1 = '';
      let part2Amount = '';
      let part3 = '';

      if (netBalance < 0) {
        part1 = `${sampleMemberName} pays `;
        part2Amount = `${primaryCurrency} ${Math.abs(netBalance).toFixed(2)}`;
        part3 = ` directly to ${targetReceiverName}`;
      } else {
        part1 = `${sampleMemberName} receives `;
        part2Amount = `${primaryCurrency} ${netBalance.toFixed(2)}`;
        part3 = ` in total settlement`;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);

      const w1 = doc.getTextWidth(part1);
      const w2 = doc.getTextWidth(part2Amount);
      const w3 = doc.getTextWidth(part3);
      const totalMsgWidth = w1 + w2 + w3;

      const bgFill = netBalance >= 0 ? [220, 252, 231] : [254, 226, 226]; 
      const borderColor = netBalance >= 0 ? [187, 247, 208] : [254, 202, 202];
      const amountColor = netBalance >= 0 ? [22, 163, 74] : [220, 38, 38];

      const pPaddingX = 2.5;
      doc.setFillColor(bgFill[0], bgFill[1], bgFill[2]);
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      
      // Draw highlighted pill container
      doc.roundedRect(
        badgeX - pPaddingX, 
        textY - 3.5, 
        totalMsgWidth + (pPaddingX * 2), 
        5.2, 
        1, 
        1, 
        'FD'
      );

      // Render Badge Content
      let curX = badgeX;

      // Part 1: Black Text
      doc.setTextColor(0, 0, 0);
      doc.text(part1, curX, textY);
      curX += w1;

      // Part 2: Color-Coded Amount (Red / Green)
      doc.setTextColor(amountColor[0], amountColor[1], amountColor[2]);
      doc.text(part2Amount, curX, textY);
      curX += w2;

      // Part 3: Black Text
      doc.setTextColor(0, 0, 0);
      doc.text(part3, curX, textY);
    }

    currentY = currentY + containerBoxHeight + 12;

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
  } catch (error) {
    console.error('PDF Export Error:', error);
  }
}
