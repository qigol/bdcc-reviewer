import { AlertTriangle, BookMarked, BookOpen, GraduationCap, Info, Lightbulb, Rocket } from 'lucide-react';
import type { WidgetRenderProps } from '../engine/types';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';

const KINDS: Record<string, { icon: any; cls: string; label: string }> = {
  note: { icon: Info, cls: 'border-accent/40 bg-accent/5', label: 'Note' },
  tip: { icon: Lightbulb, cls: 'border-good/40 bg-good/5', label: 'Tip' },
  warn: { icon: AlertTriangle, cls: 'border-warn/50 bg-warn/5', label: 'Watch out' },
  exam: { icon: GraduationCap, cls: 'border-accent/50 bg-accent/10', label: 'Exam tip' },
  errata: { icon: BookOpen, cls: 'border-bad/40 bg-bad/5', label: 'Slide erratum' },
  beyond: { icon: Rocket, cls: 'border-purple-400/50 bg-purple-400/5', label: 'Beyond the slides' },
  define: { icon: BookMarked, cls: 'border-accent/40 bg-panel', label: 'Definition' },
};

export function CalloutBox({ kind, title, body, className }: { kind: string; title?: string; body: string; className?: string }) {
  const k = KINDS[kind] ?? KINDS.note;
  const Icon = k.icon;
  return (
    <div className={cn('rounded-xl border px-4 py-3', k.cls, className)}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <Icon size={14} /> {title ?? k.label}
      </div>
      <Markdown text={body} className="text-sm" />
    </div>
  );
}

export default function Callout({ props }: WidgetRenderProps<{ kind: string; title?: string; body: string }>) {
  return <CalloutBox kind={props.kind} title={props.title} body={props.body} />;
}
