import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { getCompositeScore, scoreLabel } from "@/lib/compositeScore";
import Link from "next/link";

const RATING_BADGE: Record<string, string> = {
  Excellent: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Good: "bg-brand-50 text-brand-700 ring-brand-600/15",
  "Needs improvement": "bg-amber-50 text-amber-700 ring-amber-600/15",
  "No data": "bg-slate-100 text-slate-500 ring-slate-500/10",
};
const RATING_BAR: Record<string, string> = {
  Excellent: "bg-emerald-500",
  Good: "bg-brand-500",
  "Needs improvement": "bg-amber-500",
  "No data": "bg-slate-300",
};

export default async function CompositeScoresPage({
  searchParams,
}: {
  searchParams: { department?: string };
}) {
  const session = await getSession();
  const scope = getScope(session!);

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });

  const members = await prisma.user.findMany({
    where: {
      role: { in: ["MEMBER", "LEAD"] },
      ...(scope.isLead
        ? { departmentId: scope.departmentId }
        : searchParams.department
        ? { departmentId: searchParams.department }
        : {}),
    },
    include: { department: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  });

  const rows = await Promise.all(
    members.map(async (m) => ({ member: m, score: await getCompositeScore(m.id, m.departmentId) }))
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Performance" title="Composite KPI Scores" description={<>Each row is one person's monthly score. Core uses their monthly Core goal; Behavioural is the average of manager-entered scores for this month. When both exist, Overall weights them 65% / 35%. If only one exists, it becomes the whole Overall. A dash means no data; department filters do not create a team average.</>} />

      {!scope.isLead && (
        <div className="card !p-4 sm:w-fit">
          <form method="get" className="flex items-end gap-3">
            <div>
              <label className="label">Department</label>
              <select name="department" defaultValue={searchParams.department ?? ""} className="input min-w-[200px]">
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              Filter
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-muted">
              <th className="py-2">Member</th>
              <th className="py-2">Department</th>
              <th className="py-2">Core</th>
              <th className="py-2">Behavioural</th>
              <th className="py-2">Overall /100</th>
              <th className="py-2">Rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, score }) => (
              <tr key={member.id} className="border-b border-hairline/60">
                <td className="py-2">
                  <Link href={`/admin/members/${member.id}`} className="flex items-center gap-2.5 whitespace-nowrap font-semibold text-ink hover:text-brand-600">
                    <span aria-hidden="true" className="avatar h-8 w-8 text-xs">
                      {member.fullName.charAt(0).toUpperCase()}
                    </span>
                    {member.fullName}
                  </Link>
                </td>
                <td className="py-2 text-muted">{member.department?.name ?? "—"}</td>
                <td className="py-2 tabular-nums text-slate-600">{score.corePct !== null ? `${score.corePct}%` : "—"}</td>
                <td className="py-2 tabular-nums text-slate-600">{score.behaviouralPct !== null ? `${score.behaviouralPct}%` : "—"}</td>
                <td className="py-2">
                  {score.overall !== null ? (
                    <div className="flex items-center gap-3">
                      <span className="w-9 font-display font-bold tabular-nums text-ink">{score.overall}</span>
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                        <span className={`block h-full rounded-full ${RATING_BAR[scoreLabel(score.overall)]}`} style={{ width: `${score.overall}%` }} />
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="py-2">
                  <span className={`badge whitespace-nowrap ring-1 ring-inset ${RATING_BADGE[scoreLabel(score.overall)]}`}>
                    {scoreLabel(score.overall)}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
