import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage, canManageUser } from "@/lib/scope";
import { logAudit } from "@/lib/audit";

const ROLES = ["ADMIN", "LEAD", "MEMBER"] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates = await request.json().catch(() => null);
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const patch: { fullName?: string; role?: (typeof ROLES)[number]; departmentId?: string | null; jobTitle?: string | null } = {};
  if ("full_name" in updates) {
    const name = typeof updates.full_name === "string" ? updates.full_name.trim() : "";
    if (!name || name.length > 200) {
      return NextResponse.json({ error: "Name must be between 1 and 200 characters" }, { status: 400 });
    }
    patch.fullName = name;
  }
  if ("role" in updates) {
    const role = String(updates.role).toUpperCase();
    if (!ROLES.includes(role as (typeof ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    patch.role = role as (typeof ROLES)[number];
  }
  if ("department_id" in updates) {
    const departmentId = updates.department_id || null;
    if (departmentId !== null) {
      const exists = typeof departmentId === "string" && (await prisma.department.findUnique({ where: { id: departmentId } }));
      if (!exists) return NextResponse.json({ error: "Department not found" }, { status: 400 });
    }
    patch.departmentId = departmentId;
  }
  if ("job_title" in updates) {
    const title = typeof updates.job_title === "string" ? updates.job_title.trim() : "";
    if (title.length > 150) return NextResponse.json({ error: "Job title must be under 150 characters" }, { status: 400 });
    patch.jobTitle = title || null;
  }

  // never leave the organization without an administrator
  if (target.role === "ADMIN" && patch.role && patch.role !== "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      return NextResponse.json({ error: "There must be at least one administrator" }, { status: 400 });
    }
  }

  try {
    await prisma.user.update({ where: { id: params.id }, data: patch });
    const changes = Object.keys(patch).join(", ");
    await logAudit(
      { id: session.user.id, name: session.user.name ?? session.user.email ?? "Admin" },
      "member.update",
      `${target.fullName} (${target.email})${changes ? ` - ${changes}` : ""}`
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Could not update member");
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
  if (!canManageUser(scope, target)) {
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
    return serverError(err);
  }
}
