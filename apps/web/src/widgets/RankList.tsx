import { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { WidgetRenderProps } from '../engine/types';
import { ownCmds } from '../engine/marks';
import { fmtNum } from './common';
import { cn } from '../lib/util';

interface Item { id: string; label: string }
interface P { items: Item[]; relevance?: Record<string, number>; showRelevance?: boolean; showGain?: boolean; gain?: 'exp2' | 'linear'; k?: number; draggable?: boolean; order?: string[] }

function Row({ item, pos, rel, showRel, gainText, dim, tone, draggable, pulse }: { item: Item; pos: number; rel?: number; showRel: boolean; gainText?: string; dim: boolean; tone?: string; draggable: boolean; pulse?: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !draggable });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('flex items-center gap-2 rounded-lg border border-line bg-panel px-2 py-1.5', dim && 'opacity-40', tone && `tone-${tone} mark-bg`, isDragging && 'z-10 shadow-lg', pulse && 'pulse')}>
      <span className="w-6 text-center font-mono text-xs text-muted">{pos}</span>
      {draggable && <button aria-label={`drag ${item.label}`} className="cursor-grab text-muted" {...attributes} {...listeners}><GripVertical size={15} /></button>}
      <span className="font-medium">{item.label}</span>
      {showRel && rel !== undefined && <span className="chip tone-good mark-bg ml-1">rel {rel}</span>}
      {gainText && <span className="ml-auto font-mono text-xs text-muted">{gainText}</span>}
    </li>
  );
}

export default function RankList({ props, cmds, marks, bind, emit, isBound }: WidgetRenderProps<P>) {
  const ids = (props.items ?? []).map((i) => i.id);
  const [local, setLocal] = useState<string[] | null>(null);
  const cmdState = useMemo(() => {
    let revealed = false, order: string[] | null = null;
    for (const c of ownCmds(cmds)) {
      if (c.cmd === 'reveal') revealed = true;
      if (c.cmd === 'sortIdeal') order = [...ids].sort((a, b) => (props.relevance?.[b] ?? 0) - (props.relevance?.[a] ?? 0));
      if (c.cmd === 'setOrder') order = (c.args?.order ?? []).filter((x: string) => ids.includes(x));
    }
    return { revealed, order };
  }, [cmds, ids.join(','), props.relevance]);
  const bound = isBound('order') ? props.order : null;
  let order = cmdState.order ?? bound ?? local ?? props.order ?? ids;
  order = [...order.filter((x) => ids.includes(x)), ...ids.filter((x) => !order.includes(x))];
  const byId = Object.fromEntries((props.items ?? []).map((i) => [i.id, i]));
  const k = props.k ?? order.length;
  const g = (rel: number) => (props.gain === 'linear' ? rel : Math.pow(2, rel) - 1);
  const rel = props.relevance ?? {};
  let dcg = 0;
  const contrib = order.map((id, i) => { const c = i < k && rel[id] !== undefined ? g(rel[id]) / Math.log2(i + 2) : 0; dcg += c; return c; });
  const ideal = [...ids].sort((a, b) => (rel[b] ?? 0) - (rel[a] ?? 0));
  const idcg = ideal.slice(0, k).reduce((s, id, i) => s + (rel[id] !== undefined ? g(rel[id]) / Math.log2(i + 2) : 0), 0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(order, order.indexOf(String(e.active.id)), order.indexOf(String(e.over.id)));
    setLocal(next);
    bind('order', next);
    emit('change', next);
  };
  const showRel = !!props.showRelevance || cmdState.revealed;
  return (
    <div className="card p-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-1.5">
            {order.map((id, i) => (
              <Row
                key={id}
                item={byId[id] ?? { id, label: id }}
                pos={i + 1}
                rel={rel[id]}
                showRel={showRel}
                dim={i >= k}
                draggable={props.draggable !== false && !cmdState.order}
                tone={marks.tone(`item:${id}`) ?? marks.tone(`pos:${i + 1}`)}
                pulse={marks.pulse(`item:${id}`) ?? marks.pulse(`pos:${i + 1}`)}
                gainText={props.showGain && i < k && rel[id] !== undefined ? `(${props.gain === 'linear' ? rel[id] : `2^${rel[id]}−1`}) / log₂(${i + 2}) = ${fmtNum(contrib[i], 2)}` : undefined}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {props.showGain && props.relevance && (
        <div className="mt-2 flex flex-wrap justify-end gap-3 border-t border-line pt-2 text-sm tabular-nums">
          <span>DCG@{k} = <b>{fmtNum(dcg, 2)}</b></span>
          <span className="text-muted">IDCG@{k} = {fmtNum(idcg, 2)}</span>
          <span>NDCG = <b className="text-accent">{fmtNum(idcg ? dcg / idcg : 0, 3)}</b></span>
        </div>
      )}
    </div>
  );
}
