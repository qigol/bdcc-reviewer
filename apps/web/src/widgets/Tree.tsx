import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { WidgetRenderProps } from '../engine/types';
import { ownCmds } from '../engine/marks';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';

interface Node { id: string; label: string; note?: string; tone?: string; children?: Node[] }
interface P { root: Node; orientation?: 'down' | 'right'; collapsed?: boolean }

function allIds(n: Node, out: string[] = []) { out.push(n.id); n.children?.forEach((c) => allIds(c, out)); return out; }
function pathTo(n: Node, id: string, acc: string[] = []): string[] | null {
  if (n.id === id) return [...acc, n.id];
  for (const c of n.children ?? []) { const p = pathTo(c, id, [...acc, n.id]); if (p) return p; }
  return null;
}

export default function Tree({ props, cmds, marks, emit }: WidgetRenderProps<P>) {
  const root = props.root;
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const open = useMemo(() => {
    const o: Record<string, boolean> = {};
    if (!root) return o;
    for (const id of allIds(root)) o[id] = !props.collapsed || id === root.id;
    for (const c of ownCmds(cmds)) {
      const id = c.args?.id ?? c.args;
      const ids = id === 'all' ? allIds(root) : [String(id)];
      if (c.cmd === 'expand') ids.forEach((x) => { o[x] = true; (pathTo(root, x) ?? []).forEach((p) => (o[p] = true)); });
      if (c.cmd === 'collapse') ids.forEach((x) => (o[x] = false));
    }
    return { ...o, ...toggled };
  }, [root, props.collapsed, cmds, toggled]);
  const pathHl = useMemo(() => {
    const s = new Map<string, string>();
    if (!root) return s;
    for (const [sel, tone] of Object.entries(marks.tones)) if (sel.startsWith('path:')) (pathTo(root, sel.slice(5)) ?? []).forEach((id) => s.set(id, tone));
    return s;
  }, [marks.tones, root]);
  if (!root) return <div className="card p-3 text-sm text-muted">No tree.</div>;

  const renderNode = (n: Node, depth: number): React.ReactNode => {
    const tone = marks.tone(`node:${n.id}`) ?? pathHl.get(n.id) ?? n.tone;
    const has = !!n.children?.length;
    return (
      <li key={n.id} className="relative">
        <div className="flex items-start gap-1 py-0.5">
          {has ? (
            <button aria-label={open[n.id] ? 'collapse' : 'expand'} className="mt-0.5 text-muted" onClick={() => setToggled((t) => ({ ...t, [n.id]: !open[n.id] }))}>
              {open[n.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span className="w-3.5" />}
          <button onClick={() => emit('nodeClick', { id: n.id })} className={cn('rounded-md border px-2 py-0.5 text-left text-sm transition', tone ? `tone-${tone} mark-bg` : 'border-line bg-panel', marks.pulse(`node:${n.id}`) && 'pulse')}>
            <Markdown text={n.label} inline />
            {n.note && <span className="ml-2 text-xs text-muted"><Markdown text={n.note} inline /></span>}
          </button>
          {marks.note(`node:${n.id}`) && <span className="text-xs text-accent">{marks.note(`node:${n.id}`)}</span>}
        </div>
        {has && open[n.id] && <ul className="ml-3 border-l border-line pl-3">{n.children!.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  };
  return (
    <div className="card max-h-[520px] overflow-auto p-3 scrollbar-thin">
      <ul>{renderNode(root, 0)}</ul>
    </div>
  );
}
