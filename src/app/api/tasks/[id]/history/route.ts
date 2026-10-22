import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { canReviewTask } from "@/lib/taskWorkflow";
import { serverError } from "@/lib/apiError";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const task = await prisma.task.findUnique({ where: { id: params.id }, include: { user: { select: { id: true, role: true, departmentId: true } } } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (task.userId !== session.user.id && !canReviewTask(getScope(session), task, task.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const before = new URL(request.url).searchParams.get("before");
    const rows = await prisma.auditLog.findMany({ where: { targetId: task.id, action: { startsWith: "task." }, ...(before ? { id: { lt: before } } : {}) },
      orderBy: { id: "desc" }, take: 21, select: { id: true, action: true, actorName: true, createdAt: true, details: true } });
    const page = rows.slice(0, 20);
    return NextResponse.json({ events: page.map((row) => {
      const details = row.details && typeof row.details === "object" && !Array.isArray(row.details) ? row.details : {};
      return { id: row.id, action: row.action, actorName: row.actorName, createdAt: row.createdAt,
        note: typeof details.note === "string" ? details.note : null };
    }), nextCursor: rows.length > 20 ? page[page.length - 1].id : null });
  } catch (error) { return serverError(error); }
}
