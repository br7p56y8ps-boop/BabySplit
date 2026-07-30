import React, { useEffect, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Notification } from '../types';
import { X, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationsModal({ onClose }: { onClose: () => void }) {
  const { activeSpaceId, user } = useAppContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user || !activeSpaceId) return;
    const q = query(
      collection(db, 'notifications'), 
      where('spaceId', '==', activeSpaceId),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const notifs: Notification[] = [];
        snap.forEach(doc => notifs.push({ id: doc.id, ...doc.data() } as Notification));
        setNotifications(notifs);
      },
      (err) => {
        console.error('Notifications listener error:', err);
      }
    );
    return () => unsub();
  }, [user, activeSpaceId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="glass-panel w-full max-w-md rounded-[2rem] overflow-hidden flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <h2 className="text-xl font-bold">Notifications</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass-button flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center p-8 text-gray-500">No notifications yet.</div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className="glass-button p-4 text-left block w-full hover:scale-100 cursor-default">
                <p className="text-sm">{n.message}</p>
                <span className="text-xs text-gray-400 mt-2 block">{formatDistanceToNow(n.timestamp, { addSuffix: true })}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
