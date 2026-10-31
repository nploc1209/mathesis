import React, { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { ProjectData } from '../../types/geometry';
import { listProjects, deleteProject, duplicateProject } from '../../storage/db';
import { Plus, Trash2, Copy, FolderOpen, Calendar } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  currentProjectId?: string;
  onClose: () => void;
  onOpenProject: (project: ProjectData) => void;
  onNewProject: () => void;
  onSaveCurrent: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  currentProjectId,
  onClose,
  onOpenProject,
  onNewProject,
  onSaveCurrent,
}) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadList = async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadList();
    }
  }, [isOpen]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete project?')) {
      await deleteProject(id);
      await loadList();
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await duplicateProject(id);
    await loadList();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Projects" maxWidth="md">
      <div className="space-y-3">
        <div className="flex gap-2 justify-between">
          <button
            onClick={() => {
              onNewProject();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>

          <button
            onClick={() => {
              onSaveCurrent();
              loadList();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Save Current
          </button>
        </div>

        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto rounded-lg border border-slate-200">
          {loading ? (
            <div className="p-6 text-center text-slate-400 text-xs">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              <FolderOpen className="w-6 h-6 mx-auto text-slate-300 mb-1" />
              No saved projects yet.
            </div>
          ) : (
            projects.map((proj) => {
              const isCurrent = proj.id === currentProjectId;
              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    onOpenProject(proj);
                    onClose();
                  }}
                  className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                    isCurrent ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800 text-xs truncate">{proj.title}</span>
                      {isCurrent && (
                        <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(proj.updatedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDuplicate(e, proj.id)}
                      title="Duplicate"
                      className="p-1 text-slate-400 hover:text-slate-700 rounded"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, proj.id)}
                      title="Delete"
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
};
