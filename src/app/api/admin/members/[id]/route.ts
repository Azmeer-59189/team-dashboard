import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates = await request.json();
  const patch: Record<string, unknown> = {};
  if ("full_name" in updates) patch.fullName = updates.full_name;
  if ("role" in updates) patch.role = String(updates.role).toUpperCase();
  if ("department_id" in updates) patch.departmentId = updates.department_id || null;

  try {
    await prisma.user.update({ where: { id: params.id }, data: patch });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (session.user.id === params.id) {
    return NextResponse.json({ error: "You cannot remove your own account" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // a lead may only remove members within their own department, and never an admin/lead
  if (scope.isLead && (target.departmentId !== scope.departmentId || target.role !== "MEMBER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.user.delete({ where: { id: params.id } });
    await logAudit(
      { id: session.user.id, name: session.user.name ?? session.user.email ?? "Admin" },
      "member.delete",
      `${target.fullName} (${target.email})`
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
