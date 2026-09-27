import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, competency, score, periodLabel, notes } = await request.json();

  if (!userId || !competency || score === undefined || score === null || !periodLabel) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 10) {
    return NextResponse.json({ error: "Score must be between 0 and 10" }, { status: 400 });
  }
  if (typeof competency !== "string" || competency.trim().length === 0 || competency.trim().length > 100) {
    return NextResponse.json({ error: "Competency must be 1-100 characters" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(periodLabel)) {
    return NextResponse.json({ error: "Period must be in YYYY-MM format" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (scope.isLead && target.departmentId !== scope.departmentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const entry = await prisma.manualScore.create({
      data: {
        userId,
        scorerId: session.user.id,
        scorerName: session.user.name ?? session.user.email ?? "Manager",
        competency: competency.trim(),
        score: numericScore,
        periodLabel,
        notes: notes || null,
      },
    });
    await logAudit(
      { id: session.user.id, name: session.user.name ?? session.user.email ?? "Admin" },
      "manual_score.create",
      `${target.fullName} - ${competency.trim()} (${periodLabel})`
    );
    return NextResponse.json({ entry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
