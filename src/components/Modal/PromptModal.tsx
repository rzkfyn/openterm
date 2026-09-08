import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  isDanger?: boolean;
  isConfirmOnly?: boolean;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  title,
  message,
  initialValue = '',
  placeholder = '',
  confirmLabel = 'Confirm',
  isDanger = false,
  isConfirmOnly = false,
  onConfirm,
  onClose,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
    if (isOpen && !isConfirmOnly) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialValue, isConfirmOnly]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmOnly && !value.trim()) return;
    onConfirm(value.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 p-4">
      <div className="w-full max-w-sm rounded-lg bg-[#1a1a26] border border-[#2e2f42] p-4 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-[#2e2f42]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-[#252636] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          {message && <p className="text-xs text-slate-300 leading-relaxed">{message}</p>}

          {!isConfirmOnly && (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded bg-[#11111a] border border-[#2e2f42] px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden font-mono"
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-xs rounded bg-[#252636] hover:bg-[#2e3046] text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-3 py-1 text-xs font-medium rounded text-white transition-colors ${
                isDanger
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
