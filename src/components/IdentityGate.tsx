import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Member } from '../types';

export default function IdentityGate() {
  const { members, setActiveIdentityId } = useAppContext();
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const permanentMembers = members.filter(m => !m.isTemporary);

  const handleSelect = (member: Member) => {
    setSelectedMember(member);
    setError('');
    setPin('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMember?.pin === pin) {
      setActiveIdentityId(selectedMember.id);
    } else {
      setError('Incorrect PIN');
    }
  };

  if (selectedMember) {
    return (
      <div className="glass-panel p-6 rounded-3xl max-w-sm mx-auto mt-20 text-center animate-in fade-in zoom-in duration-300">
        <h2 className="text-2xl font-bold mb-2">Welcome, {selectedMember.name}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter your PIN to access the space.</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="glass-input w-full text-center text-2xl tracking-widest"
            placeholder="••••"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSelectedMember(null)}
              className="glass-button flex-1 py-3 text-sm font-semibold"
            >
              Back
            </button>
            <button
              type="submit"
              className="glass-button flex-1 py-3 text-sm font-semibold bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30"
            >
              Enter
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="text-center mb-8 flex flex-col items-center">
        <img 
          src="/icon-192.png" 
          alt="Expense Splitter App Icon" 
          className="w-16 h-16 rounded-2xl shadow-lg border border-white/20 mb-3 object-cover" 
          onError={(e) => { e.currentTarget.src = "/favicon.svg"; }}
        />
        <h1 className="text-3xl font-extrabold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
          Who are you?
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm">Select your identity to continue.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {permanentMembers.map(member => (
          <button
            key={member.id}
            onClick={() => handleSelect(member)}
            className="glass-panel p-4 rounded-3xl hover:bg-white/70 dark:hover:bg-black/70 transition-all duration-300 transform hover:scale-105 flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-gray-800 dark:text-gray-100">{member.name}</span>
          </button>
        ))}
        {permanentMembers.length === 0 && (
          <div className="col-span-2 text-center p-8 glass rounded-3xl text-gray-500">
            No members found in this space.
          </div>
        )}
      </div>
    </div>
  );
}
