import { serializable, BusinessError } from "@/lib/transaction";
import { assertMonthsOpen } from "@/lib/reports";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/request";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { statusToDb, typeToDb, priorityToDb } from "@/lib/format";
import { validateTaskFields } from "@/lib/validation";

async function canModify(taskId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { userId: true } });
  return task?.userId === userId;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await canModify(params.id, session.user.id, session.user.role === "ADMIN");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updates = await readJson(request);
  if (updates instanceof NextResponse) return updates;
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
  }
  const existing = await prisma.task.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const validationError = validateTaskFields({
    type: updates.type === undefined ? existing.type.toLowerCase() : updates.type,
    content: updates.content === undefined ? existing.content : updates.content,
    task_date: updates.task_date,
    status: updates.status,
    category: updates.category,
    chapter: updates.chapter,
    campaign: updates.campaign,
    priority: updates.priority,
    due_date: updates.due_date,
    delivered_date: updates.delivered_date,
    revision_rounds: updates.revision_rounds,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("content" in updates) patch.content = updates.content.trim();
  if ("type" in updates) patch.type = typeToDb(updates.type);
  if ("task_date" in updates) patch.taskDate = new Date(updates.task_date);
  if ("status" in updates) patch.status = statusToDb(updates.status);
  if ("category" in updates) patch.category = updates.category || null;
  if ("chapter" in updates) patch.chapter = updates.chapter || null;
  if ("campaign" in updates) patch.campaign = updates.campaign || null;
  if ("priority" in updates) patch.priority = updates.priority ? priorityToDb(updates.priority) : null;
  if ("due_date" in updates) patch.dueDate = updates.due_date ? new Date(updates.due_date) : null;
  if ("delivered_date" in updates) patch.deliveredDate = updates.delivered_date ? new Date(updates.delivered_date) : null;
  if ("revision_rounds" in updates) {
    patch.revisionRounds =
      updates.revision_rounds !== null && updates.revision_rounds !== "" ? Number(updates.revision_rounds) : null;
  }

  try {
    await serializable(async (tx) => {
      const current = await tx.task.findUnique({ where: { id: params.id } });
      if (!current) throw new BusinessError("Task not found", 404);
      if (session.user.role !== "ADMIN" && current.userId !== session.user.id) throw new BusinessError("Forbidden", 403);
      if (current.version !== existing.version || (updates.version !== undefined && updates.version !== current.version)) {
        throw new BusinessError("This task changed. Refresh and try again.", 409);
      }
      await assertMonthsOpen(tx, [current.taskDate, patch.taskDate instanceof Date ? patch.taskDate : current.taskDate]);
      const nextStatus = patch.status ?? current.status;
      patch.completedAt = nextStatus === "DONE" ? (current.status === "DONE" ? current.completedAt : new Date()) : null;
      patch.version = { increment: 1 };
      const saved = await tx.task.update({ where: { id: current.id }, data: patch });
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Member" }, "task.update", current.id, current.content.slice(0, 100), { before: current, after: saved });
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return serverError(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await canModify(params.id, session.user.id, session.user.role === "ADMIN");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await serializable(async (tx) => {
      const current = await tx.task.findUnique({ where: { id: params.id } });
      if (!current) throw new BusinessError("Task not found", 404);
      if (session.user.role !== "ADMIN" && current.userId !== session.user.id) throw new BusinessError("Forbidden", 403);
      await assertMonthsOpen(tx, [current.taskDate]);
      await tx.task.delete({ where: { id: current.id } });
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Member" }, "task.delete", current.id, current.content.slice(0, 100), { before: current });
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return serverError(err);
  }
}
