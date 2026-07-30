import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Bell, ChevronDown } from 'lucide-react';
import SpaceSwitcher from './SpaceSwitcher';
import NotificationsModal from './NotificationsModal';

export default function TopBar() {
  const { spaces, activeSpaceId } = useAppContext();
  const [isSpaceSwitcherOpen, setSpaceSwitcherOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);

  const activeSpace = spaces.find(s => s.id === activeSpaceId);

  return (
    <>
      <header className="sticky top-0 z-40 glass border-b-0 rounded-b-3xl mx-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pb-2 px-4 flex items-center justify-between shadow-md">
        <button 
          onClick={() => setSpaceSwitcherOpen(true)}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {activeSpace?.name.charAt(0).toUpperCase() || 'S'}
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-tight">Active Space</span>
            <div className="flex items-center gap-1">
              <span className="font-bold text-gray-900 dark:text-white leading-tight">{activeSpace?.name || 'Loading...'}</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        </button>

        <button 
          onClick={() => setNotificationsOpen(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center glass-button relative shrink-0"
        >
          <Bell className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>
      </header>

      {isSpaceSwitcherOpen && (
        <SpaceSwitcher onClose={() => setSpaceSwitcherOpen(false)} />
      )}

      {isNotificationsOpen && (
        <NotificationsModal onClose={() => setNotificationsOpen(false)} />
      )}
    </>
  );
}
