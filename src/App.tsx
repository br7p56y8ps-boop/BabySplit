/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './contexts/AppContext';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import Home from './pages/Home';
import Settlement from './pages/Settlement';
import Chat from './pages/Chat';
import History from './pages/History';
import Settings from './pages/Settings';
import IdentityGate from './components/IdentityGate';

const AppLayout = () => {
  const { isLoading, activeIdentityId } = useAppContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto px-4 py-6 w-full max-w-3xl mx-auto">
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
        <AppLayout />
      </BrowserRouter>
    </AppProvider>
  );
}
