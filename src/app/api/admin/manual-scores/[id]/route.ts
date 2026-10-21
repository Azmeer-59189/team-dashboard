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
    await prisma.manualScore.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return serverError(err);
  }
}
