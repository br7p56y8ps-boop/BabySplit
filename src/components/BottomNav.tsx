import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calculator, MessageCircle, Clock, Settings } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function BottomNav() {
  const location = useLocation();
  const isChat = location.pathname === '/chat';
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  const { activeSpaceId, activeIdentityId, user } = useAppContext();

  useEffect(() => {
    if (!user || !activeSpaceId) return;

    const storageKey = `last_seen_chat_${activeSpaceId}`;
    let lastSeen = Number(localStorage.getItem(storageKey) || 0);

    if (isChat) {
      lastSeen = Date.now();
      localStorage.setItem(storageKey, lastSeen.toString());
      setHasUnreadChat(false);
    }

    const q = query(
      collection(db, 'chatMessages'),
      where('spaceId', '==', activeSpaceId)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (location.pathname === '/chat') {
        localStorage.setItem(storageKey, Date.now().toString());
        setHasUnreadChat(false);
        return;
      }

      const currentLastSeen = Number(localStorage.getItem(storageKey) || 0);
      let unread = false;

      snap.forEach((doc) => {
        const data = doc.data();
        const msgTime = typeof data.timestamp === 'number' 
          ? data.timestamp 
          : (data.timestamp?.seconds ? data.timestamp.seconds * 1000 : 0);
        
        if (data.memberId !== activeIdentityId && msgTime > currentLastSeen) {
          unread = true;
        }
      });

      setHasUnreadChat(unread);
    });

    return () => unsub();
  }, [user, activeSpaceId, activeIdentityId, isChat, location.pathname]);

  const tabs = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/settlement', icon: Calculator, label: 'Settlement' },
    { to: '/chat', icon: MessageCircle, label: 'Chat' },
    { to: '/history', icon: Clock, label: 'History' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 w-full max-w-3xl mx-auto inset-x-0 z-40">
      <div className="glass-panel border-b-0 border-x-0 rounded-t-[2.5rem] px-6 py-4 flex justify-between items-center relative shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]">
        {tabs.map((tab) => {
          const isChatTab = tab.to === '/chat';

          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => 
                `flex flex-col items-center flex-1 transition-all duration-300 relative ${
                  isActive 
                    ? 'text-blue-500 dark:text-blue-400 transform scale-110' 
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`
              }
            >
              <div className="relative">
                <tab.icon className="w-6 h-6 mb-1" strokeWidth={2.5} />
                {isChatTab && hasUnreadChat && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse" />
                )}
              </div>
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
