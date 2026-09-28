import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DndContext, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { X } from 'lucide-react';
import type { WidgetRenderProps } from '../engine/types';
import { ownCmds } from '../engine/marks';
import { asList } from './common';
import { cn } from '../lib/util';
import { Markdown } from '../lib/md';

interface Tx { id: string | number; items: string[] }
interface P {
  transactions: Tx[]; itemOrder?: string[]; highlight?: string[]; strike?: (string | number)[];
  editable?: boolean; palette?: string[]; selectable?: boolean; showContainCount?: boolean; title?: string; selection?: string[];
}

function sortItems(items: string[], order?: string[]) {
  return [...items].sort((a, b) => {
    if (order) { const ia = order.indexOf(a), ib = order.indexOf(b); if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib); }
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function Chip({ id, label, tone, faded, pulse, draggable, onRemove, onClick, selected }: { id: string; label: string; tone?: string; faded?: boolean; pulse?: number; draggable?: boolean; onRemove?: () => void; onClick?: () => void; selected?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: !draggable });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 20 } : undefined;
  return (
    <motion.span
      layout
      ref={setNodeRef}
      style={style}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: faded ? 0.28 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, width: 0, marginRight: 0, paddingLeft: 0, paddingRight: 0 }}
      transition={{ duration: 0.35 }}
      key={pulse}
      className={cn(
        'inline-flex select-none items-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2 py-0.5 text-xs',
        tone ? `tone-${tone} mark-bg font-semibold` : 'border-line bg-panel2',
        selected && 'tone-accent mark-bg font-semibold',
        faded && 'line-through',
        draggable && 'cursor-grab active:cursor-grabbing',
        onClick && 'cursor-pointer',
        isDragging && 'shadow-lg',
        pulse && 'pulse',
      )}
    >
      {label}
      {onRemove && (
        <button aria-label={`remove ${label}`} className="text-muted hover:text-bad" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <X size={11} />
        </button>
      )}
    </motion.span>
  );
}

function Row({ tx, children, glow, tone, struck, droppable, pulse }: { tx: Tx; children: React.ReactNode; glow: boolean; tone?: string; struck: boolean; droppable: boolean; pulse?: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `row::${tx.id}`, disabled: !droppable });
  return (
    <motion.tr
      layout
      ref={setNodeRef as any}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.3 } }}
      transition={{ duration: 0.35 }}
      className={cn('border-t border-line transition-colors', glow && 'tone-good mark-bg', tone && `tone-${tone} mark-bg`, isOver && 'bg-accent/10', struck && 'opacity-40', pulse && 'pulse')}
    >
      <td className={cn('w-16 px-3 py-1.5 text-center font-mono text-xs text-muted', struck && 'line-through')}>T{tx.id}</td>
      <td className="px-3 py-1.5"><div className="flex min-h-[24px] flex-wrap items-center gap-1">{children}</div></td>
    </motion.tr>
  );
}

function Palette({ items, labels }: { items: string[]; labels: Record<string, string> }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 rounded-lg border border-dashed border-line p-2">
      <span className="mr-1 text-[11px] text-muted">Drag items into baskets:</span>
      {items.map((it) => <Chip key={it} id={`palette::${it}`} label={labels[it] ?? it} draggable />)}
    </div>
  );
}

