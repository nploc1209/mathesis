import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BoardManager } from './geometry/board-manager';
import { AIGeometryEngine } from './geometry/ai-engine';
import { Header } from './components/Header';
import { Toolbar } from './components/toolbar/Toolbar';
import { Canvas } from './components/canvas/Canvas';
import { ObjectPanel } from './components/object-panel/ObjectPanel';
import { AISidebar } from './components/ai-sidebar/AISidebar';
import { ProjectModal } from './components/modals/ProjectModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { InputModal } from './components/modals/InputModal';
import {
  ToolType,
  GeometricElementState,
  BoardSettings,
  ProjectData,
  AIConstructionProposal,
} from './types/geometry';
import {
  saveProject,
  saveDraft,
  loadDraft,
} from './storage/db';
import { downloadGGB, downloadPNG, downloadSVG, downloadPDF } from './geometry/export';
import { importGgbFile } from './geometry/geogebra';
import { parseAndExecuteAlgebraInput } from './utils/equation-parser';

const DEFAULT_SETTINGS: BoardSettings = {
  showAxes: true,
  showGrid: true,
  snapToGrid: false,
  gridSnapSize: 1,
  boundingBox: [-10, 10, 10, -10],
  theme: 'light',
};

export const App: React.FC = () => {
  // Board & AI Engine instances
  const boardManagerRef = useRef<BoardManager | null>(null);
  const aiEngineRef = useRef<AIGeometryEngine | null>(null);

  // Geometry State
  const [elements, setElements] = useState<GeometricElementState[]>([]);
  const [selectedElement, setSelectedElement] = useState<GeometricElementState | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [toolStepMessage, setToolStepMessage] = useState<string>('');

  // Project State
  const [project, setProject] = useState<ProjectData>({
    id: `proj_${Date.now()}`,
    title: 'Mathesis',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: '1.0.0',
    settings: DEFAULT_SETTINGS,
    steps: [],
  });
  const [isAutosaved, setIsAutosaved] = useState(true);

  // Settings
  const [settings, setSettings] = useState<BoardSettings>(DEFAULT_SETTINGS);

  // UI Panels State
  const [isObjectPanelOpen, setIsObjectPanelOpen] = useState(true);
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(false);

  // Modals State
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [inputModalState, setInputModalState] = useState<{
    isOpen: boolean;
    title: string;
    prompt: string;
    defaultValue: string | number;
    type?: 'number' | 'text';
    resolve?: (val: string | number | null) => void;
  }>({
    isOpen: false,
    title: '',
    prompt: '',
    defaultValue: '',
  });

  // Request input callback for BoardManager
  const handleRequestInput = useCallback(
    (title: string, prompt: string, defaultValue: string | number, type: 'number' | 'text' = 'number') => {
      return new Promise<string | number | null>((resolve) => {
        setInputModalState({
          isOpen: true,
          title,
          prompt,
          defaultValue,
          type,
          resolve,
        });
      });
    },
    []
  );

  // Initialize BoardManager
  useEffect(() => {
    const manager = new BoardManager('jxgbox', settings, {
      onElementsChange: (els) => {
        setElements([...els]);
        setIsAutosaved(false);
      },
      onSelectedElementChange: (el) => {
        setSelectedElement(el);
      },
      onToolStep: (msg) => {
        setToolStepMessage(msg);
      },
      onToolComplete: () => {
        setToolStepMessage('');
      },
      onRequestInput: handleRequestInput,
    });

    manager.init();
    boardManagerRef.current = manager;
    aiEngineRef.current = new AIGeometryEngine(manager);

    // Try loading last saved draft
    loadDraft().then((draft) => {
      if (draft) {
        if (!draft.title || draft.title === 'Untitled' || draft.title.startsWith('Untitled')) {
          draft.title = 'Mathesis';
        }
        setProject(draft);
        if (draft.settings) {
          setSettings(draft.settings);
          manager.updateSettings(draft.settings);
        }
      }
    });

    return () => {
      // Board cleanup handled by BoardManager
    };
  }, [handleRequestInput]);

  // Autosave to IndexedDB with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (project) {
        await saveDraft({
          ...project,
          settings,
          updatedAt: Date.now(),
        });
        setIsAutosaved(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [elements, project, settings]);

  // Handle Tool Selection
  const handleSelectTool = (tool: ToolType) => {
    setActiveTool(tool);
    setToolStepMessage('');
    if (boardManagerRef.current) {
      boardManagerRef.current.setTool(tool);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'Escape') {
        handleSelectTool('select');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElement && boardManagerRef.current) {
          boardManagerRef.current.deleteElement(selectedElement.id);
        }
      } else if (e.key.toLowerCase() === 'm') {
        handleSelectTool('select');
      } else if (e.key.toLowerCase() === 'p') {
        handleSelectTool('point');
      } else if (e.key.toLowerCase() === 's') {
        handleSelectTool('segment');
      } else if (e.key.toLowerCase() === 'c') {
        handleSelectTool('circle_2p');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement]);

  // Element actions
  const handleUpdateElement = (id: string, updates: any) => {
    if (boardManagerRef.current) {
      boardManagerRef.current.updateElementProperties(id, updates);
    }
  };

  const handleDeleteElement = (id: string) => {
    if (boardManagerRef.current) {
      boardManagerRef.current.deleteElement(id);
    }
  };

  // Algebra Input execution (at top of ObjectPanel)
  const handleSubmitAlgebraInput = (input: string): boolean => {
    if (!boardManagerRef.current) return false;
    return parseAndExecuteAlgebraInput(input, boardManagerRef.current);
  };

  // Clear Canvas
  const handleClearCanvas = () => {
    if (elements.length === 0) return;
    if (window.confirm('Clear canvas?')) {
      boardManagerRef.current?.clearAll();
      setSelectedElement(null);
    }
  };

  // Save Project
  const handleSaveProject = async () => {
    const currentData: ProjectData = {
      ...project,
      settings,
      updatedAt: Date.now(),
    };
    await saveProject(currentData);
    setProject(currentData);
    setIsAutosaved(true);
  };

  // New Blank Project
  const handleNewProject = () => {
    if (elements.length > 0 && !window.confirm('Start new construction?')) {
      return;
    }
    boardManagerRef.current?.clearAll();
    const newProj: ProjectData = {
      id: `proj_${Date.now()}`,
      title: 'Mathesis',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      settings: DEFAULT_SETTINGS,
      steps: [],
    };
    setProject(newProj);
    setSettings(DEFAULT_SETTINGS);
    boardManagerRef.current?.updateSettings(DEFAULT_SETTINGS);
    setSelectedElement(null);
  };

  // Open Project
  const handleOpenProject = (proj: ProjectData) => {
    boardManagerRef.current?.clearAll();
    setProject(proj);
    if (proj.settings) {
      setSettings(proj.settings);
      boardManagerRef.current?.updateSettings(proj.settings);
    }
    setSelectedElement(null);
  };

  // Import GeoGebra file
  const handleImportGgb = async (file: File) => {
    if (!boardManagerRef.current?.board) return;
    const result = await importGgbFile(file, boardManagerRef.current.board);
    if (result.success) {
      setProject((prev) => ({
        ...prev,
        title: file.name.replace(/\.ggb$/i, ''),
      }));
    } else {
      alert(`Import error: ${result.error}`);
    }
  };

  // Exports
  const handleExportGGB = async () => {
    if (boardManagerRef.current?.board) {
      await downloadGGB(boardManagerRef.current.board, `${project.title || 'construction'}.ggb`);
    }
  };

  const handleExportPNG = async () => {
    if (boardManagerRef.current?.board) {
      await downloadPNG(boardManagerRef.current.board, `${project.title || 'construction'}.png`);
    }
  };

  const handleExportSVG = () => {
    if (boardManagerRef.current?.board) {
      downloadSVG(boardManagerRef.current.board, `${project.title || 'construction'}.svg`);
    }
  };

  const handleExportPDF = async () => {
    if (boardManagerRef.current?.board) {
      await downloadPDF(
        boardManagerRef.current.board,
        `${project.title || 'construction'}.pdf`,
        project.title
      );
    }
  };

  // Update Settings
  const handleUpdateSettings = (newSettings: Partial<BoardSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      boardManagerRef.current?.updateSettings(updated);
      return updated;
    });
  };

  // AI Proposal Execution
  const handleExecuteProposal = (proposal: AIConstructionProposal) => {
    if (aiEngineRef.current) {
      aiEngineRef.current.executeProposal(proposal);
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-white text-slate-900 font-sans">
      {/* Top Header */}
      <Header
        projectTitle={project.title}
        onUpdateTitle={(title) => setProject((prev) => ({ ...prev, title }))}
        isAutosaved={isAutosaved}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        onOpenProjectsModal={() => setIsProjectsModalOpen(true)}
        onSaveProject={handleSaveProject}
        onNewProject={handleNewProject}
        onImportGgb={handleImportGgb}
        onExportGGB={handleExportGGB}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        onExportPDF={handleExportPDF}
        onClearCanvas={handleClearCanvas}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        isObjectPanelOpen={isObjectPanelOpen}
        onToggleObjectPanel={() => setIsObjectPanelOpen(!isObjectPanelOpen)}
        isAISidebarOpen={isAISidebarOpen}
        onToggleAISidebar={() => setIsAISidebarOpen(!isAISidebarOpen)}
      />

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Left: Grouped Toolbar */}
        <Toolbar
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
        />

        {/* Collapsible Object Panel (Algebra View with Top Input) */}
        <ObjectPanel
          elements={elements}
          selectedElement={selectedElement}
          onSelectElement={(id) => {
            const el = id && boardManagerRef.current?.board ? (boardManagerRef.current.board.objects[id] as any) : null;
            boardManagerRef.current?.selectObjectForInspector(el || null);
          }}
          onUpdateElement={handleUpdateElement}
          onDeleteElement={handleDeleteElement}
          onSubmitAlgebraInput={handleSubmitAlgebraInput}
          isOpen={isObjectPanelOpen}
          onToggleOpen={() => setIsObjectPanelOpen(!isObjectPanelOpen)}
        />

        {/* Center: Canvas */}
        <Canvas
          boardManager={boardManagerRef.current}
          activeTool={activeTool}
          toolStepMessage={toolStepMessage}
          selectedElement={selectedElement}
          onUpdateElement={handleUpdateElement}
          onDeleteElement={handleDeleteElement}
        />

        {/* Right: AI Sidebar */}
        <AISidebar
          aiEngine={aiEngineRef.current}
          isOpen={isAISidebarOpen}
          onToggleOpen={() => setIsAISidebarOpen(false)}
          onExecuteProposal={handleExecuteProposal}
        />
      </main>

      {/* Modals */}
      <ProjectModal
        isOpen={isProjectsModalOpen}
        currentProjectId={project.id}
        onClose={() => setIsProjectsModalOpen(false)}
        onOpenProject={handleOpenProject}
        onNewProject={handleNewProject}
        onSaveCurrent={handleSaveProject}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      <InputModal
        isOpen={inputModalState.isOpen}
        title={inputModalState.title}
        prompt={inputModalState.prompt}
        defaultValue={inputModalState.defaultValue}
        type={inputModalState.type}
        onConfirm={(val) => {
          inputModalState.resolve?.(val);
          setInputModalState((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => {
          inputModalState.resolve?.(null);
          setInputModalState((prev) => ({ ...prev, isOpen: false }));
        }}
      />
    </div>
  );
};

export default App;
