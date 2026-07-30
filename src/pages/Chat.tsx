import React, { useEffect, useState, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { collection, query, where, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChatMessage } from '../types';
import { format } from 'date-fns';
import { Send, RefreshCcw } from 'lucide-react';

export default function Chat() {
  const { activeSpaceId, activeIdentityId, members, user } = useAppContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeMember = members.find(m => m.id === activeIdentityId);

  useEffect(() => {
    if (!user || !activeSpaceId) return;
    const q = query(collection(db, 'chatMessages'), where('spaceId', '==', activeSpaceId), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs: ChatMessage[] = [];
        snap.forEach(d => msgs.push({ id: d.id, ...d.data() } as ChatMessage));
        setMessages(msgs);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      },
      (err) => {
        console.error('Chat messages listener error:', err);
      }
    );
    return () => unsub();
  }, [user, activeSpaceId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeMember) return;
    
    const msg = newMessage;
    setNewMessage('');
    
    await addDoc(collection(db, 'chatMessages'), {
      spaceId: activeSpaceId,
      memberId: activeIdentityId,
      memberName: activeMember.name,
      message: msg,
      timestamp: Date.now()
    });
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    {/* 
      1. h-[calc(100dvh-100px)]: Adjust the "100px" if your bottom nav is taller or shorter. 
      2. flex flex-col overflow-hidden: Locks the parent container to the screen.
    */}
    <div className="flex flex-col h-[calc(100dvh-100px)] w-full overflow-hidden">
      
      {/* HEADER: shrink-0 prevents it from being crushed */}
      <div className="shrink-0 flex items-center justify-between mb-3 mt-2 px-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Space Chat</h1>
          <button onClick={handleRefresh} className={`p-2 glass-button rounded-full ${isRefreshing ? 'animate-spin' : ''}`}>
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MESSAGES: flex-1 takes remaining space, min-h-0 prevents it from pushing the composer off-screen */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 pb-2 scroll-smooth">
        {messages.length === 0 ? (
          <div className="text-center p-10 glass-panel rounded-3xl text-gray-500 dark:text-gray-400 mt-4">
            No messages yet. Send a message to start chatting!
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.memberId === activeIdentityId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="text-[11px] opacity-60 mb-0.5 px-1">
                   {!isMe && <span className="font-bold mr-1 text-blue-400">{msg.memberName}</span>}
                   {format(new Date(msg.timestamp), 'HH:mm')}
                </div>
                <div className={`p-3 px-4 rounded-2xl max-w-[82%] text-sm shadow-md break-words ${isMe ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-tr-xs' : 'glass rounded-tl-xs'}`}>
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* COMPOSER: shrink-0 prevents it from being crushed, mt-auto pushes it to the bottom */}
      <div className="shrink-0 mt-auto pt-2 pb-4 bg-transparent px-1">
        <form onSubmit={handleSend} className="flex gap-2 items-center glass p-2 rounded-2xl border border-white/20 dark:border-white/10 shadow-xl">
          <input 
            type="text" 
            inputMode="text"
            value={newMessage} 
            onChange={e => setNewMessage(e.target.value)} 
            className="glass-input flex-1 border-none bg-transparent focus:ring-0 text-sm py-2 px-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none" 
            placeholder="Type a message..."
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim()} 
            className="w-10 h-10 rounded-xl glass-button flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-500 text-white disabled:opacity-40 disabled:pointer-events-none shrink-0 border-none"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
      
    </div>
  );
}
