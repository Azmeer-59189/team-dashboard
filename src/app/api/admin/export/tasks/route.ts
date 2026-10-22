import { taskWhere } from "@/lib/taskQuery";
import { serverError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";
import { statusToDb, typeFromDb, statusFromDb, priorityFromDb } from "@/lib/format";

function csvEscape(value: string) {
  if (/^[=+@\-\t\r]/.test(value)) value = "'" + value;
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  let where;
  try { where = taskWhere(searchParams, scope); }
  catch (error) { return serverError(error); }
  // Ignore rows created after this export started; cursor pages stay bounded in memory.
  const startedAt = new Date();
  where = { ...where, createdAt: { lte: startedAt } };
  const header = [
    "Date",
    "Member",
    "Email",
    "Department",
    "Type",
    "Status",
    "Content",
    "Category",
    "Chapter",
    "Campaign",
    "Priority",
    "Due Date",
    "Delivered Date",
    "Revision Rounds",
    "Review Status",
    "Assigned By",
    "Submitted Work",
    "Submitted At",
    "Review Feedback",
    "Reviewed By",
    "Reviewed At",
    "Cancelled At",
    "Cancelled By",
    "Cancellation Reason",
  ];
  const encoder = new TextEncoder();
  let cursor: string | undefined;
  let headerSent = false;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!headerSent) {
          controller.enqueue(encoder.encode(header.map(csvEscape).join(",") + "\r\n"));
          headerSent = true;
          return;
        }
        const tasks = await prisma.task.findMany({
          where: cursor ? { AND: [where, { id: { gt: cursor } }] } : where,
          include: { user: { select: { fullName: true, email: true } }, department: { select: { name: true } } },
          orderBy: { id: "asc" }, take: 500,
        });
        if (cancelled) return;
        const rows = tasks.map((t) => [
    t.taskDate.toISOString().slice(0, 10),
    t.user.fullName,
    t.user.email,
    t.department?.name ?? "",
    typeFromDb(t.type),
    statusFromDb(t.status),
    t.content,
    t.category ?? "",
    t.chapter ?? "",
    t.campaign ?? "",
    priorityFromDb(t.priority) ?? "",
    t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "",
    t.deliveredDate ? t.deliveredDate.toISOString().slice(0, 10) : "",
    t.revisionRounds ?? "",
    t.reviewStatus,
    t.assignedByName ?? "",
    t.submissionText ?? "",
    t.submittedAt?.toISOString() ?? "",
    t.reviewFeedback ?? "",
    t.reviewedByName ?? "",
    t.reviewedAt?.toISOString() ?? "",
    t.cancelledAt?.toISOString() ?? "",
    t.cancelledByName ?? "",
    t.cancellationReason ?? "",
  ]);

        if (rows.length) controller.enqueue(encoder.encode(rows.map((r) => r.map((c) => csvEscape(String(c))).join(",")).join("\r\n") + "\r\n"));
        if (tasks.length < 500) controller.close();
        else cursor = tasks[tasks.length - 1].id;
      } catch (error) {
        console.error("CSV export failed", error);
        if (!cancelled) controller.error(new Error("Export failed. Please retry."));
      }
    },
    cancel() { cancelled = true; },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="tasks-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
