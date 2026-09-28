export function Ring({ value, label, color = 'rgb(var(--accent))', size = 54 }: { value: number; label: string; color?: string; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="flex flex-col items-center gap-1" title={`${label}: ${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .6s' }} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={12} fontWeight={700} fill="rgb(var(--ink))" transform={`rotate(90 ${size / 2} ${size / 2})`}>{Math.round(v * 100)}</text>
      </svg>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}
