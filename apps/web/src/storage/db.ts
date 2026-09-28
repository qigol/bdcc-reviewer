import Dexie, { type Table } from 'dexie';

export type Tab = 'intuition' | 'math-code' | 'application' | 'quiz';
export interface Progress {
  moduleId: string;
  tab: Tab;
  itemId: string;
  status: 'seen' | 'done';
  beatIndex?: number;
  moduleVersion?: string;
  updatedAt: number;
}
export interface Attempt {
  id?: number;
  key: string; // moduleId/templateId
  templateId: string;
  moduleId: string;
  seed: number;
  type: string;
  skills: string[];
  score: number;
  response: unknown;
  timeMs: number;
  mode: string;
  at: number;
  difficulty?: number;
}
export interface Srs { templateId: string; moduleId: string; ease: number; interval: number; due: number; reps: number; lapses: number; updatedAt: number }
export interface Mastery { skillKey: string; score: number; n: number; updatedAt: number }
export interface Note { id?: number; moduleId: string; anchor: string; text: string; createdAt: number; updatedAt?: number }
export interface Bookmark { moduleId: string; ref: string; label: string; createdAt: number }
export interface Setting { key: string; value: unknown; updatedAt?: number }

export class KodigoDB extends Dexie {
  progress!: Table<Progress, [string, string, string]>;
  attempts!: Table<Attempt, number>;
  srs!: Table<Srs, string>;
  mastery!: Table<Mastery, string>;
  notes!: Table<Note, number>;
  bookmarks!: Table<Bookmark, [string, string]>;
  settings!: Table<Setting, string>;
  constructor() {
    super('kodigo');
    this.version(1).stores({
      progress: '[moduleId+tab+itemId], moduleId, updatedAt',
      attempts: '++id, key, templateId, moduleId, at',
      srs: 'templateId, moduleId, due',
      mastery: 'skillKey, updatedAt',
      notes: '++id, moduleId, createdAt',
      bookmarks: '[moduleId+ref], moduleId, createdAt',
      settings: 'key',
    });
  }
}

export const db = new KodigoDB();
export const DB_VERSION = 1;
