/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './contexts/AppContext';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import Home from './pages/Home';
import Settlement from './pages/Settlement';
import Chat from './pages/Chat';
import History from './pages/History';
import Settings from './pages/Settings';
import IdentityGate from './components/IdentityGate';

const AppContent = () => {
  const { isLoading, activeIdentityId } = useAppContext();
  const location = useLocation();
  const isChat = location.pathname === '/chat';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen h-[100dvh] flex flex-col overflow-hidden">
      <TopBar />
        <main 
           className={`w-full max-w-3xl mx-auto px-4 pt-3 ${
           isChat 
           ? 'flex-1 min-h-0 flex flex-col overflow-hidden pb-28' 
           : 'flex-1 overflow-y-auto pb-24'
           }`}
           >
        {!activeIdentityId ? (
          <IdentityGate />
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/settlement" element={<Settlement />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        )}
      </main>
      {activeIdentityId && <BottomNav />}
    </div>
  );
};

export default function App() {
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme_preference');
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      if (!savedTheme) {
        localStorage.setItem('theme_preference', 'dark');
      }
    }
  }, []);

  return (
    <AppProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProvider>
  );
}
