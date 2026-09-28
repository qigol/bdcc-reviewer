import type { Marks, WidgetCommand } from './types';

const asList = (sel: unknown): string[] => (Array.isArray(sel) ? sel.map(String) : sel === undefined || sel === null ? [] : [String(sel)]);

/** Fold highlight / pulse / annotate / clear into lookup tables. */
export function computeMarks(cmds: WidgetCommand[]): Marks {
  const tones: Record<string, string> = {};
  const pulses: Record<string, number> = {};
  const notes: Record<string, string> = {};
  for (const c of cmds) {
    const a = c.args ?? {};
    switch (c.cmd) {
      case 'highlight':
        for (const s of asList(a.sel)) tones[s] = a.tone ?? 'accent';
        break;
      case 'pulse':
        for (const s of asList(a.sel)) pulses[s] = c.seq;
        break;
      case 'annotate':
        for (const s of asList(a.sel)) notes[s] = String(a.text ?? '');
        break;
      case 'clear': {
        const list = asList(a.sel);
        if (!list.length) {
          for (const k of Object.keys(tones)) delete tones[k];
          for (const k of Object.keys(notes)) delete notes[k];
        } else for (const s of list) { delete tones[s]; delete notes[s]; }
        break;
      }
    }
  }
  return {
    tones,
    tone: (s) => tones[s],
    pulse: (s) => pulses[s],
    note: (s) => notes[s],
    any: (prefix) => Object.keys(tones).some((k) => k.startsWith(prefix)),
  };
}

/** Commands excluding the common ones, in order. */
export const ownCmds = (cmds: WidgetCommand[]) => cmds.filter((c) => !['highlight', 'pulse', 'annotate', 'clear'].includes(c.cmd));
