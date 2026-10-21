import { validateGoalInput, isId } from "@/lib/input";
import { isValidDate } from "@/lib/validation";
import { getPeriodRange } from "@/lib/periods";
import { recordGoal } from "@/lib/goalHistory";
import { serializable, BusinessError } from "@/lib/transaction";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/request";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage, canManageUser } from "@/lib/scope";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [departmentGoals, memberGoals] = await Promise.all([
    prisma.goal.findMany({
      where: { departmentId: scope.isLead ? scope.departmentId : { not: null } },
      include: { department: { select: { name: true } }, objective: { select: { title: true } } },
      orderBy: [{ period: "asc" }],
    }),
    prisma.goal.findMany({
      where: {
        userId: { not: null },
        ...(scope.isLead ? { user: { departmentId: scope.departmentId } } : {}),
      },
      include: {
        user: { select: { fullName: true, department: { select: { name: true } } } },
        objective: { select: { title: true } },
      },
      orderBy: [{ period: "asc" }],
    }),
  ]);

  return NextResponse.json({
    departmentGoals: departmentGoals.map((g) => ({
      id: g.id,
      departmentId: g.departmentId,
      departmentName: g.department?.name,
      period: g.period,
      targetCount: g.targetCount,
      weight: g.weight,
      category: g.category,
      objectiveId: g.objectiveId,
      objectiveTitle: (g as any).objective?.title ?? null,
    })),
    memberGoals: memberGoals.map((g) => ({
      id: g.id,
      userId: g.userId,
      memberName: g.user?.fullName,
      departmentName: g.user?.department?.name ?? null,
      period: g.period,
      targetCount: g.targetCount,
      weight: g.weight,
      category: g.category,
      objectiveId: g.objectiveId,
      objectiveTitle: (g as any).objective?.title ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const { scope: goalScope, departmentId, userId, period, objectiveId } = body;
  const error = validateGoalInput(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!["department", "member"].includes(goalScope) || !["WEEKLY", "MONTHLY", "ANNUAL"].includes(period)) {
    return NextResponse.json({ error: "Invalid scope or period" }, { status: 400 });
  }
  if (objectiveId != null && objectiveId !== "" && !isId(objectiveId)) return NextResponse.json({ error: "Invalid objective" }, { status: 400 });
  const start = getPeriodRange(period).start;
  const effectiveFrom = body.effectiveFrom === undefined ? start : new Date(body.effectiveFrom);
  if (body.effectiveFrom !== undefined && (!isValidDate(body.effectiveFrom) || effectiveFrom < start || getPeriodRange(period, effectiveFrom).start.getTime() !== effectiveFrom.getTime())) {
    return NextResponse.json({ error: "Effective date must be the start of the current or a future goal period" }, { status: 400 });
  }
  try {
    const goal = await serializable(async (tx) => {
      let goalDepartmentId: string | null;
      if (goalScope === "department") {
        if (!isId(departmentId)) throw new BusinessError("Department is required");
        if (scope.isLead && departmentId !== scope.departmentId) throw new BusinessError("Forbidden", 403);
        goalDepartmentId = departmentId;
      } else {
        if (!isId(userId)) throw new BusinessError("Member is required");
        const target = await tx.user.findUnique({ where: { id: userId } });
        if (!target || target.archivedAt) throw new BusinessError("Member not found", 404);
        if (!canManageUser(scope, target)) throw new BusinessError("You cannot manage this member's goal", 403);
        goalDepartmentId = target.departmentId;
      }
      if (objectiveId && (!goalDepartmentId || !(await tx.objective.findFirst({ where: { id: objectiveId, departmentId: goalDepartmentId } })))) {
        throw new BusinessError("Objective must belong to the same department");
      }
      const where = goalScope === "department" ? { departmentId_period: { departmentId, period } } : { userId_period: { userId, period } };
      const before = await tx.goal.findUnique({ where });
      const data = { targetCount: Number(body.targetCount), weight: body.weight == null || body.weight === "" ? 1 : Number(body.weight), category: body.category ?? "CORE", objectiveId: objectiveId || null };
      const saved = await tx.goal.upsert({ where,
        create: { ...data, period, ...(goalScope === "department" ? { departmentId } : { userId }) }, update: data });
      await recordGoal(tx, saved, effectiveFrom);
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Manager" }, "goal.save", saved.id, `${period} goal`, { before, after: saved, effectiveFrom });
      return saved;
    });
    return NextResponse.json({ goal });
  } catch (err) { return serverError(err); }
}
