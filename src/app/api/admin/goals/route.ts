import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";

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

  const { scope: goalScope, departmentId, userId, period, targetCount, objectiveId } = await request.json();

  if (!["department", "member"].includes(goalScope)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }
  if (!["WEEKLY", "MONTHLY"].includes(period)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  const target = Number(targetCount);
  if (!Number.isFinite(target) || target <= 0) {
    return NextResponse.json({ error: "Target must be a positive number" }, { status: 400 });
  }

  try {
    if (goalScope === "department") {
      if (!departmentId) return NextResponse.json({ error: "Department is required" }, { status: 400 });
      if (scope.isLead && departmentId !== scope.departmentId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const goal = await prisma.goal.upsert({
        where: { departmentId_period: { departmentId, period } },
        create: { departmentId, period, targetCount: target, objectiveId: objectiveId || null },
        update: { targetCount: target, objectiveId: objectiveId || null },
      });
      return NextResponse.json({ goal });
    } else {
      if (!userId) return NextResponse.json({ error: "Member is required" }, { status: 400 });
      if (scope.isLead) {
        const target_user = await prisma.user.findUnique({ where: { id: userId } });
        if (!target_user || target_user.departmentId !== scope.departmentId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
      const goal = await prisma.goal.upsert({
        where: { userId_period: { userId, period } },
        create: { userId, period, targetCount: target, objectiveId: objectiveId || null },
        update: { targetCount: target, objectiveId: objectiveId || null },
      });
      return NextResponse.json({ goal });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
