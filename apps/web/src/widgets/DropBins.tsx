import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { Check, RotateCcw } from 'lucide-react';
import type { WidgetRenderProps } from '../engine/types';
import { ownCmds } from '../engine/marks';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';
import { createRng, hashSeed } from '@kodigo/sdk';

interface Item { id: string; label: string }
interface P { chips: Item[]; bins: Item[]; solution?: Record<string, string>; check?: 'instant' | 'submit'; shuffle?: boolean; placement?: Record<string, string> }

function DragChip({ chip, state, selected, onClick }: { chip: Item; state?: 'good' | 'bad'; selected: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: chip.id });
  return (
    <motion.button
      layout
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30 } : undefined}
      className={cn('rounded-lg border px-2.5 py-1 text-sm shadow-sm transition', state ? `tone-${state} mark-bg` : 'border-line bg-panel', selected && 'ring-2 ring-accent', isDragging && 'shadow-lg')}
    >
      <Markdown text={chip.label} inline />
    </motion.button>
  );
}

function Bin({ id, label, children, onClick, tone }: { id: string; label?: string; children: React.ReactNode; onClick?: () => void; tone?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} onClick={onClick} className={cn('min-h-[72px] rounded-xl border-2 border-dashed p-2 transition', isOver ? 'border-accent bg-accent/5' : 'border-line', tone && `tone-${tone} mark-bg`, onClick && 'cursor-pointer')}>
      {label && <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Markdown text={label} inline /></div>}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function DropBins({ id, props, cmds, marks, bind, emit, isBound }: WidgetRenderProps<P>) {
  const [local, setLocal] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const cmdPlacement = useMemo(() => {
    let p: Record<string, string> | null = null;
    for (const c of ownCmds(cmds)) {
      if (c.cmd === 'solve') p = { ...(props.solution ?? {}) };
      if (c.cmd === 'reset') p = {};
    }
    return p;
  }, [cmds, props.solution]);
  const lastCmd = useRef<any>(null);
  useEffect(() => {
    if (cmdPlacement && lastCmd.current !== cmdPlacement) { lastCmd.current = cmdPlacement; setLocal(cmdPlacement); if (isBound('placement')) bind('placement', cmdPlacement); }
  }, [cmdPlacement]);
  const placement = (isBound('placement') ? props.placement : local) ?? {};
  const order = useMemo(() => (props.shuffle === false ? props.chips : createRng(hashSeed(id)).shuffle(props.chips)), [props.chips, props.shuffle, id]);
  const check = props.check ?? 'instant';
  const sol = props.solution;
  const solved = !!sol && props.chips.every((c) => placement[c.id] === sol[c.id]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const emittedSolved = useRef(false);
  useEffect(() => {
    if (solved && (check === 'instant' || submitted) && !emittedSolved.current) { emittedSolved.current = true; emit('solved'); }
    if (!solved) emittedSolved.current = false;
  }, [solved, submitted, check]);

  const place = (chip: string, bin: string | null) => {
    const next = { ...placement };
    if (bin) next[chip] = bin; else delete next[chip];
    setLocal(next);
    bind('placement', next);
    emit('change', next);
    setSubmitted(false);
  };
  const onDragEnd = (e: DragEndEvent) => { if (e.over) place(String(e.active.id), e.over.id === '__tray' ? null : String(e.over.id)); };
  const stateOf = (chip: string): 'good' | 'bad' | undefined => {
    if (!sol || !placement[chip] || (check === 'submit' && !submitted)) return undefined;
    return placement[chip] === sol[chip] ? 'good' : 'bad';
  };
  const tray = order.filter((c) => !placement[c.id]);
  return (
    <div className="card p-3">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <Bin id="__tray" onClick={selected ? () => { place(selected, null); setSelected(null); } : undefined}>
          {tray.length ? tray.map((c) => <DragChip key={c.id} chip={c} selected={selected === c.id} onClick={() => setSelected(selected === c.id ? null : c.id)} />) : <span className="text-xs text-muted">All placed.</span>}
        </Bin>
        <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(props.bins.length, 3)}, minmax(0, 1fr))` }}>
          {props.bins.map((b) => (
            <Bin key={b.id} id={b.id} label={b.label} tone={marks.tone(`bin:${b.id}`)} onClick={selected ? () => { place(selected, b.id); setSelected(null); } : undefined}>
              {order.filter((c) => placement[c.id] === b.id).map((c) => <DragChip key={c.id} chip={c} state={stateOf(c.id)} selected={selected === c.id} onClick={() => setSelected(selected === c.id ? null : c.id)} />)}
            </Bin>
          ))}
        </div>
      </DndContext>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
        <span>Drag chips, or click a chip then a bin.</span>
        <span className="ml-auto" />
        {solved && (check === 'instant' || submitted) && <span className="flex items-center gap-1 font-semibold text-good"><Check size={14} /> All correct</span>}
        {check === 'submit' && sol && <button className="btn btn-sm" onClick={() => setSubmitted(true)} disabled={tray.length > 0}>Check</button>}
        <button className="btn-ghost btn-sm" onClick={() => { setLocal({}); bind('placement', {}); setSubmitted(false); }}><RotateCcw size={13} /> Reset</button>
      </div>
    </div>
  );
}
