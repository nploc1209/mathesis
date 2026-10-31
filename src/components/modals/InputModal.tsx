import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';

interface InputModalProps {
  isOpen: boolean;
  title: string;
  prompt: string;
  defaultValue: string | number;
  type?: 'number' | 'text';
  onConfirm: (val: string | number) => void;
  onCancel: () => void;
}

export const InputModal: React.FC<InputModalProps> = ({
  isOpen,
  title,
  prompt,
  defaultValue,
  type = 'number',
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState<string>(String(defaultValue));

  useEffect(() => {
    setValue(String(defaultValue));
  }, [defaultValue, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'number') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        onConfirm(num);
      }
    } else {
      onConfirm(value);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onCancel} title={title} maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{prompt}</label>
          <input
            type={type === 'number' ? 'number' : 'text'}
            step={type === 'number' ? 'any' : undefined}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            OK
          </button>
        </div>
      </form>
    </Dialog>
  );
};
