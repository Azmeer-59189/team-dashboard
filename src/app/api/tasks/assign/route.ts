import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getScope, canManage, canManageUser } from "@/lib/scope";
import { readJson } from "@/lib/request";
import { isId } from "@/lib/input";
import { validateTaskFields, isValidDate } from "@/lib/validation";
import { serializable, BusinessError } from "@/lib/transaction";
import { assertMonthsOpen } from "@/lib/reports";
import { audit } from "@/lib/audit";
import { typeToDb, priorityToDb, formatTask } from "@/lib/format";
import { serverError } from "@/lib/apiError";
import type { Session } from "next-auth";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(getScope(session))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const { user_id, content, type = "text", task_date, due_date, priority = "medium", objective_id } = body;
  const error = validateTaskFields({ type, content, task_date, due_date, priority });
  if (error || !isId(user_id) || !content || !isValidDate(task_date) || !isValidDate(due_date) || due_date < task_date) {
    return NextResponse.json({ error: error ?? "Provide an assignee, instructions, a task date, and a deadline on or after that date" }, { status: 400 });
  }
  if (objective_id != null && objective_id !== "" && !isId(objective_id)) return NextResponse.json({ error: "Invalid objective" }, { status: 400 });
  try {
    const task = await serializable(async (tx) => {
      const actor = await tx.user.findUnique({ where: { id: session.user.id } });
      if (!actor || actor.archivedAt) throw new BusinessError("Unauthorized", 401);
      const scope = getScope({ user: { id: actor.id, role: actor.role, departmentId: actor.departmentId } } as Session);
      const owner = await tx.user.findUnique({ where: { id: user_id } });
      if (!owner || owner.archivedAt) throw new BusinessError("Active assignee not found", 404);
      if (!canManageUser(scope, owner)) throw new BusinessError("You cannot assign work to this person", 403);
      await assertMonthsOpen(tx, [new Date(task_date)]);
      if (objective_id && (!owner.departmentId || !await tx.objective.findFirst({ where: { id: objective_id, departmentId: owner.departmentId } }))) {
        throw new BusinessError("Objective must belong to the assignee's department");
      }
      const saved = await tx.task.create({ data: {
        userId: owner.id, departmentId: owner.departmentId, type: typeToDb(type), content: content.trim(),
        taskDate: new Date(task_date), dueDate: new Date(due_date), priority: priority ? priorityToDb(priority) : null,
        objectiveId: objective_id || null, assignedById: actor.id, assignedByName: actor.fullName, assignedAt: new Date(),
        status: "PENDING", reviewStatus: "DRAFT",
      } });
      await audit(tx, { id: actor.id, name: actor.fullName }, "task.assign", saved.id, saved.content.slice(0, 100), { after: saved });
      return saved;
    });
    return NextResponse.json({ task: formatTask(task) }, { status: 201 });
  } catch (error) { return serverError(error); }
}
