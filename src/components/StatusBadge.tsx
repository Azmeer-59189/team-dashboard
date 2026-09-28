// Pending = warm sand, in progress = sky, done = teal-green. The pie chart
// uses the same three hues so a status reads the same everywhere.
const STYLES: Record<string, string> = {
  pending: "bg-tint-sand text-amber-800",
  "in-progress": "bg-tint-sky text-sky-800",
  done: "bg-tint-mint text-brand-600",
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STYLES[status] ?? STYLES.pending}`}>{status}</span>;
}
