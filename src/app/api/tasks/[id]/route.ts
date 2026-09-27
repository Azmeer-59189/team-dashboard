import { NextResponse } from "next/server";
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

  const updates = await request.json();

  const validationError = validateTaskFields({
    type: updates.type,
    content: updates.content,
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
    await prisma.task.update({ where: { id: params.id }, data: patch });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await canModify(params.id, session.user.id, session.user.role === "ADMIN");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await prisma.task.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
