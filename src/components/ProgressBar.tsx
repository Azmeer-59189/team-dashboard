export default function ProgressBar({
  label,
  progress,
  target,
  unit,
}: {
  label: string;
  progress: number;
  target: number;
  // shown after the numbers, e.g. "days"; omit for plain "x / y"
  unit?: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  const color =
    pct >= 100
      ? "from-emerald-400 to-emerald-500"
      : pct >= 50
      ? "from-brand-400 to-brand-500"
      : "from-amber-300 to-amber-500";

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-medium text-slate-700">{label}</span>
        <span className="shrink-0 tabular-nums text-muted">
          <span className="font-semibold text-ink">{progress}</span> / {target}
          {unit ? ` ${unit}` : ""}
          <span className="ml-2 text-xs font-semibold text-slate-500">{pct}%</span>
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={`h-full rounded-full bg-gradient-to-r transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
