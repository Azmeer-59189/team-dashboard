import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";
import { getScope, canManageUser } from "./scope";
import { canReviewTask } from "./taskWorkflow";
import { isId, isText } from "./input";
import { validateTaskFields, isValidDate } from "./validation";
import { BusinessError } from "./transaction";
import { assertMonthsOpen } from "./reports";
import { audit } from "./audit";
import { priorityToDb } from "./format";
import { assertAssignmentAvailable } from "./leave";

export function validateAssignmentChange(body: Record<string, unknown>) {
  if (typeof body.action !== "string" || !["edit", "reassign", "cancel"].includes(body.action)) return "Invalid assignment action";
  if (!Number.isInteger(body.version) || Number(body.version) < 0) return "Provide the current task version";
  if (!isText(body.reason, 5000)) return "A reason is required (maximum 5000 characters)";
  const allowed = ["action", "version", "reason", ...(body.action === "cancel" ? [] : ["content", "due_date", "task_date", "priority", "objective_id", ...(body.action === "reassign" ? ["user_id"] : [])])];
  if (Object.keys(body).some((key) => !allowed.includes(key))) return "Unsupported assignment field";
  if (body.action === "reassign" && !isId(body.user_id)) return "Choose an assignee";
  if ("objective_id" in body && body.objective_id !== null && body.objective_id !== "" && !isId(body.objective_id)) return "Invalid objective";
  if ("task_date" in body && !isValidDate(body.task_date as string)) return "Invalid task date";
  if ("due_date" in body && !isValidDate(body.due_date as string)) return "A valid due date is required";
  return validateTaskFields({ content: body.content as string | undefined, priority: body.priority as string | undefined });
}

export async function manageAssignment(tx: Prisma.TransactionClient, actorId: string, taskId: string, body: Record<string, any>) {
  const error = validateAssignmentChange(body);
  if (error) throw new BusinessError(error);
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.archivedAt) throw new BusinessError("Unauthorized", 401);
  const scope = getScope({ user: { id: actor.id, role: actor.role, departmentId: actor.departmentId } } as Session);
  const task = await tx.task.findUnique({ where: { id: taskId }, include: { user: { select: { id: true, role: true, departmentId: true } } } });
  if (!task) throw new BusinessError("Task not found", 404);
  if (!task.assignedById || !canReviewTask(scope, task, task.user)) throw new BusinessError("You cannot manage this assignment", 403);
  if (task.version !== body.version) throw new BusinessError("This task changed. Refresh and try again.", 409);
  if (task.cancelledAt) throw new BusinessError("This assignment is already cancelled", 409);
  if (task.reviewStatus === "APPROVED") throw new BusinessError("The owner must reopen approved work before assignment changes", 409);
  if (task.reviewStatus === "SUBMITTED" && body.action !== "cancel") throw new BusinessError("Request changes before editing or reassigning submitted work", 409);
  const date = body.task_date ? new Date(body.task_date) : task.taskDate;
  await assertMonthsOpen(tx, [task.taskDate, date]);
  const resetReview = { reviewedById: null, reviewedByName: null, reviewedAt: null, legacyApproved: false, completedAt: null };
  let data: Prisma.TaskUncheckedUpdateInput;
  if (body.action === "cancel") {
    data = { ...resetReview, cancelledAt: new Date(), cancelledById: actor.id, cancelledByName: actor.fullName,
      cancellationReason: body.reason.trim(), status: "PENDING", reviewStatus: "DRAFT", submittedAt: null };
  } else {
    const target = body.action === "reassign" ? await tx.user.findUnique({ where: { id: body.user_id } }) : task.user;
    if (!target || ("archivedAt" in target && target.archivedAt)) throw new BusinessError("Active assignee not found", 404);
    if (!canManageUser(scope, target)) throw new BusinessError("You cannot assign work to this person", 403);
    if (body.action === "reassign" && target.id === task.userId) throw new BusinessError("Choose a different assignee");
    const dueDate = body.due_date ? new Date(body.due_date) : task.dueDate;
    if (!dueDate || dueDate < date) throw new BusinessError("Set a deadline on or after the task date");
    if (body.action === "reassign" || date.getTime() !== task.taskDate.getTime() || dueDate.getTime() !== task.dueDate?.getTime()) {
      await assertAssignmentAvailable(tx, target.id, date, dueDate);
    }
    const content = body.content === undefined ? task.content : body.content.trim();
    const validation = validateTaskFields({ type: task.type.toLowerCase(), content });
    if (validation) throw new BusinessError(validation);
    const objectiveId = body.objective_id !== undefined ? body.objective_id || null : target.departmentId === task.departmentId ? task.objectiveId : null;
    if (objectiveId && (!target.departmentId || !await tx.objective.findFirst({ where: { id: objectiveId, departmentId: target.departmentId } }))) throw new BusinessError("Objective must belong to the assignee's department");
    data = { content, dueDate, taskDate: date, objectiveId,
      ...(body.priority !== undefined ? { priority: body.priority ? priorityToDb(body.priority) : null } : {}) };
    if (body.action === "reassign") data = { ...data, ...resetReview, userId: target.id, departmentId: target.departmentId,
      status: "PENDING", reviewStatus: "DRAFT", submissionText: null, submittedAt: null, reviewFeedback: null,
      assignedById: actor.id, assignedByName: actor.fullName, assignedAt: new Date(), legacyAssigned: false };
  }
  const saved = await tx.task.update({ where: { id: taskId }, data: { ...data, version: { increment: 1 } } });
  await audit(tx, { id: actor.id, name: actor.fullName }, `task.${body.action === "edit" ? "assignment_edit" : body.action}`, taskId,
    task.content.slice(0, 100), { note: body.reason.trim(), before: { ...task, user: undefined }, after: saved });
  return saved;
}
