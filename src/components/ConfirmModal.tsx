import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel rounded-3xl p-6 max-w-sm w-full space-y-4 border border-white/20 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${isDanger ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-blue-500/20 text-blue-500 border border-blue-500/30'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg">{title}</h3>
        </div>

        <p className="text-sm opacity-80 leading-relaxed">{message}</p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 glass-button py-2.5 text-sm font-bold text-gray-300 hover:bg-white/10"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 glass-button py-2.5 text-sm font-bold ${
              isDanger
                ? 'bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/30'
                : 'bg-blue-500/20 text-blue-500 border-blue-500/30 hover:bg-blue-500/30'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
