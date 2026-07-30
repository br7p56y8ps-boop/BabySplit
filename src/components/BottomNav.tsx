import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calculator, MessageCircle, Clock, Settings, Plus } from 'lucide-react';
import AddExpenseModal from './AddExpenseModal';

export default function BottomNav() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [isAddOpen, setAddOpen] = useState(false);

  const tabs = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/settlement', icon: Calculator, label: 'Settlement' },
    { to: '/chat', icon: MessageCircle, label: 'Chat', isCenter: true },
    { to: '/history', icon: Clock, label: 'History' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <>
      <nav className="fixed bottom-0 w-full max-w-3xl mx-auto inset-x-0 z-40">
        <div className="glass-panel border-b-0 border-x-0 rounded-t-[2.5rem] px-6 py-4 flex justify-between items-center relative shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]">
          
          {/* SVG Notch for Home */}
          {isHome && (
             <div className="absolute left-1/2 -top-6 -translate-x-1/2 w-20 h-10 overflow-hidden pointer-events-none hidden">
                <div className="w-24 h-24 bg-transparent rounded-full border-[10px] border-white/20 dark:border-white/5 absolute -top-4 -left-2 backdrop-blur-xl"></div>
             </div>
          )}

          {tabs.map((tab) => {
            if (tab.isCenter && isHome) {
              return (
                <div key={tab.to} className="relative flex-1 flex justify-center h-full items-center">
                  <button
                    onClick={() => setAddOpen(true)}
                    className="absolute -top-10 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-transform border-4 border-[#f0f2f5] dark:border-[#0f1115]"
                  >
                    <Plus className="w-8 h-8" />
                  </button>
                </div>
              );
            }
            
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) => 
                  `flex flex-col items-center flex-1 transition-all duration-300 ${isActive ? 'text-blue-500 dark:text-blue-400 transform scale-110' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`
                }
              >
                <tab.icon className="w-6 h-6 mb-1" strokeWidth={2.5} />
                <span className="text-[10px] font-semibold">{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {isAddOpen && <AddExpenseModal onClose={() => setAddOpen(false)} />}
    </>
  );
}
