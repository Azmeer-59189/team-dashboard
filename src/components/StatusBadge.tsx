const STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  "in-progress": "bg-amber-100 text-amber-800",
  done: "bg-green-100 text-green-800",
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STYLES[status] ?? STYLES.pending}`}>{status}</span>;
}
