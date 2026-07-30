import React, { useEffect, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Expense } from '../types';
import { format } from 'date-fns';
import { RefreshCcw, Plus } from 'lucide-react';
import { getExpenseStatus } from '../lib/settlementUtils';
import HomeDetailModal from '../components/HomeDetailModal';
import AddExpenseModal from '../components/AddExpenseModal';

export default function Home() {
  const { activeSpaceId, members, user } = useAppContext();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeDetailExpense, setActiveDetailExpense] = useState<Expense | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    if (!user || !activeSpaceId) return;
    const q = query(collection(db, 'expenses'), where('spaceId', '==', activeSpaceId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const exps: Expense[] = [];
        snap.forEach(d => exps.push({ id: d.id, ...d.data() } as Expense));
        exps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.createdAt || 0) - (a.createdAt || 0));
        setExpenses(exps);

        if (activeDetailExpense) {
          const updated = exps.find(e => e.id === activeDetailExpense.id);
          if (updated) setActiveDetailExpense(updated);
        }
      },
      (err) => {
        console.error('Home expenses listener error:', err);
      }
    );
    return () => unsub();
  }, [user, activeSpaceId]);

  const activeExpenses = expenses.filter(exp => getExpenseStatus(exp) !== 'Fully Settled');
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || 'Unknown';

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full relative overflow-hidden">
      {/* Fixed Title Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Recent Expenses</h1>
          <button onClick={handleRefresh} className={`p-2 glass-button rounded-full ${isRefreshing ? 'animate-spin' : ''}`}>
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Add Expense Button */}
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold text-xs shadow-md hover:scale-105 active:scale-95 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-3 pb-2">
        {activeExpenses.length === 0 ? (
          <div className="text-center p-10 glass-panel rounded-3xl text-gray-500">
            No active expenses. Click 'Add Expense' to create one.
          </div>
        ) : (
          activeExpenses.map(exp => {
            const status = getExpenseStatus(exp);

            return (
              <div 
                key={exp.id} 
                className="glass-panel rounded-2xl p-4 transition-all duration-200 cursor-pointer hover:bg-white/10"
                onClick={() => setActiveDetailExpense(exp)}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left Side: Title and Date */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base sm:text-lg truncate">{exp.title}</h3>
                    <p className="text-xs opacity-70 truncate">{format(new Date(exp.date), 'dd/MM/yy')}</p>
                  </div>

                  {/* Right Side: Vertical Stack (Badge top, Amount bottom) */}
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

      {/* Expense Details Modal */}
      {activeDetailExpense && (
        <HomeDetailModal
          exp={activeDetailExpense}
          onClose={() => setActiveDetailExpense(null)}
          getMemberName={getMemberName}
        />
      )}

      {/* Add Expense Modal */}
      {isAddOpen && (
        <AddExpenseModal onClose={() => setIsAddOpen(false)} />
      )}
    </div>
  );
}
