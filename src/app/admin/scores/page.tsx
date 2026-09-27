import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { getCompositeScore, scoreLabel } from "@/lib/compositeScore";
import Link from "next/link";

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
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Composite KPI Scores</h1>
        <p className="text-sm text-muted">
          Core (automatic KPIs, 65%) + Behavioural (manager-rated, 35%) = Overall, this month.
        </p>
      </div>

      {!scope.isLead && (
        <div className="card flex items-end gap-4">
          <form method="get" className="flex items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Department</label>
              <select name="department" defaultValue={searchParams.department ?? ""} className="input">
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
              <th className="py-2">Overall</th>
              <th className="py-2">Rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, score }) => (
              <tr key={member.id} className="border-b border-hairline/60">
                <td className="py-2">
                  <Link href={`/admin/members/${member.id}`} className="text-brand-600 hover:underline">
                    {member.fullName}
                  </Link>
                </td>
                <td className="py-2 text-muted">{member.department?.name ?? "—"}</td>
                <td className="py-2">{score.corePct !== null ? `${score.corePct}%` : "—"}</td>
                <td className="py-2">{score.behaviouralPct !== null ? `${score.behaviouralPct}%` : "—"}</td>
                <td className="py-2 font-display font-semibold text-ink">
                  {score.overall !== null ? `${score.overall}/100` : "—"}
                </td>
                <td className="py-2 text-muted">{scoreLabel(score.overall)}</td>
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
