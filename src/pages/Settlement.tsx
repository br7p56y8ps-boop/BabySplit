import React, { useEffect, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Expense } from '../types';
import { format } from 'date-fns';
import { RefreshCcw } from 'lucide-react';
import SettlementModal from '../components/SettlementModal';
import SettlementDetailModal from '../components/SettlementDetailModal';
import { getExpenseStatus } from '../lib/settlementUtils';

export default function Settlement() {
  const { activeSpaceId, members, activeIdentityId, user } = useAppContext();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeDetailExpense, setActiveDetailExpense] = useState<Expense | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [isSettlementModalOpen, setSettlementModalOpen] = useState(false);

  useEffect(() => {
    if (!user || !activeSpaceId) return;
    const q = query(collection(db, 'expenses'), where('spaceId', '==', activeSpaceId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const exps: Expense[] = [];
        snap.forEach(d => exps.push({ id: d.id, ...d.data() } as Expense));
        exps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setExpenses(exps);

        // Keep active detail expense updated with real-time data
        if (activeDetailExpense) {
          const updated = exps.find(e => e.id === activeDetailExpense.id);
          if (updated) setActiveDetailExpense(updated);
        }
      },
      (err) => {
        console.error('Settlement expenses listener error:', err);
      }
    );
    return () => unsub();
  }, [user, activeSpaceId]);

  const activeExpenses = expenses.filter(exp => getExpenseStatus(exp) !== 'Fully Settled');
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || 'Unknown';

  const toggleSelection = (id: string) => {
    setSelectedExpenseIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedExpenseIds.length === activeExpenses.length) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(activeExpenses.map(e => e.id));
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full relative overflow-hidden">
      {/* Fixed Title & Actions Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Settlement</h1>
          <button onClick={handleRefresh} className={`p-2 glass-button rounded-full ${isRefreshing ? 'animate-spin' : ''}`}>
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>

        {activeExpenses.length > 0 && (
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSelectAll} 
              className="text-xs font-semibold px-3 py-1.5 glass-button"
            >
              {selectedExpenseIds.length === activeExpenses.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedExpenseIds.length > 0 && (
              <button 
                onClick={() => setSettlementModalOpen(true)}
                className="text-xs font-bold px-3 py-1.5 glass-button bg-blue-500 text-white border-none shadow-md"
              >
                Settle ({selectedExpenseIds.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-3 pb-2">
        {activeExpenses.length === 0 ? (
          <div className="text-center p-10 glass-panel rounded-3xl text-gray-500">
            No active expenses to settle. All settled expenses are moved to History!
          </div>
        ) : (
          activeExpenses.map(exp => {
            const isSelected = selectedExpenseIds.includes(exp.id);
            const status = getExpenseStatus(exp);

            return (
              <div 
                key={exp.id} 
                className={`glass-panel rounded-2xl p-4 transition-all duration-200 cursor-pointer hover:bg-white/10 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setActiveDetailExpense(exp)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelection(exp.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-5 h-5 rounded bg-white/20 border-white/40 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base sm:text-lg truncate">{exp.title}</h3>
                      <p className="text-xs opacity-70 truncate">{format(new Date(exp.date), 'dd/MM/yy')}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1">
                    {status === 'Partially Settled' && (
                      <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 whitespace-nowrap">
                        Partially Settled
                      </span>
                    )}
                    <span className="font-extrabold text-base sm:text-lg text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {exp.currency} {exp.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {activeDetailExpense && (
        <SettlementDetailModal
          exp={activeDetailExpense}
          onClose={() => setActiveDetailExpense(null)}
          onSettleRemaining={() => {
            setSelectedExpenseIds([activeDetailExpense.id]);
            setSettlementModalOpen(true);
          }}
          getMemberName={getMemberName}
          activeIdentityId={activeIdentityId}
        />
      )}

      {isSettlementModalOpen && (
        <SettlementModal 
          selectedExpenseIds={selectedExpenseIds} 
          onClose={() => setSettlementModalOpen(false)} 
        />
      )}
    </div>
  );
}
