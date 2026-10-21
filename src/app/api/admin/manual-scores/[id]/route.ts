import { serializable, BusinessError } from "@/lib/transaction";
import { assertMonthsOpen } from "@/lib/reports";
import { audit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage, canManageUser } from "@/lib/scope";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const entry = await prisma.manualScore.findUnique({ where: { id: params.id }, include: { user: true } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageUser(scope, entry.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await serializable(async (tx) => {
      const current = await tx.manualScore.findUnique({ where: { id: params.id }, include: { user: true } });
      if (!current) throw new BusinessError("Not found", 404);
      if (!canManageUser(scope, current.user)) throw new BusinessError("Forbidden", 403);
      await assertMonthsOpen(tx, [current.periodLabel]);
      await tx.manualScore.delete({ where: { id: current.id } });
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Manager" }, "manual_score.delete", current.id, current.competency, { before: { id: current.id, userId: current.userId, score: current.score, competency: current.competency, periodLabel: current.periodLabel } });
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return serverError(err);
  }
}
