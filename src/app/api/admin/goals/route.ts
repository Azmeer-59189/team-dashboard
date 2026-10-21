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

  const { scope: goalScope, departmentId, userId, period, targetCount, objectiveId, weight, category } =
    await request.json();

  if (!["department", "member"].includes(goalScope)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }
  if (!["WEEKLY", "MONTHLY", "ANNUAL"].includes(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  const target = Number(targetCount);
  if (!Number.isFinite(target) || target <= 0) {
    return NextResponse.json({ error: "Target must be a positive number" }, { status: 400 });
  }
  const goalWeight = weight !== undefined && weight !== null && weight !== "" ? Number(weight) : 1;
  if (!Number.isFinite(goalWeight) || goalWeight <= 0) {
    return NextResponse.json({ error: "Weight must be a positive number" }, { status: 400 });
  }
  const goalCategory = category === "BEHAVIOURAL" ? "BEHAVIOURAL" : "CORE";
  if (objectiveId != null && objectiveId !== "" && typeof objectiveId !== "string") {
    return NextResponse.json({ error: "Invalid objective" }, { status: 400 });
  }

  // A goal can only feed an objective of the department it applies to; otherwise one
  // department's KPIs would move another department's objective progress.
  async function objectiveBelongsTo(goalDepartmentId: string | null) {
    if (!objectiveId) return true;
    if (!goalDepartmentId) return false;
    const objective = await prisma.objective.findFirst({
      where: { id: objectiveId, departmentId: goalDepartmentId },
      select: { id: true },
    });
    return objective != null;
  }

  try {
    if (goalScope === "department") {
      if (!departmentId) return NextResponse.json({ error: "Department is required" }, { status: 400 });
      if (typeof departmentId !== "string") return NextResponse.json({ error: "Invalid department" }, { status: 400 });
      if (scope.isLead && departmentId !== scope.departmentId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!(await objectiveBelongsTo(departmentId))) {
        return NextResponse.json({ error: "Objective must belong to the same department" }, { status: 400 });
      }
      const goal = await prisma.goal.upsert({
        where: { departmentId_period: { departmentId, period } },
        create: { departmentId, period, targetCount: target, objectiveId: objectiveId || null, weight: goalWeight, category: goalCategory },
        update: { targetCount: target, objectiveId: objectiveId || null, weight: goalWeight, category: goalCategory },
      });
      return NextResponse.json({ goal });
    } else {
      if (!userId) return NextResponse.json({ error: "Member is required" }, { status: 400 });
      if (typeof userId !== "string") return NextResponse.json({ error: "Invalid member" }, { status: 400 });
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) return NextResponse.json({ error: "Member not found" }, { status: 404 });
      // nobody sets their own target; leads only set targets for members of their department
      if (targetUser.id === scope.userId) {
        return NextResponse.json({ error: "You can't set your own goal" }, { status: 403 });
      }
      if (!canManageUser(scope, targetUser)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!(await objectiveBelongsTo(targetUser.departmentId))) {
        return NextResponse.json({ error: "Objective must belong to the member's department" }, { status: 400 });
      }
      const goal = await prisma.goal.upsert({
        where: { userId_period: { userId, period } },
        create: { userId, period, targetCount: target, objectiveId: objectiveId || null, weight: goalWeight, category: goalCategory },
        update: { targetCount: target, objectiveId: objectiveId || null, weight: goalWeight, category: goalCategory },
      });
      return NextResponse.json({ goal });
    }
  } catch (err: any) {
    return serverError(err);
  }
}
