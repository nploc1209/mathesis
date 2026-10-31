import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
} from 'lucide-react';
import { GeometricElementState } from '../../types/geometry';
import { KatexView } from '../ui/KatexView';
import { cn } from '../../utils/cn';

interface ObjectPanelProps {
  elements: GeometricElementState[];
  selectedElement: GeometricElementState | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: any) => void;
  onDeleteElement: (id: string) => void;
  onSubmitAlgebraInput: (input: string) => boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const ObjectPanel: React.FC<ObjectPanelProps> = ({
  elements,
  selectedElement,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onSubmitAlgebraInput,
  isOpen,
  onToggleOpen,
}) => {
  const [algebraInput, setAlgebraInput] = useState('');
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editX, setEditX] = useState('');
  const [editY, setEditY] = useState('');

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!algebraInput.trim()) return;
    const success = onSubmitAlgebraInput(algebraInput);
    if (success) {
      setAlgebraInput('');
    }
  };

  const handleStartEditPoint = (item: GeometricElementState) => {
    if (item.coords && item.isFree) {
      setEditingPointId(item.id);
      setEditX(String(item.coords[0].toFixed(2)));
      setEditY(String(item.coords[1].toFixed(2)));
    }
  };

  const handleSaveEditPoint = (id: string) => {
    const x = parseFloat(editX);
    const y = parseFloat(editY);
    if (!isNaN(x) && !isNaN(y)) {
      onUpdateElement(id, { coords: [x, y] });
    }
    setEditingPointId(null);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={onToggleOpen}
          title="Open Algebra"
          className="absolute left-12 top-2 z-20 bg-white/95 backdrop-blur-sm border border-slate-200/90 shadow-xs p-1.5 rounded-r-md text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <aside
        aria-label="Algebra Objects"
        className={cn(
          'relative z-20 flex flex-col bg-white border-r border-slate-200/90 shadow-sm transition-all duration-200 select-none',
          isOpen ? 'w-64 sm:w-72' : 'w-0 border-r-0 overflow-hidden'
        )}
      >
      {/* Top Header & Collapse Button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/60">
        <span className="font-semibold text-xs tracking-wider uppercase text-slate-500">
          Algebra
        </span>
        <button
          onClick={onToggleOpen}
          title="Collapse"
          className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200/60 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Input bar at the TOP of sidebar */}
      <form onSubmit={handleInputSubmit} className="p-2 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
          <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="A=(1,2) or y=2x+1"
            value={algebraInput}
            onChange={(e) => setAlgebraInput(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none font-mono"
          />
        </div>
      </form>

      {/* Objects list (Minimalist, math-first, zero boilerplate words) */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {elements.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">Empty</div>
        ) : (
          elements.map((item) => {
            const isSelected = selectedElement?.id === item.id;
            const isEditing = editingPointId === item.id;

            return (
              <div
                key={item.id}
                onClick={() => onSelectElement(isSelected ? null : item.id)}
                className={cn(
                  'group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer border',
                  isSelected
                    ? 'bg-blue-50/80 border-blue-200 text-blue-900 shadow-xs'
                    : 'bg-white border-transparent hover:bg-slate-50 text-slate-800'
                )}
              >
                {/* Left: Swatch & Equation/Coordinates */}
                <div className="flex items-center gap-2 min-w-0 pr-1 flex-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                    style={{ backgroundColor: item.color }}
                  />

                  {isEditing ? (
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[11px] font-bold text-slate-800">{item.name} = (</span>
                      <input
                        type="number"
                        step="any"
                        value={editX}
                        onChange={(e) => setEditX(e.target.value)}
                        className="w-12 px-1 py-0.5 text-xs border border-blue-400 rounded bg-white text-slate-800"
                      />
                      <span className="text-[11px] text-slate-400">,</span>
                      <input
                        type="number"
                        step="any"
                        value={editY}
                        onChange={(e) => setEditY(e.target.value)}
                        className="w-12 px-1 py-0.5 text-xs border border-blue-400 rounded bg-white text-slate-800"
                      />
                      <span className="text-[11px] text-slate-400">)</span>
                      <button
                        onClick={() => handleSaveEditPoint(item.id)}
                        className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'text-xs truncate font-serif text-slate-900',
                        item.isFree && 'hover:text-blue-600 cursor-text'
                      )}
                      onClick={(e) => {
                        if (item.isFree && item.coords) {
                          e.stopPropagation();
                          handleStartEditPoint(item);
                        }
                      }}
                    >
                      {item.latex ? (
                        <KatexView math={item.latex} />
                      ) : (
                        item.valueString
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Visibility & Delete */}
                <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateElement(item.id, { visible: !item.visible });
                    }}
                    title={item.visible ? 'Hide' : 'Show'}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                  >
                    {item.visible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteElement(item.id);
                    }}
                    title="Delete"
                    className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
    </>
  );
};
