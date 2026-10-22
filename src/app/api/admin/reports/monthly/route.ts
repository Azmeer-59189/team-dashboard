import { assignmentsAt } from "@/lib/assignments";
import { applicableGoals } from "@/lib/goalHistory";
import { resolveGoal } from "@/lib/scoring";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { readJson } from "@/lib/request";
import { isMonth } from "@/lib/input";
import { monthLabel, todayInTimeZone } from "@/lib/dates";
import { getCompositeScores } from "@/lib/compositeScore";
import { getPeriodRange } from "@/lib/periods";
import { serializable, BusinessError } from "@/lib/transaction";
import { audit } from "@/lib/audit";
import { serverError } from "@/lib/apiError";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const periodLabel = new URL(request.url).searchParams.get("month");
  if (!isMonth(periodLabel)) return NextResponse.json({ error: "Provide month as YYYY-MM" }, { status: 400 });
  const report = await prisma.monthlyReport.findUnique({ where: { periodLabel } });
  return report ? NextResponse.json({ report }) : NextResponse.json({ error: "Month has not been finalized" }, { status: 404 });
}

// Explicit admin action. Repeating it returns the original report unchanged.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  if (!isMonth(body.month) || body.month >= monthLabel(todayInTimeZone())) {
    return NextResponse.json({ error: "Only completed calendar months can be finalized" }, { status: 400 });
  }
  try {
    const report = await serializable(async (tx) => {
      const existing = await tx.monthlyReport.findUnique({ where: { periodLabel: body.month } });
      if (existing) return existing;
      const reference = new Date(`${body.month}-01T00:00:00Z`);
      const { start, end } = getPeriodRange("MONTHLY", reference);
      const pendingReviews = await tx.task.count({ where: { taskDate: { gte: start, lte: end }, reviewStatus: "SUBMITTED" } });
      if (pendingReviews > 0) throw new BusinessError("Review all submitted tasks before finalizing this month", 409);
      const cutoff = new Date(end.getTime() + 86400000);
      const candidates = await tx.user.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true, fullName: true, departmentId: true, department: { select: { name: true } } } });
      const historical = await assignmentsAt(candidates, end, tx);
      const members = historical.filter((m) => m.role && ["MEMBER", "LEAD"].includes(m.role));
      const departments = await tx.department.findMany({ select: { id: true, name: true } });
      const names = new Map(departments.map((d) => [d.id, d.name]));
      for (const member of members) member.department = member.departmentId ? { name: names.get(member.departmentId) ?? "Former department" } : null;
      if (!members.length) throw new BusinessError("No members exist for this month");
      const scores = await getCompositeScores(members, end, tx);
      const [goals, counts, ratings] = await Promise.all([
        applicableGoals(members, end, tx),
        tx.task.groupBy({ by: ["userId"], where: { userId: { in: members.map((m) => m.id) }, status: "DONE", reviewStatus: "APPROVED", taskDate: { gte: start, lte: end } }, _count: { _all: true } }),
        tx.manualScore.findMany({ where: { userId: { in: members.map((m) => m.id) }, periodLabel: body.month, supersededAt: null } }),
      ]);
      const rows = members.map((member) => ({ member, score: scores.get(member.id)!, evidence: {
        goal: resolveGoal(goals, member.id, member.departmentId, "MONTHLY") ?? null,
        doneTaskCount: counts.find((c) => c.userId === member.id)?._count._all ?? 0,
        assessments: ratings.filter((r) => r.userId === member.id), formulaVersion: "core65-behavioural35-v1-taskDate",
      } }));
      const saved = await tx.monthlyReport.create({ data: {
        periodLabel: body.month, finalizedBy: session.user.id, rows: JSON.parse(JSON.stringify(rows)),
      } });
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Admin" }, "report.finalize", body.month, `Monthly report ${body.month}`, { memberCount: rows.length });
      return saved;
    });
    return NextResponse.json({ report });
  } catch (error) { return serverError(error); }
}
