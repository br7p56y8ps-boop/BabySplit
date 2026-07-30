import React, { useState } from 'react';
import { Expense } from '../types';
import { X, CheckCircle2, RotateCcw } from 'lucide-react';
import { 
  calculateExpenseTransactions, 
  isTransactionSettled, 
  settleSingleTransaction, 
  undoSingleTransactionSettlement, 
  Transaction 
} from '../lib/settlementUtils';

interface SettlementDetailModalProps {
  exp: Expense;
  onClose: () => void;
  onSettleRemaining: () => void;
  getMemberName: (id: string) => string;
  activeIdentityId: string | null;
}

export default function SettlementDetailModal({
  exp,
  onClose,
  onSettleRemaining,
  getMemberName,
  activeIdentityId,
}: SettlementDetailModalProps) {
  const [workingTxId, setWorkingTxId] = useState<string | null>(null);

  const txs = calculateExpenseTransactions(exp);
  const equalShare = exp.totalAmount / (exp.participants?.length || 1);
  const currencySymbol = exp.currency === 'Taka' ? '৳' : exp.currency === 'INR' ? '₹' : '$';

  const handleSettle = async (tx: Transaction) => {
    setWorkingTxId(`settle_${tx.id}`);
    try {
      await settleSingleTransaction(exp, tx, activeIdentityId || 'system');
    } catch (e) {
      console.error('Error settling tx:', e);
    } finally {
      setWorkingTxId(null);
    }
  };

  const handleUndoTx = async (tx: Transaction) => {
    setWorkingTxId(`undo_${tx.id}`);
    try {
      await undoSingleTransactionSettlement(exp, tx);
    } catch (e) {
      console.error('Error undoing tx:', e);
    } finally {
      setWorkingTxId(null);
    }
  };

  const settledCount = txs.filter(tx => isTransactionSettled(exp, tx)).length;
  const isFullySettled = txs.length > 0 && settledCount === txs.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div className="glass-panel w-full max-w-sm rounded-3xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="font-extrabold text-base tracking-tight">{exp.title}</h2>
            <p className="text-xs opacity-70">
              {new Date(exp.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3">
          {/* Summary Card */}
          <div className="p-3.5 glass rounded-2xl space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="opacity-70 font-medium">Total Amount:</span>
              <span className="font-extrabold text-sm text-blue-400">{exp.currency} {exp.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-white/10">
              <span className="opacity-70 font-medium">Equal Share:</span>
              <span className="font-semibold">{currencySymbol}{equalShare.toFixed(2)} / person</span>
            </div>
            <div className="pt-1.5 border-t border-white/10">
              <span className="opacity-70 font-medium block mb-1">Paid By:</span>
              {Object.entries(exp.paidBy || {}).map(([payer, amt]) => (
                <div key={payer} className="flex justify-between items-center opacity-90 py-0.5">
                  <span>{getMemberName(payer)}</span>
                  <span className="font-bold">{currencySymbol}{Number(amt).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transactions Card */}
          <div className="p-3.5 glass rounded-2xl space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-70">Individual Transactions</h3>
              <span className="text-[10px] opacity-60 font-medium">{settledCount}/{txs.length} Settled</span>
            </div>

            {txs.length === 0 ? (
              <p className="text-xs opacity-60 py-1 text-center">No transactions needed for this expense.</p>
            ) : (
              <div className="space-y-1.5">
                {txs.map(tx => {
                  const settled = isTransactionSettled(exp, tx);
                  const isSettling = workingTxId === `settle_${tx.id}`;
                  const isUndoing = workingTxId === `undo_${tx.id}`;

                  return (
                    <div key={tx.id} className="flex justify-between items-center p-2 rounded-xl bg-white/5 border border-white/10 text-xs">
                      <div className="pr-2 leading-tight">
                        <span className="font-bold text-red-400">{getMemberName(tx.from)}</span>
                        <span className="opacity-60 mx-1">pays</span>
                        <span className="font-bold text-green-400">{getMemberName(tx.to)}</span>
                        <div className="font-extrabold text-white mt-0.5">
                          {currencySymbol}{tx.amount.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {settled ? (
                          <>
                            <span className="flex items-center gap-1 text-[11px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Settled
                            </span>
                            <button
                              onClick={() => handleUndoTx(tx)}
                              disabled={isUndoing}
                              title="Undo this transaction"
                              className="glass-button p-1 text-[10px] font-bold text-red-400 hover:bg-red-500/20 border-red-500/30 flex items-center gap-1 rounded-lg"
                            >
                              {isUndoing ? (
                                <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></span>
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleSettle(tx)}
                            disabled={isSettling}
                            className="glass-button px-2.5 py-1 text-xs font-bold text-blue-400 hover:bg-blue-500/20 border-blue-500/30 flex items-center gap-1"
                          >
                            {isSettling ? (
                              <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                              'Settle'
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {!isFullySettled && txs.length > 0 && (
          <div className="p-3 border-t border-white/10 bg-white/5">
            <button
              onClick={() => {
                onClose();
                onSettleRemaining();
              }}
              className="w-full glass-button py-2.5 flex items-center justify-center text-xs font-bold text-blue-400 bg-blue-500/10 border-blue-500/30"
            >
              Settle Remaining Dues
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
