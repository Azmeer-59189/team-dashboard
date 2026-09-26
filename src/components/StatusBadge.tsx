const STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  "in-progress": "bg-amber-50 text-amber-700",
  done: "bg-positive/10 text-positive",
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STYLES[status] ?? STYLES.pending}`}>{status}</span>;
}
