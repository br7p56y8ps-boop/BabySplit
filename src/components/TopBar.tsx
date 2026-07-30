import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bell, ChevronDown } from 'lucide-react';
import SpaceSwitcher from './SpaceSwitcher';
import NotificationsModal from './NotificationsModal';

const parseTimestamp = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    return ts.toDate().getTime();
  }
  if (typeof ts === 'object' && 'seconds' in ts) {
    return ts.seconds * 1000;
  }
  return new Date(ts).getTime();
};

export default function TopBar() {
  const { spaces, activeSpaceId, user } = useAppContext();
  const [isSpaceSwitcherOpen, setSpaceSwitcherOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);

  const activeSpace = spaces.find(s => s.id === activeSpaceId);

  useEffect(() => {
    if (!user || !activeSpaceId) return;

    const storageKey = `last_seen_notif_${activeSpaceId}`;
    const lastSeen = Number(localStorage.getItem(storageKey) || 0);

    const q = query(
      collection(db, 'notifications'),
      where('spaceId', '==', activeSpaceId)
    );

    const unsub = onSnapshot(q, (snap) => {
      let unread = false;
      snap.forEach((doc) => {
        const data = doc.data();
        const ts = parseTimestamp(data.timestamp);
        if (ts > lastSeen) {
          unread = true;
        }
      });
      setHasUnreadNotifs(unread);
    });

    return () => unsub();
  }, [user, activeSpaceId]);

  const handleOpenNotifications = () => {
    if (activeSpaceId) {
      localStorage.setItem(`last_seen_notif_${activeSpaceId}`, Date.now().toString());
    }
    setHasUnreadNotifs(false);
    setNotificationsOpen(true);
  };

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
          onClick={handleOpenNotifications}
          className="w-10 h-10 rounded-full flex items-center justify-center glass-button relative shrink-0"
        >
          <Bell className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          {hasUnreadNotifs && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse" />
          )}
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
