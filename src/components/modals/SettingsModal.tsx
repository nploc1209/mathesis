import React from 'react';
import { Dialog } from '../ui/Dialog';
import { BoardSettings } from '../../types/geometry';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BoardSettings;
  onUpdateSettings: (settings: Partial<BoardSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Settings" maxWidth="sm">
      <div className="space-y-4">
        {/* Canvas Display */}
        <div className="space-y-2">
          <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <span className="text-xs font-medium text-slate-800">Axes</span>
            <input
              type="checkbox"
              checked={settings.showAxes}
              onChange={(e) => onUpdateSettings({ showAxes: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <span className="text-xs font-medium text-slate-800">Grid</span>
            <input
              type="checkbox"
              checked={settings.showGrid}
              onChange={(e) => onUpdateSettings({ showGrid: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <span className="text-xs font-medium text-slate-800">Snap to Grid</span>
            <input
              type="checkbox"
              checked={settings.snapToGrid}
              onChange={(e) => onUpdateSettings({ snapToGrid: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
};
