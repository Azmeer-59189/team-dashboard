import { prisma } from "@/lib/prisma";

export async function logAudit(actor: { id: string; name: string }, action: string, targetLabel: string) {
  try {
    await prisma.auditLog.create({
      data: { actorId: actor.id, actorName: actor.name, action, targetLabel },
    });
  } catch {
    // never let a logging failure break the actual operation
  }
}
