import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";
import { todayInTimeZone } from "@/lib/dates";
import { formatTask } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import TaskTable from "@/components/TaskTable";
import AssignTaskForm from "@/components/AssignTaskForm";

const filters: Record<string, string> = { SUBMITTED: "Awaiting review", DRAFT: "Not submitted", CHANGES_REQUESTED: "Changes requested", APPROVED: "Approved", CANCELLED: "Cancelled", ALL: "All active work" };
export default async function AssignmentsPage({ searchParams }: { searchParams: { state?: string; after?: string; q?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const scope = getScope(session);
  if (!canManage(scope)) redirect(scope.isLead ? "/no-department" : "/member");
  const state = searchParams.state && filters[searchParams.state] ? searchParams.state : "SUBMITTED";
  const search = searchParams.q?.trim().slice(0, 200) ?? "";
  const base: Prisma.TaskWhereInput = {
    userId: { not: session.user.id },
    ...(scope.isLead ? { departmentId: scope.departmentId, user: { departmentId: scope.departmentId, role: "MEMBER" } } : {}),
  };
  const where: Prisma.TaskWhereInput = { AND: [base, state === "CANCELLED" ? { cancelledAt: { not: null } } : { cancelledAt: null },
    ...(["ALL", "CANCELLED"].includes(state) ? [] : [{ reviewStatus: state as "SUBMITTED" | "DRAFT" | "CHANGES_REQUESTED" | "APPROVED" }]),
    ...(search ? [{ OR: [{ content: { contains: search, mode: "insensitive" as const } }, { user: { fullName: { contains: search, mode: "insensitive" as const } } }] }] : []),
    ...(searchParams.after ? [{ id: { lt: searchParams.after } }] : []),
  ] };
  const [members, objectives, tasks, awaiting] = await Promise.all([
    prisma.user.findMany({ where: { archivedAt: null, id: { not: session.user.id }, ...(scope.isLead ? { role: "MEMBER", departmentId: scope.departmentId } : {}) },
      select: { id: true, fullName: true, departmentId: true, department: { select: { name: true } } }, orderBy: { fullName: "asc" } }),
    prisma.objective.findMany({ where: scope.isLead ? { departmentId: scope.departmentId! } : {}, select: { id: true, title: true, departmentId: true }, orderBy: { title: "asc" } }),
    prisma.task.findMany({ where, orderBy: { id: "desc" }, take: 51,
      include: { user: { select: { fullName: true } }, department: { select: { name: true } } } }),
    prisma.task.count({ where: { AND: [base, { reviewStatus: "SUBMITTED", cancelledAt: null }] } }),
  ]);
  const page = tasks.slice(0, 50);
  function pageUrl(after?: string) {
    const params = new URLSearchParams({ state });
    if (search) params.set("q", search);
    if (after) params.set("after", after);
    return `/admin/assignments?${params}`;
  }
  return <div className="space-y-6">
    <PageHeader eyebrow="Workspace" title="Assignments & reviews" description={`${awaiting} task${awaiting === 1 ? "" : "s"} awaiting your team's review. Assign work, approve submissions, or request changes.`} />
    <AssignTaskForm members={members} objectives={objectives} today={todayInTimeZone().toISOString().slice(0, 10)} />
    <form className="card flex flex-wrap items-end gap-3" method="get">
      <label className="block"><span className="label">Workflow</span><select name="state" defaultValue={state} className="input min-w-[190px]">{Object.entries(filters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block min-w-[180px] flex-1"><span className="label">Search work or person</span><input name="q" defaultValue={search} maxLength={200} className="input" placeholder="Search tasks or team members" /></label>
      <button className="btn-secondary">Apply filters</button>
    </form>
    <section className="card"><h2 className="card-title mb-4">{filters[state]}</h2>
      <TaskTable tasks={page.map(formatTask)} showOwner reviewable viewerId={session.user.id} assignmentMembers={members.map((m) => ({ id: m.id, fullName: m.fullName }))} />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <p>Showing {page.length} tasks. Your own work is managed in My Tasks.</p>
        <div className="flex gap-3">{searchParams.after && <Link className="btn-secondary" href={pageUrl()}>Newest tasks</Link>}{tasks.length > 50 && <Link className="btn-secondary" href={pageUrl(page[page.length - 1].id)}>Next page</Link>}</div>
      </div>
    </section>
  </div>;
}
