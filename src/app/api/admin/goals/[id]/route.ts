import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (scope.isLead) {
    const goal = await prisma.goal.findUnique({ where: { id: params.id }, include: { user: true } });
    const belongsToLead =
      goal?.departmentId === scope.departmentId || goal?.user?.departmentId === scope.departmentId;
    if (!belongsToLead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.goal.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
