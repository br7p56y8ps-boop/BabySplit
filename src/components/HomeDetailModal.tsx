import React, { useState } from 'react';
import { Expense } from '../types';
import { X, Trash2, RefreshCcw, Pencil } from 'lucide-react';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import ConfirmModal from './ConfirmModal';
import { getExpenseStatus } from '../lib/settlementUtils';
import EditExpenseModal from './EditExpenseModal';


interface HomeDetailModalProps {
  exp: Expense;
  onClose: () => void;
  getMemberName: (id: string) => string;
}

export default function HomeDetailModal({
  exp,
  onClose,
  getMemberName,
}: HomeDetailModalProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const status = getExpenseStatus(exp);
  const equalShare = exp.totalAmount / (exp.participants?.length || 1);
  const currencySymbol = exp.currency === 'Taka' ? '৳' : exp.currency === 'INR' ? '₹' : '$';

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'expenses', exp.id));
      setIsDeleteOpen(false);
      onClose();
    } catch (e) {
      console.error('Failed to delete expense:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'expenses', exp.id), {
        settlements: [],
        status: 'Unsettled',
        settledAt: null,
        settledById: null,
        updatedAt: Date.now()
      });
      setIsResetOpen(false);
      onClose();
    } catch (e) {
      console.error('Failed to reset expense:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
        <div className="glass-panel w-full max-w-sm rounded-3xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 shadow-2xl" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base tracking-tight">{exp.title}</h2>
                {status === 'Partially Settled' && (
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Partially Settled
                  </span>
                )}
              </div>
              <p className="text-xs opacity-70">
                {new Date(exp.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 overflow-y-auto space-y-3">
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
          </div>

          {/* Footer Actions */}
          <div className="p-3 border-t border-white/10 bg-white/5 flex gap-2">
            <button
              onClick={() => setIsEditOpen(true)}
              disabled={loading}
              className="flex-1 glass-button py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
            <button
              onClick={() => setIsResetOpen(true)}
              disabled={loading}
              className="flex-1 glass-button py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20"
            >
              <RefreshCcw className="w-4 h-4" /> Reset
            </button>
            <button
              onClick={() => setIsDeleteOpen(true)}
              disabled={loading}
              className="flex-1 glass-button py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        title="Delete Expense"
        message={`Are you sure you want to delete "${exp.title}" permanently?`}
        confirmText="Delete"
        isDanger={true}
        onConfirm={handleDelete}
        onClose={() => setIsDeleteOpen(false)}
      />

      <ConfirmModal
        isOpen={isResetOpen}
        title="Reset Settlements"
        message={`Are you sure you want to reset all settlements for "${exp.title}"?`}
        confirmText="Reset"
        isDanger={true}
        onConfirm={handleReset}
        onClose={() => setIsResetOpen(false)}
      />

      {isEditOpen && (
        <EditExpenseModal 
          exp={exp} 
          onClose={() => setIsEditOpen(false)} 
        />
      )}
    </>
  );
}
