import React, { useState } from 'react';
import { Expense } from '../types';
import { X, RotateCcw, CheckCircle2, Clock, UserCheck } from 'lucide-react';
import { calculateExpenseTransactions, undoExpenseFullSettlement } from '../lib/settlementUtils';
import ConfirmModal from './ConfirmModal';
import { format } from 'date-fns';

interface HistoryDetailModalProps {
  exp: Expense;
  onClose: () => void;
  getMemberName: (id: string) => string;
}

export default function HistoryDetailModal({
  exp,
  onClose,
  getMemberName,
}: HistoryDetailModalProps) {
  const [isConfirmUndoOpen, setIsConfirmUndoOpen] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  const txs = calculateExpenseTransactions(exp);
  const equalShare = exp.totalAmount / (exp.participants?.length || 1);
  const currencySymbol = exp.currency === 'Taka' ? '৳' : exp.currency === 'INR' ? '₹' : '$';

  const handleConfirmUndo = async () => {
    setIsUndoing(true);
    try {
      await undoExpenseFullSettlement(exp);
      setIsConfirmUndoOpen(false);
      onClose();
    } catch (e) {
      console.error('Error undoing settlement:', e);
      alert('Failed to undo settlement');
    } finally {
      setIsUndoing(false);
    }
  };

  const settlementDateStr = exp.settledAt 
    ? format(new Date(exp.settledAt), 'dd MMM yyyy, HH:mm')
    : exp.updatedAt 
    ? format(new Date(exp.updatedAt), 'dd MMM yyyy, HH:mm')
    : 'Unknown date';

  const settledByName = exp.settledById ? getMemberName(exp.settledById) : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
        <div className="glass-panel w-full max-w-sm rounded-3xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 shadow-2xl" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base tracking-tight">{exp.title}</h2>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                  Fully Settled
                </span>
              </div>
              <p className="text-xs opacity-70">
                Expense Date: {format(new Date(exp.date), 'dd/MM/yyyy')}
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto space-y-3">
            {/* Financial Overview */}
            <div className="p-3.5 glass rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="opacity-70 font-medium">Total Amount:</span>
                <span className="font-extrabold text-sm text-green-400">{exp.currency} {exp.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-white/10">
                <span className="opacity-70 font-medium">Equal Share:</span>
                <span className="font-semibold">{currencySymbol}{equalShare.toFixed(2)} / person</span>
              </div>
              <div className="pt-1.5 border-t border-white/10">
                <span className="opacity-70 font-medium block mb-1">Original Payer(s):</span>
                {Object.entries(exp.paidBy || {}).map(([payer, amt]) => (
                  <div key={payer} className="flex justify-between items-center opacity-90 py-0.5">
                    <span>{getMemberName(payer)}</span>
                    <span className="font-bold">{currencySymbol}{Number(amt).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-1.5 border-t border-white/10">
                <span className="opacity-70 font-medium block mb-1">Participants:</span>
                <div className="flex flex-wrap gap-1">
                  {(exp.participants || []).map(pId => (
                    <span key={pId} className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-medium">
                      {getMemberName(pId)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Who Paid Whom / Settlement Transactions */}
            <div className="p-3.5 glass rounded-2xl space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-70">Settlement Transactions (Who Paid Whom)</h3>
              <div className="space-y-1.5">
                {txs.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-2 rounded-xl bg-white/5 border border-white/10 text-xs">
                    <div>
                      <span className="font-bold text-red-400">{getMemberName(tx.from)}</span>
                      <span className="opacity-60 mx-1">paid</span>
                      <span className="font-bold text-green-400">{getMemberName(tx.to)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-extrabold text-green-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {currencySymbol}{tx.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Settlement Timeline & Auditor */}
            <div className="p-3.5 glass rounded-2xl space-y-2 text-xs">
              <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-70">Settlement Timeline</h3>
              <div className="flex items-center gap-2 opacity-80">
                <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Settled At: <strong className="text-gray-900 dark:text-white">{settlementDateStr}</strong></span>
              </div>
              {settledByName && (
                <div className="flex items-center gap-2 opacity-80 pt-1 border-t border-white/10">
                  <UserCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Recorded By: <strong className="text-gray-900 dark:text-white">{settledByName}</strong></span>
                </div>
              )}
            </div>

            {/* Granular Settlement Records */}
            {exp.settlements && exp.settlements.length > 0 && (
              <div className="p-3.5 glass rounded-2xl space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-70">Detailed Payment Logs</h3>
                <div className="space-y-1.5">
                  {exp.settlements.map((s, idx) => (
                    <div key={s.id || idx} className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] flex justify-between items-center">
                      <div>
                        <span className="font-bold text-red-400">{getMemberName(s.debtorId)}</span>
                        <span className="opacity-60 mx-1">➔</span>
                        <span className="font-bold text-green-400">{getMemberName(s.creditorId)}</span>
                      </div>
                      <div className="font-bold text-green-400">
                        {s.currency || exp.currency} {Number(s.amount).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer - Undo Button */}
          <div className="p-3 border-t border-white/10 bg-white/5">
            <button
              onClick={() => setIsConfirmUndoOpen(true)}
              disabled={isUndoing}
              className="w-full glass-button py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
            >
              <RotateCcw className="w-4 h-4" />
              {isUndoing ? 'Undoing...' : 'Undo Settlement'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmUndoOpen}
        title="Undo Settlement"
        message={`Are you sure you want to undo the settlement for "${exp.title}"? This will restore the expense back to Home and Settlement tabs.`}
        confirmText="Undo Settlement"
        isDanger={true}
        onConfirm={handleConfirmUndo}
        onClose={() => setIsConfirmUndoOpen(false)}
      />
    </>
  );
}
