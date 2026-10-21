import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export function memberSnapshot(user: { id: string; fullName: string; email: string; role: string; departmentId: string | null; jobTitle: string | null; archivedAt: Date | null }) {
  const { id, fullName, email, role, departmentId, jobTitle, archivedAt } = user;
  return { id, fullName, email, role, departmentId, jobTitle, archivedAt };
}

export async function audit(tx: Prisma.TransactionClient, actor: { id: string; name: string }, action: string,
  targetId: string, targetLabel: string, details?: unknown) {
  // JSON round-trip converts dates and strips undefined; callers must exclude passwords.
  return tx.auditLog.create({ data: { actorId: actor.id, actorName: actor.name, action, targetId, targetLabel,
    ...(details === undefined ? {} : { details: JSON.parse(JSON.stringify(details)) }) } });
}

export async function logAudit(actor: { id: string; name: string }, action: string, targetLabel: string) {
  try {
    await prisma.auditLog.create({
      data: { actorId: actor.id, actorName: actor.name, action, targetLabel },
    });
  } catch (error) {
    console.error("Audit write failed", error);
  }
}
