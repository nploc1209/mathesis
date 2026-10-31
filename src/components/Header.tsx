import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Save,
  Download,
  Upload,
  Undo2,
  Redo2,
  Settings,
  Sparkles,
  Layers,
  Trash2,
  FileCode,
  FileText,
  Image,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface HeaderProps {
  projectTitle: string;
  onUpdateTitle: (title: string) => void;
  isAutosaved: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenProjectsModal: () => void;
  onSaveProject: () => void;
  onNewProject: () => void;
  onImportGgb: (file: File) => void;
  onExportGGB: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportPDF: () => void;
  onClearCanvas: () => void;
  onOpenSettings: () => void;
  isObjectPanelOpen: boolean;
  onToggleObjectPanel: () => void;
  isAISidebarOpen: boolean;
  onToggleAISidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectTitle,
  onUpdateTitle,
  isAutosaved,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenProjectsModal,
  onSaveProject,
  onNewProject,
  onImportGgb,
  onExportGGB,
  onExportPNG,
  onExportSVG,
  onExportPDF,
  onClearCanvas,
  onOpenSettings,
  isObjectPanelOpen,
  onToggleObjectPanel,
  isAISidebarOpen,
  onToggleAISidebar,
}) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectTitle);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleInput(projectTitle);
  }, [projectTitle]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleTitleSubmit = () => {
    if (titleInput.trim()) {
      onUpdateTitle(titleInput.trim());
    } else {
      setTitleInput(projectTitle);
    }
    setIsEditingTitle(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportGgb(file);
    }
  };

  return (
    <header className="h-11 border-b border-slate-200/90 bg-white px-3 flex items-center justify-between z-30 select-none">
      {/* Left: Editable Title only (Logo removed) */}
      <div className="flex items-center gap-2">
        {isEditingTitle ? (
          <input
            type="text"
            value={titleInput}
            autoFocus
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit();
              if (e.key === 'Escape') {
                setTitleInput(projectTitle);
                setIsEditingTitle(false);
              }
            }}
            onChange={(e) => setTitleInput(e.target.value)}
            className="text-xs font-semibold px-2 py-0.5 border border-blue-400 rounded bg-white text-slate-900 focus:outline-none w-36 sm:w-44"
          />
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            title="Rename"
            className="text-xs font-semibold text-slate-800 hover:text-blue-600 px-1.5 py-1 rounded transition-colors truncate max-w-[140px] sm:max-w-xs"
          >
            {projectTitle}
          </button>
        )}

        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full transition-colors',
            isAutosaved ? 'bg-emerald-500' : 'bg-amber-400'
          )}
          title={isAutosaved ? 'Saved' : 'Saving...'}
        />
      </div>

      {/* Middle: Actions */}
      <div className="flex items-center gap-1" ref={menuRef}>
        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className={cn(
            'p-1.5 rounded text-slate-600 transition-colors',
            canUndo ? 'hover:bg-slate-100 hover:text-slate-900' : 'opacity-30 cursor-not-allowed'
          )}
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className={cn(
            'p-1.5 rounded text-slate-600 transition-colors',
            canRedo ? 'hover:bg-slate-100 hover:text-slate-900' : 'opacity-30 cursor-not-allowed'
          )}
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        {/* Files / Open */}
        <button
          onClick={onOpenProjectsModal}
          title="Projects"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        {/* Save */}
        <button
          onClick={onSaveProject}
          title="Save"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        >
          <Save className="w-4 h-4" />
        </button>

        {/* Import .ggb */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Import .ggb"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        >
          <Upload className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ggb"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Export Dropdown (.ggb, .png, .svg, .pdf) */}
        <div className="relative">
          <button
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            title="Export"
            className="flex items-center gap-0.5 p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors text-xs font-medium"
          >
            <Download className="w-4 h-4" />
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isExportMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[150px] z-50">
              <button
                onClick={() => {
                  onExportGGB();
                  setIsExportMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 w-full text-left"
              >
                <FileCode className="w-3.5 h-3.5 text-blue-600" />
                <span>GeoGebra (.ggb)</span>
              </button>

              <button
                onClick={() => {
                  onExportPNG();
                  setIsExportMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 w-full text-left"
              >
                <Image className="w-3.5 h-3.5 text-emerald-600" />
                <span>PNG Image (.png)</span>
              </button>

              <button
                onClick={() => {
                  onExportSVG();
                  setIsExportMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 w-full text-left"
              >
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>SVG Vector (.svg)</span>
              </button>

              <button
                onClick={() => {
                  onExportPDF();
                  setIsExportMenuOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 w-full text-left"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span>PDF Document (.pdf)</span>
              </button>
            </div>
          )}
        </div>

        {/* Clear */}
        <button
          onClick={onClearCanvas}
          title="Clear"
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Panels & Settings */}
      <div className="flex items-center gap-1">

        {/* Toggle AI Sidebar */}
        <button
          onClick={onToggleAISidebar}
          title="Draw with AI"
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shadow-xs',
            isAISidebarOpen
              ? 'bg-blue-600 text-white shadow-blue-200 ring-2 ring-blue-400/40'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>Draw with AI</span>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
