import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { statusToDb, typeToDb, priorityToDb } from "@/lib/format";
import { validateTaskFields } from "@/lib/validation";
import { isId } from "@/lib/input";

import { readJson } from "@/lib/request";
import { serializable, BusinessError } from "@/lib/transaction";
import { assertMonthsOpen } from "@/lib/reports";
import { audit } from "@/lib/audit";
import { taskWhere } from "@/lib/taskQuery";
import { getScope } from "@/lib/scope";
import { formatTask } from "@/lib/format";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    const limit = Number(params.get("limit") ?? 50);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BusinessError("Limit must be 1-100");
    const where = taskWhere(params, getScope(session));
    const after = params.get("after");
    const tasks = await prisma.task.findMany({ where: after ? { AND: [where, { id: { gt: after } }] } : where,
      orderBy: { id: "asc" }, take: limit + 1,
      include: { user: { select: { fullName: true } }, department: { select: { name: true } } },
    });
    const page = tasks.slice(0, limit);
    return NextResponse.json({ tasks: page.map(formatTask), nextCursor: tasks.length > limit ? page[page.length - 1].id : null });
  } catch (error) { return serverError(error); }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const {
    type,
    content,
    task_date,
    status,
    objective_id,
    category,
    chapter,
    campaign,
    priority,
    due_date,
    delivered_date,
    revision_rounds,
  } = body;

  if (!type || !content || !task_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (objective_id != null && objective_id !== "" && !isId(objective_id)) return NextResponse.json({ error: "Invalid objective" }, { status: 400 });

  const validationError = validateTaskFields({
    type,
    content,
    task_date,
    status: status ?? "pending",
    category,
    chapter,
    campaign,
    priority,
    due_date,
    delivered_date,
    revision_rounds,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const task = await serializable(async (tx) => {
    await assertMonthsOpen(tx, [new Date(task_date)]);
    if (objective_id) {
      if (typeof objective_id !== "string" || !session.user.departmentId) {
        throw new BusinessError("Invalid objective");
      }
      const objective = await tx.objective.findFirst({
        where: { id: objective_id, departmentId: session.user.departmentId },
        select: { id: true },
      });
      if (!objective) {
        throw new BusinessError("Objective must belong to your department");
      }
    }
    const task = await tx.task.create({
      data: {
        userId: session.user.id,
        departmentId: session.user.departmentId,
        objectiveId: objective_id || null,
        type: typeToDb(type),
        content: content.trim(),
        taskDate: new Date(task_date),
        status: statusToDb(status ?? "pending"),
        completedAt: status === "done" ? new Date() : null,
        category: category || null,
        chapter: chapter || null,
        campaign: campaign || null,
        priority: priority ? priorityToDb(priority) : null,
        dueDate: due_date ? new Date(due_date) : null,
        deliveredDate: delivered_date ? new Date(delivered_date) : null,
        revisionRounds: revision_rounds !== undefined && revision_rounds !== null && revision_rounds !== "" ? Number(revision_rounds) : null,
      },
    });
    await audit(tx, { id: session.user.id, name: session.user.name ?? "Member" }, "task.create", task.id, task.content.slice(0, 100), { after: task });
    return task;
    });
    return NextResponse.json({ task });
  } catch (err: any) {
    return serverError(err);
  }
}
