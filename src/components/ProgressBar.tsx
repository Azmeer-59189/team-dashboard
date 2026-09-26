export default function ProgressBar({
  label,
  progress,
  target,
}: {
  label: string;
  progress: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  const color = pct >= 100 ? "bg-positive" : pct >= 50 ? "bg-amber-500" : "bg-danger";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-muted">
          {progress} / {target} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
