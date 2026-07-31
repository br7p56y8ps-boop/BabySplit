import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { doc, updateDoc, deleteDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LogOut, ShieldAlert, Moon, Sun, KeyRound, AlertTriangle, RefreshCcw, Users, Info, PieChart, FileText, Download } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import SpaceManagementModal from '../components/SpaceManagementModal';
import ExportPdfModal from '../components/ExportPdfModal';
import { Expense } from '../types';
import { getExpenseStatus } from '../lib/settlementUtils';
import { isUserSpaceCreator, isMemberCreator } from '../lib/spaceUtils';

export default function Settings() {
  const { activeSpaceId, spaces, activeIdentityId, setActiveIdentityId, members, user } = useAppContext();
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  const activeMember = members.find(m => m.id === activeIdentityId);
  
  const [newPin, setNewPin] = useState('');
  const [showPinChange, setShowPinChange] = useState(false);
  
  // NEW: State for Master Space PIN
  const [newSpacePin, setNewSpacePin] = useState('');
  const [showSpacePinChange, setShowSpacePinChange] = useState(false);
  
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [isDeleteSpaceOpen, setIsDeleteSpaceOpen] = useState(false);

  const isCreator = isUserSpaceCreator(activeSpace, user?.uid, activeMember, members);
  const isPublic = activeSpace?.type === 'public';
  const isActiveMemberCreator = isMemberCreator(activeMember, activeSpace, members);

  // Fetch expenses for Statistics
  useEffect(() => {
    if (!activeSpaceId) return;
    const q = query(collection(db, 'expenses'), where('spaceId', '==', activeSpaceId));
    const unsub = onSnapshot(q, (snap) => {
      const exps: Expense[] = [];
      snap.forEach(d => exps.push({ id: d.id, ...d.data() } as Expense));
      setExpenses(exps);
    });
    return () => unsub();
  }, [activeSpaceId]);

  // Statistics Calculations
  let totalSettled = 0;
  let totalUnsettled = 0;
  let unsettledCount = 0;

  expenses.forEach(exp => {
    const status = getExpenseStatus(exp);

    if (status === 'Fully Settled') {
      totalSettled += exp.totalAmount;
    } else {
      totalUnsettled += exp.totalAmount;
      unsettledCount++;
    }
  });

  // Expense Obesity Meter calculation
  const spaceCreatedAt = activeSpace?.createdAt || Date.now() - (86400000 * 30);
  const daysElapsed = Math.max(1, (Date.now() - spaceCreatedAt) / (1000 * 60 * 60 * 24));
  const monthsElapsed = Math.max(0.2, daysElapsed / 30);
  const expensesPerMonth = expenses.length / monthsElapsed;

  let obesityLabel = 'Underweight 🥗';
  let obesityColor = 'text-green-400 bg-green-500/20 border-green-500/30';
  let obesityDesc = `${expensesPerMonth.toFixed(1)} exps/mo - Low volume`;

  if (expensesPerMonth > 25) {
    obesityLabel = 'Morbidly Expensive 🚨🤣';
    obesityColor = 'text-red-400 bg-red-500/20 border-red-500/30';
    obesityDesc = `${expensesPerMonth.toFixed(1)} exps/mo! Emergency!`;
  } else if (expensesPerMonth > 12) {
    obesityLabel = 'Obese 🍕';
    obesityColor = 'text-orange-400 bg-orange-500/20 border-orange-500/30';
    obesityDesc = `${expensesPerMonth.toFixed(1)} exps/mo - High volume`;
  } else if (expensesPerMonth > 5) {
    obesityLabel = 'Chubby Wallet 🍔';
    obesityColor = 'text-amber-400 bg-amber-500/20 border-amber-500/30';
    obesityDesc = `${expensesPerMonth.toFixed(1)} exps/mo - Moderate`;
  } else if (expensesPerMonth >= 2) {
    obesityLabel = 'Healthy 🍏';
    obesityColor = 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    obesityDesc = `${expensesPerMonth.toFixed(1)} exps/mo - Balanced`;
  }

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme_preference', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme_preference', 'dark');
      setIsDark(true);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.trim() || !activeMember) return;
    await updateDoc(doc(db, 'members', activeMember.id), { pin: newPin });
    setNewPin('');
    setShowPinChange(false);
    alert("Personal PIN updated successfully!");
  };

  // NEW: Function to handle changing the Master Space PIN
  const handleChangeSpacePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpacePin.trim() || !activeSpaceId) return;
    await updateDoc(doc(db, 'spaces', activeSpaceId), { joinPin: newSpacePin });
    setNewSpacePin('');
    setShowSpacePinChange(false);
    alert("Master Space PIN updated successfully!");
  };

  const confirmDeleteSpace = async () => {
    if (activeSpaceId) {
      await deleteDoc(doc(db, 'spaces', activeSpaceId));
      setActiveIdentityId(null);
    }
    setIsDeleteSpaceOpen(false);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full relative overflow-hidden">
      {/* Fixed Title Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
          <button onClick={handleRefresh} className={`p-2 glass-button rounded-full ${isRefreshing ? 'animate-spin' : ''}`}>
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 pb-2">
        {/* 1. Identity Card */}
        <div className="glass-panel p-5 rounded-3xl relative overflow-hidden">
          <div className="absolute top-4 right-4 w-3 h-3 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0">
              {activeMember?.name.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold">{activeMember?.name || 'Guest'}</h2>
                {isActiveMemberCreator && !isPublic && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30">
                    🕵🏼 Creator
                  </span>
                )}
              </div>
              <p className="text-xs opacity-70">Active Identity • {activeSpace?.name}</p>
            </div>
          </div>

          {/* Dynamic PIN Logic based on Space Type */}
          {isPublic ? (
            <>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveIdentityId(null)} 
                  className="flex-1 glass-button py-2 flex items-center justify-center gap-1.5 text-xs font-bold"
                >
                  <LogOut className="w-4 h-4 text-blue-400" /> Change Identity
                </button>
                <button 
                  onClick={() => setShowPinChange(!showPinChange)} 
                  className="flex-1 glass-button py-2 flex items-center justify-center gap-1.5 text-xs font-bold"
                >
                  <KeyRound className="w-4 h-4 text-indigo-400" /> Change PIN
                </button>
              </div>

              {showPinChange && (
                <form onSubmit={handleChangePin} className="mt-3 p-3 glass rounded-2xl animate-in slide-in-from-top-2">
                  <label className="block text-xs font-bold mb-1.5 opacity-80">New PIN</label>
                  <div className="flex gap-2">
                    <input 
                      type="password" 
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10} 
                      value={newPin} 
                      onChange={e => setNewPin(e.target.value)} 
                      className="glass-input flex-1 py-1.5 px-3 text-xs" 
                      placeholder="Enter numeric PIN" 
                      required
                    />
                    <button type="submit" className="glass-button px-4 py-1.5 text-xs font-bold bg-blue-500/20 text-blue-400">
                      Save
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="p-2.5 glass rounded-xl text-center text-xs opacity-70 border border-white/10">
                Identity fixed for Private Space
              </div>
              
              {/* NEW: Master Space PIN Change for Creator Only */}
              {isCreator && (
                <div className="pt-2 border-t border-white/10">
                  <button 
                    onClick={() => setShowSpacePinChange(!showSpacePinChange)} 
                    className="w-full glass-button py-2 flex items-center justify-center gap-1.5 text-xs font-bold border border-indigo-500/30 text-indigo-400"
                  >
                    <KeyRound className="w-4 h-4" /> Change Master Space PIN
                  </button>

                  {showSpacePinChange && (
                    <form onSubmit={handleChangeSpacePin} className="mt-3 p-3 glass rounded-2xl animate-in slide-in-from-top-2 border border-indigo-500/20 bg-indigo-500/5">
                      <label className="block text-xs font-bold mb-1.5 opacity-80 text-indigo-300">New Space PIN</label>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={10} 
                          value={newSpacePin} 
                          onChange={e => setNewSpacePin(e.target.value)} 
                          className="glass-input flex-1 py-1.5 px-3 text-xs" 
                          placeholder="Enter new Space PIN" 
                          required
                        />
                        <button type="submit" className="glass-button px-4 py-1.5 text-xs font-bold bg-indigo-500/20 text-indigo-400">
                          Save
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Statistics Card (2x2 Grid) */}
        <div className="glass-panel p-4 rounded-3xl space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest opacity-70">
            <PieChart className="w-4 h-4 text-blue-400" />
            <span>Space Statistics ({activeSpace?.name})</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Tile 1: Settled */}
            <div className="p-3 glass rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">Total Settled</span>
              <span className="text-base sm:text-lg font-extrabold text-green-400 block">
                {totalSettled.toFixed(2)}
              </span>
            </div>

            {/* Tile 2: Unsettled */}
            <div className="p-3 glass rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">Total Unsettled</span>
              <span className="text-base sm:text-lg font-extrabold text-amber-400 block">
                {totalUnsettled.toFixed(2)}
              </span>
            </div>

            {/* Tile 3: Count */}
            <div className="p-3 glass rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">Unsettled Expenses</span>
              <span className="text-base sm:text-lg font-extrabold text-blue-400 block">
                {unsettledCount} {unsettledCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Tile 4: Obesity Meter */}
            <div className="p-3 glass rounded-2xl space-y-1 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">Obesity Meter</span>
              <div>
                <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${obesityColor}`}>
                  {obesityLabel}
                </span>
                <p className="text-[9px] opacity-60 mt-1 truncate">{obesityDesc}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Theme Mode Card */}
        <div className="glass-panel p-3.5 px-4 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">Theme Mode</span>
          <button onClick={toggleTheme} className="w-10 h-10 glass-button rounded-full flex items-center justify-center">
            {isDark ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>
        </div>

        {/* 4. Space Management Card */}
        <div 
          onClick={() => setIsSpaceModalOpen(true)}
          className="glass-panel p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold">Space Management</h3>
              <p className="text-xs opacity-60">Manage members for {activeSpace?.name}</p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-400 px-3 py-1 glass-button rounded-full">
            Manage
          </span>
        </div>

        {/* 5. Export Data Card (Placed above About card) */}
        <div 
          onClick={() => setIsExportModalOpen(true)}
          className="glass-panel p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors border border-blue-500/20 bg-blue-500/5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-400">Export Data (PDF)</h3>
              <p className="text-xs opacity-70">Download full PDF report with members, expenses & settlements</p>
            </div>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsExportModalOpen(true); }}
            className="text-xs font-bold text-blue-400 px-3 py-1.5 glass-button rounded-xl flex items-center gap-1.5 bg-blue-500/20 border-blue-500/30 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>

        {/* 6. About Card */}
        <div className="glass-panel p-4 rounded-2xl space-y-3">
          <div className="flex items-center gap-3">
            <img 
              src="/icon-192.png" 
              alt="Expense Splitter App Icon" 
              className="w-12 h-12 rounded-2xl shadow-md border border-white/20 object-cover shrink-0" 
              onError={(e) => {
                e.currentTarget.src = "/favicon.svg";
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white truncate">Expense Splitter</h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 shrink-0">
                  v1.2.0
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Smart Expense & Settlement Manager</p>
            </div>
          </div>
          <p className="text-xs opacity-70 leading-relaxed border-t border-white/10 pt-2">
            Split expenses effortlessly with friends across public and private spaces. Real-time settlements, minimal transaction routing, and full transparency.
          </p>
          <p className="text-xs font-semibold text-right opacity-90">
            Developed with ❤️ by <strong className="text-blue-400">benzavraar</strong>
          </p>
        </div>

        {/* 7. Delete Space (Private Space Only & Creator Only) */}
        {!isPublic && isCreator && (
          <div className="glass-panel p-4 rounded-2xl border border-red-500/30 bg-red-500/5">
            <h3 className="font-bold text-red-500 uppercase tracking-widest text-xs mb-3 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> Danger Zone
            </h3>
            <button 
              onClick={() => setIsDeleteSpaceOpen(true)} 
              className="w-full glass-button py-2.5 text-xs text-red-400 font-bold flex items-center justify-center gap-2 border-red-500/30 hover:bg-red-500/20"
            >
              <AlertTriangle className="w-4 h-4" /> Delete Entire Space
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {isSpaceModalOpen && (
        <SpaceManagementModal onClose={() => setIsSpaceModalOpen(false)} />
      )}

      {isExportModalOpen && activeSpace && (
        <ExportPdfModal 
          space={activeSpace}
          members={members}
          expenses={expenses}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      <ConfirmModal
        isOpen={isDeleteSpaceOpen}
        title="Delete Entire Space"
        message="Are you sure you want to delete this space and all its expenses? This action is permanent."
        confirmText="Delete Space"
        isDanger={true}
        onConfirm={confirmDeleteSpace}
        onClose={() => setIsDeleteSpaceOpen(false)}
      />
    </div>
  );
}
