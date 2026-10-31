import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer2,
  CircleDot,
  Crosshair,
  BetweenHorizontalStart,
  Minus,
  MoveHorizontal,
  ArrowRight,
  ArrowUpRight,
  CornerDownRight,
  AlignJustify,
  Split,
  GitFork,
  CircleSlash,
  Square as PolygonIcon,
  Hexagon,
  Circle as CircleIcon,
  Target,
  PieChart,
  FlipHorizontal,
  RotateCcw,
  Move,
  Maximize2,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import { ToolType, ToolCategory } from '../../types/geometry';
import { TOOLS, TOOL_CATEGORIES } from '../../geometry/tools';
import { cn } from '../../utils/cn';

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  MousePointer2,
  CircleDot,
  Crosshair,
  BetweenHorizontalStart,
  Minus,
  MoveHorizontal,
  ArrowRight,
  ArrowUpRight,
  CornerDownRight,
  AlignJustify,
  Split,
  GitFork,
  CircleSlash,
  Polygon: PolygonIcon,
  Hexagon,
  Circle: CircleIcon,
  Target,
  PieChart,
  FlipHorizontal,
  RotateCcw,
  Move,
  Maximize2,
  SlidersHorizontal,
  Type,
};

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onSelectTool }) => {
  const [openCategory, setOpenCategory] = useState<ToolCategory | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenCategory(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <aside
      ref={toolbarRef}
      aria-label="Toolbar"
      className="relative z-30 flex flex-col items-center bg-white border-r border-slate-200/90 shadow-xs select-none py-1.5 px-1 w-12"
    >
      <div className="flex flex-col gap-1 w-full">
        {TOOL_CATEGORIES.map((cat) => {
          const categoryTools = TOOLS.filter((t) => t.category === cat.id);
          const hasActiveTool = categoryTools.some((t) => t.id === activeTool);
          const isOpen = openCategory === cat.id;

          const displayedTool = hasActiveTool
            ? categoryTools.find((t) => t.id === activeTool)!
            : categoryTools[0];
          const DisplayedIcon = ICON_MAP[displayedTool.icon] || CircleDot;

          return (
            <div key={cat.id} className="relative group">
              <button
                onClick={() => {
                  if (categoryTools.length === 1) {
                    onSelectTool(categoryTools[0].id);
                    setOpenCategory(null);
                  } else {
                    setOpenCategory(isOpen ? null : cat.id);
                  }
                }}
                title={displayedTool.name}
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center transition-all relative',
                  hasActiveTool
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  isOpen && !hasActiveTool && 'bg-slate-100 text-slate-900'
                )}
              >
                <DisplayedIcon className="w-4 h-4 stroke-[2]" />

                {categoryTools.length > 1 && (
                  <span
                    className={cn(
                      'absolute bottom-1 right-1 w-1 h-1 rounded-full',
                      hasActiveTool ? 'bg-white' : 'bg-slate-400'
                    )}
                  />
                )}
              </button>

              {/* Flyout Submenu (Clean, short titles only, no long descriptions) */}
              {isOpen && (
                <div className="absolute left-full top-0 ml-1.5 bg-white rounded-lg shadow-lg border border-slate-200 p-1 min-w-[150px] z-50 animate-in fade-in duration-100">
                  <div className="flex flex-col gap-0.5">
                    {categoryTools.map((t) => {
                      const SubIcon = ICON_MAP[t.icon] || CircleDot;
                      const isSubActive = t.id === activeTool;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            onSelectTool(t.id);
                            setOpenCategory(null);
                          }}
                          className={cn(
                            'flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-xs transition-colors w-full font-medium',
                            isSubActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          <SubIcon
                            className={cn(
                              'w-3.5 h-3.5 shrink-0',
                              isSubActive ? 'text-blue-600' : 'text-slate-500'
                            )}
                          />
                          <span>{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
