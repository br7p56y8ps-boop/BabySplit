import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { createPrivateSpace, joinPrivateSpace } from '../lib/db';
import { X, Plus, LogIn } from 'lucide-react';

export default function SpaceSwitcher({ onClose }: { onClose: () => void }) {
  const { spaces, activeSpaceId, setActiveSpaceId, user, members, activeIdentityId } = useAppContext();
  const [mode, setMode] = useState<'list' | 'create' | 'join'>('list');

  const [createName, setCreateName] = useState('');
  const [createPin, setCreatePin] = useState('');
  const [selectedMemberNames, setSelectedMemberNames] = useState<string[]>([]);
  
  const [joinSpaceId, setJoinSpaceId] = useState('');
  const [joinPin, setJoinPin] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const activeMember = members.find(m => m.id === activeIdentityId);
  const availableMembers = members.filter(m => !m.isTemporary && m.id !== activeIdentityId);

  const handleSwitch = (id: string) => {
    setActiveSpaceId(id);
    onClose();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!createName || !createPin || selectedMemberNames.length < 1) {
      setError('Space Name, Join PIN, and at least 1 additional member are required.');
      return;
    }
    
    const finalMemberNames = activeMember ? [activeMember.name, ...selectedMemberNames] : selectedMemberNames;
    
    setLoading(true);
    try {
      const newSpaceId = await createPrivateSpace(createName, createPin, finalMemberNames, user.uid);
      setActiveSpaceId(newSpaceId);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!joinSpaceId || !joinPin) {
      setError('Space ID and PIN are required.');
      return;
    }
    setLoading(true);
    try {
      await joinPrivateSpace(joinSpaceId, joinPin, user.uid);
      setActiveSpaceId(joinSpaceId);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-md rounded-[2rem] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {mode === 'list' ? 'Switch Space' : mode === 'create' ? 'Create Private Space' : 'Join Space'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass-button flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && <div className="mb-4 p-3 bg-red-500/20 text-red-500 text-sm rounded-xl">{error}</div>}

          {mode === 'list' && (
            <div className="space-y-4">
              <div className="space-y-2">
                {spaces.map(space => (
                  <button
                    key={space.id}
                    onClick={() => handleSwitch(space.id)}
                    className={`w-full text-left p-4 rounded-2xl flex items-center justify-between transition-all ${activeSpaceId === space.id ? 'bg-blue-500 text-white shadow-md' : 'glass-button'}`}
                  >
                    <div>
                      <div className="font-bold">{space.name}</div>
                      <div className="text-xs opacity-70 capitalize">{space.type}</div>
                    </div>
                    {space.type === 'private' && (
                      <div className="text-xs opacity-50">ID: {space.id}</div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  onClick={() => setMode('create')}
                  className="flex-1 glass-button py-3 flex flex-col items-center justify-center gap-1 text-sm font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Create
                </button>
                <button
                  onClick={() => setMode('join')}
                  className="flex-1 glass-button py-3 flex flex-col items-center justify-center gap-1 text-sm font-medium"
                >
                  <LogIn className="w-5 h-5" />
                  Join
                </button>
              </div>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 pl-1">Space Name</label>
                <input type="text" inputMode="text" value={createName} onChange={e => setCreateName(e.target.value)} className="glass-input w-full" placeholder="Weekend Trip" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 pl-1">Join PIN</label>
                <input type="password" inputMode="numeric" pattern="[0-9]*" value={createPin} onChange={e => setCreatePin(e.target.value)} className="glass-input w-full" placeholder="Secret PIN for others to join" required />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 pl-1">Select Members (min 1 required)</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableMembers.map(m => (
                    <label key={m.id} className="flex items-center gap-2 p-2 glass rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-blue-500/50" 
                        checked={selectedMemberNames.includes(m.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMemberNames(prev => [...prev, m.name]);
                          } else {
                            setSelectedMemberNames(prev => prev.filter(name => name !== m.name));
                          }
                        }}
                      />
                      <span className="text-sm font-medium">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMode('list')} className="flex-1 glass-button py-3">Cancel</button>
                <button type="submit" disabled={loading || selectedMemberNames.length === 0} className="flex-1 glass-button py-3 bg-blue-500/20 text-blue-500 font-bold disabled:opacity-50">Create</button>
              </div>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 pl-1">Space ID</label>
                <input type="text" inputMode="text" value={joinSpaceId} onChange={e => setJoinSpaceId(e.target.value)} className="glass-input w-full" placeholder="Ask creator for ID" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 pl-1">Join PIN</label>
                <input type="password" inputMode="numeric" pattern="[0-9]*" value={joinPin} onChange={e => setJoinPin(e.target.value)} className="glass-input w-full" placeholder="Space PIN" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMode('list')} className="flex-1 glass-button py-3">Back</button>
                <button type="submit" disabled={loading} className="flex-1 glass-button py-3 bg-blue-500/20 text-blue-500 font-bold">Join</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
