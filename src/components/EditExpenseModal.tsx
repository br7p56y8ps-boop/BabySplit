import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X, Plus, UserPlus } from 'lucide-react';
import { Expense } from '../types';

export default function EditExpenseModal({ exp, onClose }: { exp: Expense, onClose: () => void }) {
  const { activeSpaceId, members, activeIdentityId, user } = useAppContext();
  
  const [title, setTitle] = useState(exp.title);
  
  const dateObj = new Date(exp.date);
  const localDateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const [date, setDate] = useState(localDateStr);
  
  const [currency, setCurrency] = useState<'Taka' | 'INR' | 'USD'>(exp.currency as any);
  
  const [tempMemberName, setTempMemberName] = useState('');
  const [tempMembersList, setTempMembersList] = useState<{id: string, name: string}[]>([]);

  const initialPayers = Object.entries(exp.paidBy || {}).map(([memberId, amount]) => ({
    memberId, amount: String(amount)
  }));
  const [payers, setPayers] = useState(initialPayers.length ? initialPayers : [{ memberId: '', amount: '' }]);
  
  const [participants, setParticipants] = useState<string[]>(exp.participants || []);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allAvailableMembers = [...members.filter(m => !m.isTemporary), ...tempMembersList];

  const totalAmount = useMemo(() => {
    return payers.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [payers]);

  const handleAddTemp = async () => {
    if (!tempMemberName.trim()) return;
    setLoading(true);
    try {
      const tempRef = await addDoc(collection(db, 'members'), {
        spaceId: activeSpaceId,
        name: tempMemberName,
        pin: '0000',
        isTemporary: true,
        createdAt: Date.now()
      });
      setTempMembersList([...tempMembersList, { id: tempRef.id, name: tempMemberName }]);
      setTempMemberName('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (id: string) => {
    if (payers.some(p => p.memberId === id)) return;
    setParticipants(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handlePayerChange = (index: number, field: 'memberId' | 'amount', value: string) => {
    const newPayers = [...payers];
    newPayers[index][field] = value;
    setPayers(newPayers);

    if (field === 'memberId' && value && !participants.includes(value)) {
      setParticipants(prev => [...prev, value]);
    }
  };

  const addPayerRow = () => {
    setPayers([...payers, { memberId: '', amount: '' }]);
  };

  const removePayerRow = (index: number) => {
    if (payers.length === 1) return;
    setPayers(payers.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || payers.length === 0 || participants.length === 0) {
      setError('Please fill all required fields');
      return;
    }
    
    if (totalAmount <= 0) {
      setError('Valid amount required');
      return;
    }

    const validPayers = payers.filter(p => p.memberId && parseFloat(p.amount) > 0);
    if (validPayers.length === 0) {
      setError('Please specify at least one payer with a valid amount');
      return;
    }

    const payerIds = validPayers.map(p => p.memberId);
    if (new Set(payerIds).size !== payerIds.length) {
      setError('Duplicate payers are not allowed');
      return;
    }
    
    setLoading(true);
    try {
      const finalParticipants = Array.from(new Set([...participants, ...payerIds]));
      
      const paidByMap: Record<string, number> = {};
      validPayers.forEach(p => {
        paidByMap[p.memberId] = parseFloat(p.amount);
      });

      await updateDoc(doc(db, 'expenses', exp.id), {
        title,
        date: new Date(date).getTime(),
        currency,
        paidBy: paidByMap,
        participants: finalParticipants,
        totalAmount,
        updatedAt: Date.now()
      });

      const currentMember = members.find(m => m.id === activeIdentityId);
      const actorName = currentMember?.name || user?.displayName || 'Someone';

      await addDoc(collection(db, 'notifications'), {
        spaceId: activeSpaceId,
        type: 'expense_updated',
        actorName,
        message: `updated expense "${title}" to ${totalAmount} ${currency}`,
        timestamp: Date.now()
      });

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currencySymbol = currency === 'Taka' ? '৳' : currency === 'INR' ? '₹' : '$';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="glass-panel w-full max-w-md rounded-[2rem] overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-white/10 shrink-0">
          <h2 className="text-xl font-bold">Edit Expense</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass-button flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {error && <div className="p-3 bg-red-500/20 text-red-500 text-sm rounded-xl">{error}</div>}

          <form id="edit-expense-form" onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-[6fr_4fr] gap-3 w-full">
              <div className="w-full min-w-0">
                <label className="block text-xs font-medium mb-1 pl-1 opacity-70">Expense Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="glass-input h-[48px] !py-0 w-full min-w-0 text-sm px-3" placeholder="Dinner" required />
              </div>
              <div className="w-full min-w-0">
                <label className="block text-xs font-medium mb-1 pl-1 opacity-70">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="glass-input h-[48px] !py-0 w-full min-w-0 text-sm px-3 appearance-none box-border" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="w-full min-w-0">
                <label className="block text-xs font-medium mb-1 pl-1 opacity-70">Total Amount</label>
                <div className="glass-input h-[48px] !py-0 w-full min-w-0 bg-white/5 opacity-80 cursor-not-allowed font-bold flex items-center px-3 overflow-hidden text-sm">
                  {totalAmount.toFixed(2)}
                </div>
              </div>
              <div className="w-full min-w-0">
                <label className="block text-xs font-medium mb-1 pl-1 opacity-70">Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value as any)} className="glass-input h-[48px] !py-0 w-full min-w-0 bg-transparent appearance-none font-bold text-center text-sm px-3">
                  <option value="Taka" className="text-black">৳ Taka</option>
                  <option value="INR" className="text-black">₹ INR</option>
                  <option value="USD" className="text-black">$ USD</option>
                </select>
              </div>
            </div>

            <div className="p-3 glass rounded-2xl space-y-2">
              <label className="block text-sm font-bold">Add Temporary Member</label>
              <div className="flex gap-2">
                <input type="text" value={tempMemberName} onChange={e => setTempMemberName(e.target.value)} className="glass-input py-2 flex-1 min-w-0 text-sm px-3" placeholder="Guest Name" />
                <button type="button" onClick={handleAddTemp} disabled={loading || !tempMemberName} className="glass-button py-2 flex-shrink-0 px-3 flex items-center gap-1 text-sm">
                  <UserPlus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            <div className="w-full min-w-0">
              <div className="flex text-xs opacity-70 font-semibold mb-1 uppercase tracking-wider pl-1">
                <div className="flex-1 min-w-0">Paid By</div>
                <div className="w-[100px] text-right pr-2 shrink-0">Amount</div>
                {payers.length > 1 && <div className="w-8 shrink-0"></div>}
              </div>
              <div className="space-y-2 mb-3 w-full min-w-0">
                {payers.map((payer, idx) => (
                  <div key={idx} className="flex gap-2 items-center w-full min-w-0">
                    <div className="flex-1 min-w-0">
                      <select 
                        value={payer.memberId} 
                        onChange={e => handlePayerChange(idx, 'memberId', e.target.value)} 
                        className="glass-input !py-0 w-full min-w-0 bg-transparent appearance-none text-sm px-2 truncate h-[42px]"
                        required
                      >
                        <option value="" disabled className="text-black">Select...</option>
                        {allAvailableMembers.map(m => (
                          <option key={m.id} value={m.id} className="text-black truncate">{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="relative w-[100px] shrink-0 flex items-center">
                      <span className="absolute left-2 opacity-50 font-bold text-sm">{currencySymbol}</span>
                      <input 
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        value={payer.amount} 
                        onChange={e => handlePayerChange(idx, 'amount', e.target.value)} 
                        className="glass-input !py-0 w-full min-w-0 pl-5 pr-1 text-sm h-[42px]" 
                        placeholder="0.00" 
                        required 
                      />
                    </div>
                    {payers.length > 1 && (
                      <button type="button" onClick={() => removePayerRow(idx)} className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-full transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addPayerRow} className="text-sm font-semibold text-blue-500 flex items-center gap-1 hover:opacity-80 transition-opacity pl-1">
                <Plus className="w-4 h-4" /> Add Member
              </button>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 pl-1">Participants</label>
              <div className="grid grid-cols-3 gap-2">
                {allAvailableMembers.map(m => {
                  const isSelected = participants.includes(m.id) || payers.some(p => p.memberId === m.id);
                  const isPayer = payers.some(p => p.memberId === m.id);
                  return (
                    <label 
                      key={m.id} 
                      className={`flex items-center gap-1.5 p-2 rounded-xl border border-white/10 transition-all overflow-hidden ${isPayer ? 'bg-white/5 opacity-80 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'}`}
                    >
                      <input 
                        type="checkbox"
                        className="w-4 h-4 flex-shrink-0 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-blue-500/50"
                        checked={isSelected}
                        onChange={() => toggleParticipant(m.id)}
                        disabled={isPayer}
                      />
                      <span className="text-xs font-medium truncate min-w-0">{m.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t border-white/10 bg-white/5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 glass-button py-3">
             Cancel
          </button>
          <button type="submit" form="edit-expense-form" disabled={loading} className="flex-1 glass-button py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-lg border-none shadow-lg flex justify-center items-center">
             Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
