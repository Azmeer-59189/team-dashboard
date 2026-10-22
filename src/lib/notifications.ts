import type { Prisma } from "@prisma/client";
import { canReviewTask } from "./taskWorkflow";
import { isId } from "./input";

const titles: Record<string, string> = {
  "task.assign": "New assignment", "task.submit": "Work submitted for review",
  "task.approve": "Work approved", "task.request_changes": "Changes requested",
  "task.assignment_edit": "Assignment updated", "task.reassign": "Assignment reassigned",
  "task.cancel": "Assignment cancelled", "task.reopen": "Approved work reopened",
};

// Only generic event text is stored. Changing departments or reassigning work
// must never expose its later brief, submission, feedback, or audit details.
export async function notifyTaskEvent(tx: Prisma.TransactionClient, actorId: string, action: string, details: unknown) {
  if (!titles[action]) return;
  const task = (details as { after?: { id: string; userId: string; departmentId: string | null; version: number } } | undefined)?.after;
  if (!task?.id || !task.userId || !Number.isInteger(task.version)) return;
  const recipients = new Set<string>();
  if (action === "task.submit" || action === "task.reopen") {
    const owner = await tx.user.findUnique({ where: { id: task.userId } });
    if (!owner || owner.archivedAt) return;
    const managers = await tx.user.findMany({ where: { archivedAt: null, role: { in: ["ADMIN", "LEAD"] } }, select: { id: true, role: true, departmentId: true } });
    for (const manager of managers) {
      if (canReviewTask({ userId: manager.id, isAdmin: manager.role === "ADMIN", isLead: manager.role === "LEAD", departmentId: manager.departmentId }, task, owner)) recipients.add(manager.id);
    }
  } else recipients.add(task.userId);
  if (action === "task.reassign") {
    const former = (details as { before?: { userId?: string } }).before?.userId;
    if (former) recipients.add(former);
  }
  recipients.delete(actorId);
  if (!recipients.size) return;
  const active = await tx.user.findMany({ where: { id: { in: [...recipients] }, archivedAt: null }, select: { id: true } });
  await tx.notification.createMany({ data: active.map(({ id }) => ({ userId: id,
    eventKey: `${task.id}:${task.version}:${action}`, title: titles[action],
    message: action === "task.submit" || action === "task.reopen"
      ? "Your review queue has been updated. Open Assignments & reviews to see work you can manage."
      : "Your task list has been updated. Open My Tasks to see your current assignments and feedback.",
  })), skipDuplicates: true });
}

export function notificationReadIds(body: Record<string, unknown>): string[] | null {
  return Object.keys(body).length === 1 && Array.isArray(body.ids) && body.ids.length > 0
    && body.ids.length <= 50 && body.ids.every(isId) ? [...new Set(body.ids)] as string[] : null;
}

export function markNotificationsRead(tx: Pick<Prisma.TransactionClient, "notification">, userId: string, ids: string[]) {
  return tx.notification.updateMany({ where: { userId, id: { in: ids }, readAt: null }, data: { readAt: new Date() } });
}
