import React, { useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff, Trash2, Tag } from 'lucide-react';
import { BoardManager } from '../../geometry/board-manager';
import { GeometricElementState, ToolType } from '../../types/geometry';
import { TOOLS } from '../../geometry/tools';
import { KatexView } from '../ui/KatexView';
import { cn } from '../../utils/cn';

interface CanvasProps {
  boardManager: BoardManager | null;
  activeTool: ToolType;
  toolStepMessage: string;
  selectedElement: GeometricElementState | null;
  onUpdateElement: (id: string, updates: any) => void;
  onDeleteElement: (id: string) => void;
}

const PRESET_COLORS = [
  '#1e3a8a', // Deep sapphire/blue
  '#0f172a', // Obsidian slate
  '#dc2626', // Red
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#ec4899', // Pink
];

export const Canvas: React.FC<CanvasProps> = ({
  boardManager,
  activeTool,
  toolStepMessage,
  selectedElement,
  onUpdateElement,
  onDeleteElement,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeDef = TOOLS.find((t) => t.id === activeTool);

  useEffect(() => {
    if (!containerRef.current || !boardManager?.board) return;

    const observer = new ResizeObserver(() => {
      if (boardManager.board) {
        boardManager.board.resizeContainer(
          containerRef.current?.clientWidth || 800,
          containerRef.current?.clientHeight || 600
        );
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [boardManager]);

  const handleZoomIn = () => {
    boardManager?.board?.zoomIn();
  };

  const handleZoomOut = () => {
    boardManager?.board?.zoomOut();
  };

  const handleResetView = () => {
    if (boardManager?.board) {
      boardManager.board.setBoundingBox([-10, 10, 10, -10], true);
      boardManager.board.fullUpdate();
    }
  };

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden bg-white select-none">
      {/* JSXGraph Canvas Host */}
      <div
        id="jxgbox"
        ref={containerRef}
        className={cn(
          'jxgbox w-full h-full outline-none',
          activeTool === 'select' ? 'cursor-default' : 'cursor-crosshair'
        )}
        style={{ overflow: 'hidden' }}
      />

      {/* Top Floating Instruction (Short, minimal) */}
      {toolStepMessage && activeTool !== 'select' && (
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 pointer-events-none z-20">
          <div className="bg-slate-900/80 backdrop-blur-sm text-white text-[11px] font-medium px-3 py-1 rounded-full shadow border border-slate-700/40 animate-in fade-in duration-100">
            {toolStepMessage}
          </div>
        </div>
      )}

      {/* Selected Element Quick Property Bar */}
      {selectedElement && (
        <div className="absolute top-2.5 left-4 z-20 bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg shadow-md p-1.5 flex items-center gap-2.5 animate-in fade-in duration-100">
          <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
            {selectedElement.latex ? (
              <span className="text-xs font-serif text-slate-900">
                <KatexView math={selectedElement.latex} />
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-800">{selectedElement.name}</span>
            )}
          </div>

          {/* Color palette */}
          <div className="flex items-center gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onUpdateElement(selectedElement.id, { color: c })}
                style={{ backgroundColor: c }}
                className={cn(
                  'w-3.5 h-3.5 rounded-full border border-black/10 transition-transform hover:scale-110',
                  selectedElement.color.toLowerCase() === c.toLowerCase() && 'ring-2 ring-blue-500 scale-110'
                )}
                title={c}
              />
            ))}
          </div>

          {/* Visibility toggle */}
          <button
            onClick={() => onUpdateElement(selectedElement.id, { visible: !selectedElement.visible })}
            title={selectedElement.visible ? 'Hide' : 'Show'}
            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
          >
            {selectedElement.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* Delete */}
          <button
            onClick={() => onDeleteElement(selectedElement.id)}
            title="Delete"
            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Right Zoom / Home Controls */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg p-1 shadow-sm">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          title="Reset View"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            boardManager?.autoArrangeLabels();
            boardManager?.board?.fullUpdate();
          }}
          title="Arrange Labels"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        >
          <Tag className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
