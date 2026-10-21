import type { Prisma } from "@prisma/client";
import { BusinessError } from "./transaction";
import { monthLabel } from "./dates";

export async function assertMonthsOpen(tx: Prisma.TransactionClient, dates: (string | Date)[]) {
  const labels = [...new Set(dates.map((d) => typeof d === "string" ? d : monthLabel(d)))];
  const closed = await tx.monthlyReport.findFirst({ where: { periodLabel: { in: labels } }, select: { periodLabel: true } });
  if (closed) throw new BusinessError(`${closed.periodLabel} is finalized and cannot be edited`, 409);
}
