import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope } from "@/lib/scope";
import ProgressBar from "@/components/ProgressBar";
import { windowStart, todayInTimeZone } from "@/lib/dates";

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
      archivedAt: null, role: { in: ["MEMBER", "LEAD"] },
      ...(scope.isLead
        ? { departmentId: scope.departmentId }
        : searchParams.department
        ? { departmentId: searchParams.department }
        : {}),
    },
    include: { department: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  });

  // One grouped query for everyone: each (user, day) pair with at least one task is an active day.
  const activeDays = await prisma.task.groupBy({
    by: ["userId", "taskDate"],
    where: { userId: { in: members.map((m) => m.id) }, taskDate: { gte: windowStart(WINDOW_DAYS), lte: todayInTimeZone() } },
  });
  const daysByUser = new Map<string, number>();
  for (const d of activeDays) daysByUser.set(d.userId, (daysByUser.get(d.userId) ?? 0) + 1);

  const rows = members.map((m) => ({ member: m, distinctDays: daysByUser.get(m.id) ?? 0 }));

  // sort least-consistent first so admin sees who needs attention
  rows.sort((a, b) => a.distinctDays - b.distinctDays);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Performance" title="Consistency" description={<>Counts days with at least one task logged in the last {WINDOW_DAYS} days. Any task status counts. This reflects task-logging activity; it does not measure completed work and does not affect the Composite Score.</>} />

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

      <div className="card divide-y divide-hairline !py-2">
        {rows.map(({ member, distinctDays }) => (
          <div key={member.id} className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[220px_1fr] sm:items-center sm:gap-6">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="avatar h-9 w-9 text-xs">
                {member.fullName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{member.fullName}</p>
                <p className="text-xs text-muted">{member.department?.name ?? "No department"}</p>
              </div>
            </div>
            <ProgressBar label="Active days" progress={distinctDays} target={WINDOW_DAYS} unit="days" />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">No members found.</p>}
      </div>
    </div>
  );
}
