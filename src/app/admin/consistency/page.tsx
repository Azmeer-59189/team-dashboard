import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope } from "@/lib/scope";
import ProgressBar from "@/components/ProgressBar";

const WINDOW_DAYS = 30;

export default async function ConsistencyPage({
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

  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - (WINDOW_DAYS - 1));
  windowStart.setUTCHours(0, 0, 0, 0);

  const rows = await Promise.all(
    members.map(async (m) => {
      const tasks = await prisma.task.findMany({
        where: { userId: m.id, taskDate: { gte: windowStart } },
        select: { taskDate: true },
      });
      const distinctDays = new Set(tasks.map((t) => t.taskDate.toISOString().slice(0, 10))).size;
      return { member: m, distinctDays };
    })
  );

  // sort least-consistent first so admin sees who needs attention
  rows.sort((a, b) => a.distinctDays - b.distinctDays);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Consistency</h1>
        <p className="text-sm text-muted">
          Days with at least one task logged, out of the last {WINDOW_DAYS} days. Any status counts here (not just "done") — this tracks who's showing up, not just who's finishing work.
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

      <div className="card space-y-4">
        {rows.map(({ member, distinctDays }) => (
          <div key={member.id}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-medium">{member.fullName}</span>
              <span className="text-xs text-muted">{member.department?.name ?? "No department"}</span>
            </div>
            <ProgressBar label="Active days" progress={distinctDays} target={WINDOW_DAYS} />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">No members found.</p>}
      </div>
    </div>
  );
}
