import type { Prisma } from "@prisma/client";
import { getScope } from "./scope";
import { taskTransition, type TaskAction } from "./taskWorkflow";
import { BusinessError } from "./transaction";
import { assertMonthsOpen } from "./reports";
import { audit } from "./audit";
import type { Session } from "next-auth";

export async function applyTaskAction(tx: Prisma.TransactionClient, actorId: string, taskId: string, action: TaskAction, version: number, note: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.archivedAt) throw new BusinessError("Unauthorized", 401);
  const task = await tx.task.findUnique({ where: { id: taskId }, include: { user: { select: { id: true, role: true, departmentId: true } } } });
  if (!task) throw new BusinessError("Task not found", 404);
  if (task.cancelledAt) throw new BusinessError("Cancelled assignments cannot be changed", 409);
  const scope = getScope({ user: { id: actor.id, role: actor.role, departmentId: actor.departmentId } } as Session);
  const patch = taskTransition(task, scope, task.user, action, note);
  if (task.version !== version) throw new BusinessError("This task changed. Refresh and try again.", 409);
  await assertMonthsOpen(tx, [task.taskDate]);
  const saved = await tx.task.update({ where: { id: taskId }, data: {
    ...patch, ...(action === "approve" || action === "request_changes" ? { reviewedByName: actor.fullName } : {}), version: { increment: 1 },
  } });
  await audit(tx, { id: actor.id, name: actor.fullName }, `task.${action}`, taskId, task.content.slice(0, 100),
    { note: note.trim(), before: { ...task, user: undefined }, after: saved });
  return saved;
}
