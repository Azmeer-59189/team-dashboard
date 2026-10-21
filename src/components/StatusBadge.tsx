// Pending = amber, in progress = blue, done = emerald. The pie chart uses the
// same three hues (see STATUS_COLORS) so a status reads the same everywhere.
export const STATUS_COLORS = {
  pending: "#F59E0B",
  "in-progress": "#3B82F6",
  done: "#10B981",
} as const;

const STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/15",
  "in-progress": "bg-blue-50 text-blue-700 ring-blue-600/15",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
};

export default function StatusBadge({ status }: { status: string }) {
  const label = { pending: "Pending", "in-progress": "In progress", done: "Done" }[status] ?? status;
  return (
    <span className={`badge gap-1.5 whitespace-nowrap ring-1 ring-inset ${STYLES[status] ?? STYLES.pending}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
