import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { doc, deleteDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PRESET_MEMBERS } from '../lib/db';
import { isMemberCreator } from '../lib/spaceUtils';
import { X, UserPlus, UserMinus, ShieldCheck, Edit3, Check, Shield } from 'lucide-react';
import { Member } from '../types';

interface SpaceManagementModalProps {
  onClose: () => void;
}

export default function SpaceManagementModal({ onClose }: SpaceManagementModalProps) {
  const { activeSpaceId, spaces, members, user } = useAppContext();
  const activeSpace = spaces.find(s => s.id === activeSpaceId);

  const [addMemberName, setAddMemberName] = useState('');
  const [permanentMemberName, setPermanentMemberName] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(false);

  const isCreator = activeSpace?.creatorUid === user?.uid;
  const isPublic = activeSpace?.type === 'public';

  const isPresetMember = (m: Member) => {
    if (m.isPreset === true) return true;
    if (m.isPreset === false) return false;
    return PRESET_MEMBERS.includes(m.name);
  };

  const handleAddPrivateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberName.trim() || !activeSpaceId) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'members'), {
        spaceId: activeSpaceId,
        name: addMemberName.trim(),
        pin: '1234',
        isTemporary: false,
        isPreset: false,
        createdAt: Date.now()
      });
      setAddMemberName('');
    } catch (e) {
      console.error('Error adding member:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPermanentMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permanentMemberName.trim()) return;
    setLoading(true);
    try {
      // Permanent members belong to public space & permanent global pool
      await addDoc(collection(db, 'members'), {
        spaceId: 'public',
        name: permanentMemberName.trim(),
        pin: '1234',
        isTemporary: false,
        isPreset: false,
        createdAt: Date.now()
      });
      setPermanentMemberName('');
    } catch (e) {
      console.error('Error adding permanent member:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRename = (m: Member) => {
    setEditingMemberId(m.id);
    setEditingName(m.name);
  };

  const handleSaveRename = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await updateDoc(doc(db, 'members', id), { name: editingName.trim() });
      setEditingMemberId(null);
      setEditingName('');
    } catch (e) {
      console.error('Failed to rename member:', e);
    }
  };

  const handleDeleteMember = async (m: Member) => {
    if (isPresetMember(m)) {
      alert(`"${m.name}" is an original preset member and cannot be deleted. You can only rename preset members.`);
      return;
    }
    if (members.length <= 2) {
      alert('Space must keep at least 2 members.');
      return;
    }
    if (confirm(`Delete "${m.name}" from members?`)) {
      await deleteDoc(doc(db, 'members', m.id));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div className="glass-panel w-full max-w-md rounded-3xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="font-extrabold text-base tracking-tight">Space Members</h2>
            <p className="text-xs opacity-70 uppercase tracking-wider font-semibold">
              {activeSpace?.name} ({activeSpace?.type})
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Grid Layout for Space Members */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-70">
              {isPublic ? 'Permanent Public Members' : 'Active Members'} ({members.length})
            </h3>
            
            {/* Compact 2x3 or Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {members.map(m => {
                const isPreset = isPresetMember(m);
                const isEditing = editingMemberId === m.id;
                const isCreatorMember = isMemberCreator(m, activeSpace, members);

                return (
                  <div 
                    key={m.id} 
                    className="glass p-2.5 rounded-2xl flex flex-col justify-between space-y-1.5 border border-white/10 relative group"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          className="glass-input text-xs py-1 px-1.5 w-full rounded-lg"
                          autoFocus
                        />
                        <button 
                          onClick={() => handleSaveRename(m.id)}
                          className="p-1 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="font-bold text-xs truncate flex items-center justify-between gap-1">
                            <span>{m.name}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {isCreatorMember && !isPublic ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30 flex items-center gap-0.5">
                                🛡 Creator
                              </span>
                            ) : isPreset ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-extrabold border border-purple-500/30">
                                Preset
                              </span>
                            ) : m.isTemporary ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-extrabold">
                                Guest
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-extrabold">
                                Permanent
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Control buttons */}
                        <div className="flex items-center justify-end gap-1 pt-1 border-t border-white/10">
                          <button
                            onClick={() => handleStartRename(m)}
                            className="p-1 text-blue-400 hover:bg-blue-500/20 rounded-md transition-colors"
                            title="Rename Member"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          
                          {!isPreset && (isPublic || isCreator) && (
                            <button
                              onClick={() => handleDeleteMember(m)}
                              className="p-1 text-red-400 hover:bg-red-500/20 rounded-md transition-colors"
                              title="Delete Member"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Form Logic */}
          {isPublic ? (
            /* Public Space: ONLY Permanent Member Management */
            <div className="p-3 glass rounded-2xl space-y-2 border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center gap-1.5 text-purple-400">
                <ShieldCheck className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Add Permanent Member</h3>
              </div>
              <p className="text-[11px] opacity-70 leading-snug">
                Permanent members are added directly to the Public Space and preserved across spaces.
              </p>
              <form onSubmit={handleAddPermanentMember} className="flex gap-2 pt-1">
                <input 
                  type="text" 
                  inputMode="text"
                  value={permanentMemberName} 
                  onChange={e => setPermanentMemberName(e.target.value)} 
                  className="glass-input py-1.5 px-3 flex-1 text-xs" 
                  placeholder="Permanent member name"
                  required
                />
                <button type="submit" disabled={loading} className="glass-button px-3 py-1.5 text-xs font-bold text-purple-400 border-purple-500/30 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" /> Save
                </button>
              </form>
            </div>
          ) : (
            /* Private Space: Add Private Space Member Form for Creator */
            isCreator && (
              <div className="p-3 glass rounded-2xl space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider opacity-70">Add Member to {activeSpace?.name}</h3>
                <form onSubmit={handleAddPrivateMember} className="flex gap-2">
                  <input 
                    type="text" 
                    inputMode="text"
                    value={addMemberName} 
                    onChange={e => setAddMemberName(e.target.value)} 
                    className="glass-input py-1.5 px-3 flex-1 text-xs" 
                    placeholder="Enter member name"
                    required
                  />
                  <button type="submit" disabled={loading} className="glass-button px-3 py-1.5 text-xs font-bold text-blue-400 flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5" /> Add
                  </button>
                </form>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-white/5">
          <button onClick={onClose} className="w-full glass-button py-2 text-xs font-bold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
