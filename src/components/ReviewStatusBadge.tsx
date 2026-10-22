import StatusBadge from "./StatusBadge";

const styles: Record<string, string> = {
  SUBMITTED: "bg-violet-50 text-violet-700 ring-violet-600/15",
  CHANGES_REQUESTED: "bg-amber-50 text-amber-800 ring-amber-600/15",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
};
const labels: Record<string, string> = { SUBMITTED: "Awaiting review", CHANGES_REQUESTED: "Changes requested", APPROVED: "Approved" };
export default function ReviewStatusBadge({ reviewStatus, status }: { reviewStatus?: string; status: string }) {
  if (!reviewStatus || reviewStatus === "DRAFT") return <StatusBadge status={status} />;
  return <span className={`badge whitespace-nowrap ring-1 ring-inset ${styles[reviewStatus] ?? "bg-slate-100 text-slate-600"}`}>{labels[reviewStatus] ?? reviewStatus}</span>;
}
