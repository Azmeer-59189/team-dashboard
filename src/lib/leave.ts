import type { Prisma } from "@prisma/client";
import { canManageUser, type Scope } from "./scope";
import { isValidDate } from "./validation";
import { isText, isOptionalText } from "./input";
import { BusinessError } from "./transaction";
import { todayInTimeZone } from "./dates";
import { audit } from "./audit";

export function leaveScope(scope: Scope): Prisma.LeaveRequestWhereInput {
  if (scope.isAdmin) return {};
  return { OR: [{ userId: scope.userId }, ...(scope.isLead && scope.departmentId ? [
    { user: { role: "MEMBER" as const, departmentId: scope.departmentId, archivedAt: null } },
  ] : [])] };
}
export function validateLeave(body: Record<string, unknown>, today = todayInTimeZone().toISOString().slice(0, 10)) {
  if (Object.keys(body).some(key => !["start_date", "end_date", "reason"].includes(key))) return "Unsupported leave field";
  if (!isValidDate(body.start_date as string) || !isValidDate(body.end_date as string)) return "Provide valid start and end dates";
  const start = body.start_date as string, end = body.end_date as string;
  if (start < today) return "New leave must start today or later";
  if (end < start || (new Date(end).getTime() - new Date(start).getTime()) / 86400000 >= 366) return "Leave must be 1–366 calendar days";
  if (!isText(body.reason, 2000)) return "A reason is required (maximum 2000 characters)";
  return null;
}
export async function assertAssignmentAvailable(tx: Prisma.TransactionClient, userId: string, start: Date, end: Date) {
  const leave = await tx.leaveRequest.findFirst({ where: { userId, status: "APPROVED", startDate: { lte: end }, endDate: { gte: start } }, select: { id: true } });
  if (leave) throw new BusinessError("The assignee has approved leave during these dates. Choose different dates or another person.", 409);
}
const userScope = (user: { id: string; role: string; departmentId: string | null }): Scope => ({ userId: user.id, isAdmin: user.role === "ADMIN", isLead: user.role === "LEAD", departmentId: user.departmentId });
async function notifyLeave(tx: Prisma.TransactionClient, actorId: string, leave: { id: string; userId: string; version: number }, title: string, managers: boolean) {
  const owner = await tx.user.findUnique({ where: { id: leave.userId } });
  if (!owner || owner.archivedAt) return;
  const users = managers ? await tx.user.findMany({ where: { archivedAt: null, role: { in: ["ADMIN", "LEAD"] } }, select: { id: true, role: true, departmentId: true } }) : [owner];
  const recipients = users.filter(user => user.id !== actorId && (!managers || canManageUser(userScope(user), owner)));
  if (recipients.length) await tx.notification.createMany({ data: recipients.map(user => ({ userId: user.id,
    eventKey: `leave:${leave.id}:${leave.version}`, title, message: "Open Leave & availability to see requests you can access." })), skipDuplicates: true });
}
export async function requestLeave(tx: Prisma.TransactionClient, actorId: string, body: Record<string, unknown>) {
  const error = validateLeave(body);
  if (error) throw new BusinessError(error);
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.archivedAt) throw new BusinessError("Unauthorized", 401);
  const startDate = new Date(body.start_date as string), endDate = new Date(body.end_date as string);
  const overlap = await tx.leaveRequest.findFirst({ where: { userId: actor.id, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: endDate }, endDate: { gte: startDate } } });
  if (overlap) throw new BusinessError("You already have pending or approved leave overlapping these dates", 409);
  const saved = await tx.leaveRequest.create({ data: { userId: actor.id, startDate, endDate, reason: (body.reason as string).trim() } });
  // Personal leave reasons belong only in scoped leave records, not the general audit log.
  await audit(tx, { id: actor.id, name: actor.fullName }, "leave.request", saved.id, "Leave requested", { startDate, endDate });
  await notifyLeave(tx, actor.id, saved, "Leave awaiting review", true);
  return saved;
}
export async function changeLeave(tx: Prisma.TransactionClient, actorId: string, id: string, body: Record<string, unknown>) {
  if (Object.keys(body).some(key => !["action", "version", "note"].includes(key)) || !["approve", "reject", "cancel"].includes(String(body.action))
    || typeof body.action !== "string" || !Number.isInteger(body.version) || Number(body.version) < 0 || !isOptionalText(body.note, 2000)) throw new BusinessError("Invalid leave action, version or note");
  if (body.action === "reject" && !isText(body.note, 2000)) throw new BusinessError("Explain why the request was rejected");
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.archivedAt) throw new BusinessError("Unauthorized", 401);
  const leave = await tx.leaveRequest.findUnique({ where: { id }, include: { user: true } });
  if (!leave) throw new BusinessError("Leave request not found", 404);
  const own = leave.userId === actor.id;
  if (body.action === "cancel" ? !own : !canManageUser(userScope(actor), leave.user) || !!leave.user.archivedAt) throw new BusinessError("You cannot perform this leave action", 403);
  if (leave.version !== body.version) throw new BusinessError("This request changed. Refresh and try again.", 409);
  if (body.action === "cancel" ? !["PENDING", "APPROVED"].includes(leave.status) : leave.status !== "PENDING") throw new BusinessError("This leave request can no longer be changed", 409);
  if (leave.endDate < todayInTimeZone()) throw new BusinessError("Past leave cannot be changed", 409);
  if (body.action === "approve") {
    const overlapping = await tx.leaveRequest.findFirst({ where: { id: { not: id }, userId: leave.userId, status: "APPROVED", startDate: { lte: leave.endDate }, endDate: { gte: leave.startDate } } });
    if (overlapping) throw new BusinessError("Approved leave already overlaps these dates", 409);
  }
  const saved = await tx.leaveRequest.update({ where: { id }, data: {
    status: body.action === "approve" ? "APPROVED" : body.action === "reject" ? "REJECTED" : "CANCELLED", version: { increment: 1 },
    ...(body.action === "cancel" ? { cancelledAt: new Date() } : { reviewedById: actor.id, reviewedByName: actor.fullName, reviewedAt: new Date(), reviewNote: typeof body.note === "string" ? body.note.trim() || null : null }),
  } });
  await audit(tx, { id: actor.id, name: actor.fullName }, `leave.${body.action}`, id, "Leave status changed", { before: leave.status, after: saved.status });
  await notifyLeave(tx, actor.id, saved, body.action === "cancel" ? "Leave cancelled" : body.action === "approve" ? "Leave approved" : "Leave rejected", body.action === "cancel");
  return saved;
}
