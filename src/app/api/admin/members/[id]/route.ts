import { recordAssignment } from "@/lib/assignments";
import { isOptionalText, isId } from "@/lib/input";
import { serializable, BusinessError } from "@/lib/transaction";
import { audit, memberSnapshot } from "@/lib/audit";
import { recordGoal } from "@/lib/goalHistory";
import { readJson } from "@/lib/request";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage, canManageUser } from "@/lib/scope";

const ROLES = ["ADMIN", "LEAD", "MEMBER"] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates = await readJson(request);
  if (updates instanceof NextResponse) return updates;
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
    if (typeof updates.role !== "string") return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    const role = String(updates.role).toUpperCase();
    if (!ROLES.includes(role as (typeof ROLES)[number])) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    patch.role = role as (typeof ROLES)[number];
  }
  if ("department_id" in updates) {
    if (updates.department_id !== null && updates.department_id !== "" && !isId(updates.department_id)) return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    const departmentId = updates.department_id || null;
    if (departmentId !== null) {
      const exists = typeof departmentId === "string" && (await prisma.department.findUnique({ where: { id: departmentId } }));
      if (!exists) return NextResponse.json({ error: "Department not found" }, { status: 400 });
    }
    patch.departmentId = departmentId;
  }
  if ("job_title" in updates) {
    if (!isOptionalText(updates.job_title, 150)) return NextResponse.json({ error: "Invalid job title" }, { status: 400 });
    const title = typeof updates.job_title === "string" ? updates.job_title.trim() : "";
    if (title.length > 150) return NextResponse.json({ error: "Job title must be under 150 characters" }, { status: 400 });
    patch.jobTitle = title || null;
  }

  if ("archived" in updates) {
    if (typeof updates.archived !== "boolean") return NextResponse.json({ error: "archived must be true or false" }, { status: 400 });
    if (updates.archived && params.id === session.user.id) return NextResponse.json({ error: "You cannot deactivate yourself" }, { status: 400 });
  }
  try {
    await serializable(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: params.id } });
      if (!current) throw new BusinessError("Member not found", 404);
      const data = { ...patch, ...("archived" in updates ? { archivedAt: updates.archived ? new Date() : null, authVersion: { increment: 1 } } : {}) };
      if (current.role === "ADMIN" && !current.archivedAt && (data.archivedAt || (data.role && data.role !== "ADMIN"))) {
        if (await tx.user.count({ where: { role: "ADMIN", archivedAt: null } }) <= 1) throw new BusinessError("There must be at least one active administrator");
      }
      const saved = await tx.user.update({ where: { id: params.id }, data });
      await recordAssignment(tx, saved);
      // Individual goals follow the person; objective links cannot cross departments.
      if (patch.departmentId !== undefined && patch.departmentId !== current.departmentId) {
        const goals = await tx.goal.findMany({ where: { userId: current.id, objectiveId: { not: null } } });
        for (const goal of goals) {
          const updated = await tx.goal.update({ where: { id: goal.id }, data: { objectiveId: null } });
          await recordGoal(tx, updated);
        }
      }
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Admin" }, "member.update", current.id, `${current.fullName} (${current.email})`,
        { before: memberSnapshot(current), after: memberSnapshot(saved) });
    });
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
    await serializable(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: params.id } });
      if (!current) throw new BusinessError("Member not found", 404);
      if (!canManageUser(scope, current)) throw new BusinessError("Forbidden", 403);
      if (current.role === "ADMIN" && !current.archivedAt && await tx.user.count({ where: { role: "ADMIN", archivedAt: null } }) <= 1) {
        throw new BusinessError("There must be at least one active administrator");
      }
      // Retain tasks, goals and assessments when a person leaves.
      const saved = await tx.user.update({ where: { id: current.id }, data: { archivedAt: current.archivedAt ?? new Date(), authVersion: { increment: 1 } } });
      await recordAssignment(tx, saved);
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Manager" }, "member.archive", current.id, `${current.fullName} (${current.email})`,
        { before: memberSnapshot(current), after: memberSnapshot(saved) });
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return serverError(err);
  }
}