export default function TransactionTable({ props, cmds, marks, ctx, bind, emit, isBound }: WidgetRenderProps<P>) {
  const [local, setLocal] = useState<Tx[] | null>(null);
  const txs: Tx[] = (isBound('transactions') ? props.transactions : local ?? props.transactions) ?? [];
  const labels = ctx.labels;
  const order = props.itemOrder;
  const { struck, prefix } = useMemo(() => {
    const s = new Set((props.strike ?? []).map(String));
    let prefix: string[] | null = null;
    for (const c of ownCmds(cmds)) {
      if (c.cmd === 'strike') for (const sel of asList(c.args?.sel)) s.add(sel.replace(/^row:/, ''));
      if (c.cmd === 'project') prefix = asList(c.args?.prefix);
      if (c.cmd === 'unproject') prefix = null;
    }
    return { struck: s, prefix };
  }, [props.strike, cmds]);
  const hl = props.highlight ?? [];
  const selection = props.selection ?? [];
  const contains = (t: Tx, set: string[]) => set.length > 0 && set.every((i) => t.items.includes(i));
  const lastPrefixIdx = prefix && prefix.length ? Math.max(...prefix.map((p) => (order ?? sortItems(txs.flatMap((t) => t.items))).indexOf(p))) : -1;
  const fullOrder = order ?? sortItems([...new Set(txs.flatMap((t) => t.items))]);
  const visibleRows = prefix ? txs.filter((t) => contains(t, prefix)) : txs;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  const update = (next: Tx[]) => {
    if (isBound('transactions')) bind('transactions', next); else setLocal(next);
    emit('change', next);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const parts = String(e.active.id).split('::');
    const src = parts[0] === 'chip' ? parts[1] : 'palette';
    const item = parts[0] === 'chip' ? parts[2] : parts[1];
    const over = e.over?.id ? String(e.over.id).replace(/^row::/, '') : null;
    if (!over || !item) return;
    const next = txs.map((t) => ({ ...t, items: [...t.items] }));
    const target = next.find((t) => String(t.id) === over);
    if (!target) return;
    if (src !== 'palette') {
      const from = next.find((t) => String(t.id) === src);
      if (!from || String(from.id) === over) return;
      from.items = from.items.filter((i) => i !== item);
    }
    if (!target.items.includes(item)) target.items = sortItems([...target.items, item], order);
    update(next);
  };
  const toggleSel = (item: string) => {
    if (!props.selectable) return;
    const next = selection.includes(item) ? selection.filter((i) => i !== item) : sortItems([...selection, item], order);
    bind('selection', next);
    emit('select', next);
  };
  const count = txs.filter((t) => contains(t, hl)).length;

  return (
    <div className="card overflow-hidden">
      {(props.title || prefix || props.showContainCount) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 text-xs">
          <span className="font-semibold text-muted">{props.title ? <Markdown text={props.title} inline /> : 'Transactions'}</span>
          <span className="flex items-center gap-2">
            {prefix && <span className="chip tone-accent mark-bg">projected on {'{'}{prefix.map((p) => labels[p] ?? p).join(', ')}{'}'} · {visibleRows.length} rows</span>}
            {props.showContainCount && hl.length > 0 && <span className="chip tone-good mark-bg">{count} of {txs.length} contain {'{'}{hl.map((p) => labels[p] ?? p).join(', ')}{'}'}</span>}
          </span>
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel2 text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-1.5 text-center">#</th>
              <th className="px-3 py-1.5">Items</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {visibleRows.map((t) => {
                const items = sortItems(t.items, order);
                return (
                  <Row key={String(t.id)} tx={t} glow={contains(t, hl)} tone={marks.tone(`row:${t.id}`)} struck={struck.has(String(t.id))} droppable={!!props.editable} pulse={marks.pulse(`row:${t.id}`)}>
                    <AnimatePresence initial={false}>
                      {items
                        .filter((it) => !(prefix && fullOrder.indexOf(it) <= lastPrefixIdx))
                        .map((it) => (
                          <Chip
                            key={it}
                            id={`chip::${t.id}::${it}`}
                            label={labels[it] ?? it}
                            tone={marks.tone(`chip:${t.id}:${it}`) ?? marks.tone(`item:${it}`) ?? (hl.includes(it) && contains(t, hl) ? 'good' : undefined)}
                            pulse={marks.pulse(`chip:${t.id}:${it}`) ?? marks.pulse(`item:${it}`)}
                            draggable={props.editable}
                            selected={selection.includes(it)}
                            onClick={props.selectable ? () => toggleSel(it) : undefined}
                            onRemove={props.editable ? () => update(txs.map((x) => (x.id === t.id ? { ...x, items: x.items.filter((i) => i !== it) } : x))) : undefined}
                          />
                        ))}
                    </AnimatePresence>
                    {prefix && items.every((it) => fullOrder.indexOf(it) <= lastPrefixIdx) && <span className="text-xs italic text-muted">(empty)</span>}
                    {marks.note(`row:${t.id}`) && <span className="ml-auto text-xs text-accent">{marks.note(`row:${t.id}`)}</span>}
                  </Row>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {props.editable && props.palette && <div className="px-3 pb-3"><Palette items={props.palette} labels={labels} /></div>}
      </DndContext>
    </div>
  );
}
