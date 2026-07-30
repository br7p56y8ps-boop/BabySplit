import React, { useEffect, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Expense } from '../types';
import { format } from 'date-fns';
import { RefreshCcw } from 'lucide-react';
import { getExpenseStatus } from '../lib/settlementUtils';
import HistoryDetailModal from '../components/HistoryDetailModal';

export default function History() {
  const { activeSpaceId, members, user } = useAppContext();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeDetailExpense, setActiveDetailExpense] = useState<Expense | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!user || !activeSpaceId) return;
    const q = query(collection(db, 'expenses'), where('spaceId', '==', activeSpaceId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const exps: Expense[] = [];
        snap.forEach(d => exps.push({ id: d.id, ...d.data() } as Expense));
        exps.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        setExpenses(exps);

        if (activeDetailExpense) {
          const updated = exps.find(e => e.id === activeDetailExpense.id);
          if (updated) setActiveDetailExpense(updated);
        }
      },
      (err) => {
        console.error('History expenses listener error:', err);
      }
    );
    return () => unsub();
  }, [user, activeSpaceId]);

  const settledExpenses = expenses.filter(exp => getExpenseStatus(exp) === 'Fully Settled');
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || id || 'Unknown';

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Settlement History</h1>
          <button onClick={handleRefresh} className={`p-2 glass-button rounded-full ${isRefreshing ? 'animate-spin' : ''}`}>
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {settledExpenses.length === 0 ? (
          <div className="text-center p-10 glass-panel rounded-3xl text-gray-500">
            No settled expenses in history yet. Fully settled expenses will appear here.
          </div>
        ) : (
          settledExpenses.map(exp => (
            <div 
              key={exp.id} 
              className="glass-panel rounded-2xl p-4 transition-all duration-200 cursor-pointer hover:bg-white/10"
              onClick={() => setActiveDetailExpense(exp)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-base sm:text-lg truncate">{exp.title}</h3>
                  <p className="text-xs opacity-70 truncate">{format(new Date(exp.date), 'dd/MM/yy')}</p>
                </div>

                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 whitespace-nowrap">
                    Fully Settled
                  </span>
                  <span className="font-extrabold text-base sm:text-lg text-green-500 whitespace-nowrap">
                    {exp.currency} {exp.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {activeDetailExpense && (
        <HistoryDetailModal
          exp={activeDetailExpense}
          onClose={() => setActiveDetailExpense(null)}
          getMemberName={getMemberName}
        />
      )}
    </div>
  );
}
