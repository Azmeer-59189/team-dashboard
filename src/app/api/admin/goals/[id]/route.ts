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
    await prisma.goal.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return serverError(err);
  }
}
