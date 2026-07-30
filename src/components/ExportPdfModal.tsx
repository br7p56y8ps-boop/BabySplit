import React, { useState } from 'react';
import { FileText, CheckCircle2, Clock, Layers, X, Download } from 'lucide-react';
import { Space, Member, Expense } from '../types';
import { exportSpaceDataToPDF } from '../lib/pdfExporter';

interface ExportPdfModalProps {
  space: Space;
  members: Member[];
  expenses: Expense[];
  onClose: () => void;
}

export default function ExportPdfModal({ space, members, expenses, onClose }: {
  space: Space;
  members: Member[];
  expenses: Expense[];
  onClose: () => void;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = (filter: 'all' | 'settled' | 'unsettled') => {
    setIsExporting(true);
    try {
      exportSpaceDataToPDF(space, members, expenses, filter);
      onClose();
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-md p-6 rounded-3xl relative space-y-5 border border-white/20 shadow-2xl">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 glass-button rounded-full opacity-70 hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Export PDF Report</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Choose which expenses to include</p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={() => handleExport('all')}
            disabled={isExporting}
            className="w-full p-4 glass-button rounded-2xl flex items-center justify-between hover:bg-blue-500/10 hover:border-blue-500/30 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-400 transition-colors">Export All</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">All settled and unsettled expenses ({expenses.length})</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-400" />
          </button>

          <button
            onClick={() => handleExport('settled')}
            disabled={isExporting}
            className="w-full p-4 glass-button rounded-2xl flex items-center justify-between hover:bg-green-500/10 hover:border-green-500/30 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-green-400 transition-colors">Export Settled Only</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Only fully settled expenses</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400 group-hover:text-green-400" />
          </button>

          <button
            onClick={() => handleExport('unsettled')}
            disabled={isExporting}
            className="w-full p-4 glass-button rounded-2xl flex items-center justify-between hover:bg-amber-500/10 hover:border-amber-500/30 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-amber-400 transition-colors">Export Unsettled Only</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Active and partially settled expenses</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400 group-hover:text-amber-400" />
          </button>
        </div>

        <div className="pt-2 text-center">
          <button 
            onClick={onClose} 
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
