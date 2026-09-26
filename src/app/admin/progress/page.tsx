import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { getMemberGoalProgress } from "@/lib/goals";
import ProgressBar from "@/components/ProgressBar";

export default async function ProgressPage({
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
      ...(scope.isLead ? { departmentId: scope.departmentId } : searchParams.department ? { departmentId: searchParams.department } : {}),
    },
    include: { department: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  });

  const rows = await Promise.all(
    members.map(async (m) => ({
      member: m,
      goals: await getMemberGoalProgress(m.id, m.departmentId),
    }))
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">KPI Progress</h1>
        <p className="text-sm text-muted">Based on tasks marked "done" in the current week/month.</p>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map(({ member, goals }) => (
          <div key={member.id} className="card space-y-3">
            <div>
              <p className="font-display font-semibold text-ink">{member.fullName}</p>
              <p className="text-xs text-muted">{member.department?.name ?? "No department"}</p>
            </div>
            {goals.length === 0 ? (
              <p className="text-sm text-gray-400">No KPI set for this member.</p>
            ) : (
              goals.map((g) => (
                <ProgressBar
                  key={g.period}
                  label={`${g.period === "WEEKLY" ? "This week" : "This month"}${
                    g.source === "member" ? " (custom)" : ""
                  }`}
                  progress={g.progress}
                  target={g.target}
                />
              ))
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">No members found.</p>}
      </div>
    </div>
  );
}
