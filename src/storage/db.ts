import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ProjectData } from '../types/geometry';

interface MathesisDB extends DBSchema {
  projects: {
    key: string;
    value: ProjectData;
    indexes: { 'by-updated': number };
  };
  draft: {
    key: string;
    value: ProjectData;
  };
}

const DB_NAME = 'mathesis_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MathesisDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<MathesisDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MathesisDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('draft')) {
          db.createObjectStore('draft', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveProject(project: ProjectData): Promise<void> {
  const db = await getDB();
  project.updatedAt = Date.now();
  await db.put('projects', project);
}

export async function getProject(id: string): Promise<ProjectData | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function listProjects(): Promise<ProjectData[]> {
  const db = await getDB();
  const tx = db.transaction('projects', 'readonly');
  const index = tx.store.index('by-updated');
  const results = await index.getAll();
  // Return sorted newest first
  return results.reverse();
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
}

export async function duplicateProject(id: string): Promise<ProjectData | null> {
  const original = await getProject(id);
  if (!original) return null;
  const duplicate: ProjectData = {
    ...original,
    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: `${original.title} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveProject(duplicate);
  return duplicate;
}

export async function saveDraft(project: ProjectData): Promise<void> {
  const db = await getDB();
  await db.put('draft', { ...project, id: 'current_draft', updatedAt: Date.now() });
}

export async function loadDraft(): Promise<ProjectData | null> {
  const db = await getDB();
  const draft = await db.get('draft', 'current_draft');
  return draft || null;
}
