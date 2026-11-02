import { useEffect, useState } from 'react';
import { api, type ChristmasStatus } from '../lib/api';

// one fetch per page load, shared by the banner, the decorations and the page
let cached: Promise<ChristmasStatus> | null = null;
const load = () => (cached ??= api.christmas().catch((): ChristmasStatus => { cached = null; return { active: false }; }));

/** The server decides what is open; undefined while loading. */
export function useChristmas(): ChristmasStatus | undefined {
  const [s, setS] = useState<ChristmasStatus>();
  useEffect(() => { let live = true; load().then((v) => live && setS(v)); return () => { live = false; }; }, []);
  return s;
}

const ANSWERS_KEY = (year: number) => `kodigo-xmas-${year}`;
/** question id → picked option index, kept apart from progress/mastery so it never touches study stats */
export function readAnswers(year: number): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(ANSWERS_KEY(year)) ?? '{}'); } catch { return {}; }
}
export function writeAnswers(year: number, a: Record<string, number>) {
  try { localStorage.setItem(ANSWERS_KEY(year), JSON.stringify(a)); } catch {}
}
