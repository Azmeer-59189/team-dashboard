import { serializable, BusinessError } from "@/lib/transaction";
import { audit } from "@/lib/audit";
import { validateObjectiveInput } from "@/lib/input";
import { readJson } from "@/lib/request";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.objective.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scope.isLead && existing.departmentId !== scope.departmentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates = await readJson(request);
  if (updates instanceof NextResponse) return updates;
  const validationError = validateObjectiveInput(updates, true);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if ("title" in updates) patch.title = updates.title;
  if ("description" in updates) patch.description = updates.description || null;
  if ("targetTaskCount" in updates) patch.targetTaskCount = updates.targetTaskCount ? Number(updates.targetTaskCount) : null;

  try {
    await serializable(async (tx) => {
      const before = await tx.objective.findUnique({ where: { id: params.id } });
      if (!before) throw new BusinessError("Not found", 404);
      if (scope.isLead && before.departmentId !== scope.departmentId) throw new BusinessError("Forbidden", 403);
      const after = await tx.objective.update({ where: { id: params.id }, data: patch });
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Manager" }, "objective.update", before.id, before.title, { before, after });
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return serverError(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.objective.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scope.isLead && existing.departmentId !== scope.departmentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await serializable(async (tx) => {
      const before = await tx.objective.findUnique({ where: { id: params.id } });
      if (!before) throw new BusinessError("Not found", 404);
      if (scope.isLead && before.departmentId !== scope.departmentId) throw new BusinessError("Forbidden", 403);
      await tx.objective.delete({ where: { id: before.id } });
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Manager" }, "objective.delete", before.id, before.title, { before });
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return serverError(err);
  }
}
