import { serializable, BusinessError } from "@/lib/transaction";
import { recordGoal } from "@/lib/goalHistory";
import { getPeriodRange } from "@/lib/periods";
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

  const goal = await prisma.goal.findUnique({ where: { id: params.id }, include: { user: true } });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  // department defaults: a lead may delete their own department's; individual goals
  // follow the same rule as setting them (nobody removes their own target)
  const allowed = goal.user
    ? canManageUser(scope, goal.user)
    : scope.isAdmin || goal.departmentId === scope.departmentId;
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await serializable(async (tx) => {
      const current = await tx.goal.findUnique({ where: { id: params.id }, include: { user: true } });
      if (!current) throw new BusinessError("Goal not found", 404);
      const permitted = current.user ? canManageUser(scope, current.user) : scope.isAdmin || current.departmentId === scope.departmentId;
      if (!permitted) throw new BusinessError("Forbidden", 403);
      await recordGoal(tx, current, undefined, true);
      // Cancel scheduled revisions so a deleted goal cannot return next month.
      await tx.goalRevision.deleteMany({ where: { goalId: current.id, effectiveFrom: { gt: getPeriodRange(current.period).start } } });
      await tx.goal.delete({ where: { id: current.id } });
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Manager" }, "goal.delete", current.id, "KPI goal", { before: { ...current, user: undefined } });
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return serverError(err);
  }
}
