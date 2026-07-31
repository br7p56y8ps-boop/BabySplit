import React, { useEffect, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { collection, query, where, onSnapshot, doc, writeBatch, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Notification } from '../types';
import { X, Bell, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const parseDate = (ts: any): Date => {
  if (!ts) return new Date();
  if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    return ts.toDate();
  }
  if (typeof ts === 'object' && 'seconds' in ts) {
    return new Date(ts.seconds * 1000);
  }
  return new Date(ts);
};

export default function NotificationsModal({ onClose }: { onClose: () => void }) {
  const { activeSpaceId, user } = useAppContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (!user || !activeSpaceId) return;

    const q = query(
      collection(db, 'notifications'), 
      where('spaceId', '==', activeSpaceId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const notifs: Notification[] = [];
        snap.forEach(docSnap => {
          const data = docSnap.data();
          const clearedBy: string[] = data.clearedBy || [];

          // 👁️ ONLY include notification if current user hasn't cleared it yet!
          if (!clearedBy.includes(user.uid)) {
            notifs.push({ id: docSnap.id, ...data } as Notification);
          }
        });
        
        notifs.sort((a, b) => {
          const timeA = parseDate(a.timestamp).getTime();
          const timeB = parseDate(b.timestamp).getTime();
          return timeB - timeA;
        });

        setNotifications(notifs.slice(0, 10));
      },
      (err) => console.error('Notifications listener error:', err)
    );
    return () => unsub();
  }, [user, activeSpaceId]);

  // 👤 Clear ONLY for the logged-in user
  const handleClearNotifications = async () => {
    if (notifications.length === 0 || isClearing || !user) return;
    setIsClearing(true);

    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        const ref = doc(db, 'notifications', n.id);
        // Add current user ID to the `clearedBy` array
        batch.update(ref, {
          clearedBy: arrayUnion(user.uid)
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to clear notifications for user:', err);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="glass-panel w-full max-w-md rounded-[2rem] overflow-hidden flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
        
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <h2 className="text-xl font-bold">Notifications</h2>
          </div>

          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={handleClearNotifications}
                disabled={isClearing}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isClearing ? 'Clearing...' : 'Clear all'}
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full glass-button flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center p-8 text-gray-500">No notifications yet.</div>
          ) : (
            notifications.map(n => {
              const actor = (n as any).actorName || (n as any).userName || (n as any).createdByName;

              return (
                <div key={n.id} className="glass-button p-4 text-left block w-full hover:scale-100 cursor-default">
                  <p className="text-sm">
                    {actor && <span className="font-semibold text-blue-400 mr-1">{actor}</span>}
                    {n.message}
                  </p>
                  <span className="text-xs text-gray-400 mt-2 block">
                    {formatDistanceToNow(parseDate(n.timestamp), { addSuffix: true })}
                  </span>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
