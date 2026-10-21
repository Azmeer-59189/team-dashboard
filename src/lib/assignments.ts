import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { todayInTimeZone } from "./dates";

export async function recordAssignment(tx: Prisma.TransactionClient,
  user: { id: string; departmentId: string | null; role: "ADMIN" | "LEAD" | "MEMBER"; archivedAt: Date | null }, effectiveFrom = todayInTimeZone()) {
  const data = { userId: user.id, departmentId: user.departmentId, role: user.role, archived: user.archivedAt !== null, effectiveFrom };
  return tx.userAssignment.upsert({ where: { userId_effectiveFrom: { userId: user.id, effectiveFrom } }, create: data, update: data });
}

export async function assignmentsAt<T extends { id: string; departmentId: string | null }>(members: T[], reference: Date, db: Prisma.TransactionClient = prisma) {
  const history = await db.userAssignment.findMany({ where: { userId: { in: members.map((m) => m.id) }, effectiveFrom: { lte: reference } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] });
  return members.map((member) => {
    const atDate = history.find((h) => h.userId === member.id);
    return { ...member, departmentId: atDate ? atDate.departmentId : member.departmentId,
      role: atDate?.role, archived: atDate?.archived ?? false };
  });
}
