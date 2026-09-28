import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { redirect } from "next/navigation";
import { formatTask } from "@/lib/format";
import { getCompositeScore, scoreLabel } from "@/lib/compositeScore";
import TaskTable from "@/components/TaskTable";
import StatCard from "@/components/StatCard";
import ManualScoreForm from "@/components/ManualScoreForm";
import ManualScoresList from "@/components/ManualScoresList";

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const scope = getScope(session!);

  const [user, tasks, manualScores, composite] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.id },
      include: { department: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { userId: params.id },
      orderBy: { taskDate: "desc" },
    }),
    prisma.manualScore.findMany({ where: { userId: params.id }, orderBy: { createdAt: "desc" } }),
    getCompositeScore(params.id, null),
  ]);

  if (!user) redirect(scope.isLead ? "/admin/members" : "/admin/members");
  if (scope.isLead && user.departmentId !== scope.departmentId) redirect("/admin/members");

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">{user.fullName}</h1>
        <p className="text-sm text-muted">
          {user.jobTitle && <>{user.jobTitle} · </>}
          {user.email} · {user.department?.name ?? "No department"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard tone="sky" label="Total tasks" value={total} />
        <StatCard tone="mint" label="Done" value={done} />
        <StatCard tone="sand" label="Completion rate" value={total ? `${Math.round((done / total) * 100)}%` : "—"} />
      </div>

      <div className="card">
        <h2 className="mb-3 font-display font-semibold text-ink">Composite KPI score (this month)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Core (automatic KPIs)"
            value={composite.corePct !== null ? `${composite.corePct}%` : "No data"}
          />
          <StatCard
            label="Behavioural (manager-rated)"
            value={composite.behaviouralPct !== null ? `${composite.behaviouralPct}%` : "No data"}
          />
          <StatCard
            hero
            label={`Overall (${scoreLabel(composite.overall)})`}
            value={composite.overall !== null ? `${composite.overall}/100` : "No data"}
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          Core compares this person's completed tasks with their monthly Core target. Behavioural averages the
          manager-entered scores for this month. When both exist, they count 65% and 35%; if only one exists, it
          becomes the whole Overall. Missing data is not treated as zero.
        </p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-display font-semibold text-ink">Manual scores (Behavioural)</h2>
        <p className="text-xs text-muted">
          Add a separate 0–10 rating for each competency you want to assess. This person's entries for the selected
          month are averaged equally and contribute to Behavioural; notes provide context but do not change the score.
        </p>
        <ManualScoreForm userId={user.id} />
        <ManualScoresList
          scores={manualScores.map((s) => ({
            id: s.id,
            competency: s.competency,
            score: s.score,
            periodLabel: s.periodLabel,
            notes: s.notes,
            scorerName: s.scorerName,
            createdAt: s.createdAt.toISOString(),
          }))}
        />
      </div>

      <div className="card">
        <h2 className="mb-3 font-display font-semibold text-ink">Task history</h2>
        <TaskTable tasks={tasks.map((t) => formatTask(t))} />
      </div>
    </div>
  );
}
