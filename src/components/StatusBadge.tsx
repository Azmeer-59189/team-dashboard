// Pending = warm sand, in progress = sky, done = teal-green. The pie chart
// uses the same three hues so a status reads the same everywhere.
const STYLES: Record<string, string> = {
  pending: "bg-tint-sand text-amber-800",
  "in-progress": "bg-tint-sky text-sky-800",
  done: "bg-tint-mint text-brand-600",
};

export default function StatusBadge({ status }: { status: string }) {
  const label = { pending: "Pending", "in-progress": "In progress", done: "Done" }[status] ?? status;
  return <span className={`badge gap-1.5 whitespace-nowrap ${STYLES[status] ?? STYLES.pending}`}>
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{label}
  </span>;
}
