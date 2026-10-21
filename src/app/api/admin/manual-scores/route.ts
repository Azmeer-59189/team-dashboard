import { validateRatingInput } from "@/lib/input";
import { serializable, BusinessError } from "@/lib/transaction";
import { assertMonthsOpen } from "@/lib/reports";
import { ratingKey } from "@/lib/ratings";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/request";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage, canManageUser } from "@/lib/scope";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const { userId, competency, score, periodLabel, notes } = body;

  const validationError = validateRatingInput(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const numericScore = Number(score);

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.id === scope.userId) {
    return NextResponse.json({ error: "You can't score yourself" }, { status: 403 });
  }
  if (!canManageUser(scope, target)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const entry = await serializable(async (tx) => {
      const currentTarget = await tx.user.findUnique({ where: { id: userId } });
      if (!currentTarget || currentTarget.archivedAt || !canManageUser(scope, currentTarget)) throw new BusinessError("Forbidden", 403);
      await assertMonthsOpen(tx, [periodLabel]);
      const key = ratingKey(userId, periodLabel, competency, session.user.id);
      const before = await tx.manualScore.findUnique({ where: { ratingKey: key } })
        ?? await tx.manualScore.findFirst({ where: { userId, periodLabel, scorerId: session.user.id, supersededAt: null,
          competency: { equals: competency.trim(), mode: "insensitive" } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      const data = { userId, scorerId: session.user.id, scorerName: session.user.name ?? "Manager",
        competency: competency.trim(), score: numericScore, periodLabel, notes: notes || null, supersededAt: null };
      const saved = before
        ? await tx.manualScore.update({ where: { id: before.id }, data: { ...data, ratingKey: key } })
        : await tx.manualScore.create({ data: { ...data, ratingKey: key } });
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Manager" }, before ? "manual_score.update" : "manual_score.create",
        saved.id, `${currentTarget.fullName} - ${competency.trim()} (${periodLabel})`, { before, after: saved });
      return saved;
    });
    return NextResponse.json({ entry });
  } catch (err: any) {
    return serverError(err);
  }
}
