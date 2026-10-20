import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from './util';
import { useReducedMotion } from './reducedMotion';

/**
 * A sortable card that moves like a playing card (think Balatro): it lifts and grows when picked up, leans into the
 * direction you drag it and swings back on springs, tilts toward the pointer when hovered, and lands with a small
 * overshoot. dnd-kit moves the outer element; everything visual happens on the inner one, so the two never fight.
 * Tilt angles are sized to the card's width, so a wide row never swings its ends into the rows around it.
 * With reduced motion the card only gets the lift shadow.
 */
const TILT = { stiffness: 260, damping: 14, mass: 0.6 };
const LAND = { type: 'spring' as const, stiffness: 520, damping: 14 };
const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
/** the angle (degrees) at which the ends of a card `w` px wide move `edge` px */
const maxDeg = (w: number, edge: number) => (Math.atan(edge / Math.max(40, w / 2)) * 180) / Math.PI;
const SHADOW = { hover: '0 8px 14px -8px rgba(0,0,0,0.3)', lift: '0 22px 30px -10px rgba(0,0,0,0.5)' };

export function SortCard({ id, locked, as: Tag = 'li', fill, className, handleLabel = 'drag', children }: {
  id: string; locked: boolean; as?: 'li' | 'div'; fill?: boolean; className?: string; handleLabel?: string;
  /** receives the grip, so the card decides where it sits */
  children: (grip: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: locked });
  const reduced = useReducedMotion();
  const rotate = useSpring(0, TILT);
  const rotX = useSpring(0, TILT);
  const rotY = useSpring(0, TILT);
  const [hover, setHover] = useState(false);
  const [lifted, setLifted] = useState(false); // keeps the card above its neighbours while it settles
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const vel = useRef({ x: 0, y: 0 });
  const idle = useRef(0);

  // lean into the drag: the faster the card moves sideways, the more it tilts; it swings back when the pointer rests
  const x = transform?.x ?? 0, y = transform?.y ?? 0;
  useEffect(() => {
    if (!isDragging) {
      last.current = null;
      vel.current = { x: 0, y: 0 };
      rotate.set(0); rotX.set(0); rotY.set(0);
      return;
    }
    if (reduced) return;
    if (last.current) {
      const dx = x - last.current.x, dy = y - last.current.y;
      // a keyboard move jumps a whole row at once: that is not a swing
      if (Math.abs(dx) < 40 && Math.abs(dy) < 40) {
        vel.current = { x: 0.75 * vel.current.x + 0.25 * dx, y: 0.75 * vel.current.y + 0.25 * dy };
        const w = box.current?.offsetWidth ?? 300;
        const z = maxDeg(w, 9);
        rotate.set(clamp(vel.current.x * (z / 3), z));
        rotX.set(clamp(-vel.current.y * 0.8, 6));
        window.clearTimeout(idle.current);
        idle.current = window.setTimeout(() => { vel.current = { x: 0, y: 0 }; rotate.set(0); rotX.set(0); }, 90);
      }
    }
    last.current = { x, y };
  }, [isDragging, x, y]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.clearTimeout(idle.current), []);
  useEffect(() => {
    if (isDragging) { setLifted(true); return; }
    const t = window.setTimeout(() => setLifted(false), 350);
    return () => window.clearTimeout(t);
  }, [isDragging]);

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (locked || isDragging || reduced || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const deg = Math.min(7, maxDeg(r.width, 12));
    rotY.set(((e.clientX - r.left) / r.width - 0.5) * 2 * deg);
    rotX.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * Math.min(5, deg));
  };
  const onLeave = () => { setHover(false); if (!isDragging) { rotX.set(0); rotY.set(0); } };

  const grip = locked ? null : (
    <button aria-label={handleLabel} className={cn('touch-none text-muted', isDragging ? 'cursor-grabbing' : 'cursor-grab')} {...attributes} {...listeners}><GripVertical size={15} /></button>
  );
  const raised = !locked && (isDragging || hover);
  return (
    // Translate, not Transform: a card swapping places with a taller or shorter one must not be squashed or stretched
    <Tag ref={setNodeRef as any} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn(fill && 'h-full', lifted && 'relative z-10')}>
      <motion.div
        ref={box}
        className={cn('relative', fill && 'h-full', isDragging && 'select-none', className)}
        style={reduced ? undefined : { rotate, rotateX: rotX, rotateY: rotY, transformPerspective: 700 }}
        animate={{ scale: reduced ? 1 : isDragging ? 1.07 : hover && !locked ? 1.025 : 1 }}
        transition={reduced ? { duration: 0.12 } : LAND}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
        onPointerMove={onPointerMove}
        onPointerLeave={onLeave}
      >
        {/* the lift shadow is its own layer, so it never replaces the card's own box-shadow (graded tones draw a ring with it) */}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" initial={false}
          animate={{ opacity: raised ? 1 : 0, boxShadow: isDragging ? SHADOW.lift : SHADOW.hover }} transition={{ duration: 0.18 }} />
        {children(grip)}
      </motion.div>
    </Tag>
  );
}
