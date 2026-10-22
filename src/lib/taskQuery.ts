import type { Prisma } from "@prisma/client";
import type { Scope } from "./scope";
import { BusinessError } from "./transaction";
import { isValidDate } from "./validation";
import { statusToDb } from "./format";

export function taskWhere(params: URLSearchParams, scope: Scope): Prisma.TaskWhereInput {
  const status = params.get("status");
  const from = params.get("from");
  const to = params.get("to");
  const search = params.get("q")?.trim();
  const review = params.get("review");
  if (review && !["DRAFT", "SUBMITTED", "CHANGES_REQUESTED", "APPROVED"].includes(review)) throw new BusinessError("Invalid review status");
  if (status && !["pending", "in-progress", "done"].includes(status)) throw new BusinessError("Invalid task status");
  if ((from && !isValidDate(from)) || (to && !isValidDate(to)) || (from && to && from > to)) throw new BusinessError("Invalid date range");
  if (search && search.length > 200) throw new BusinessError("Search must be under 200 characters");
  if (scope.isLead && !scope.departmentId) throw new BusinessError("Department required", 403);
  const where: Prisma.TaskWhereInput = params.get("cancelled") === "true" ? { cancelledAt: { not: null } } : { cancelledAt: null };
  if (!scope.isAdmin && !scope.isLead) where.userId = scope.userId;
  else {
    if (scope.isLead) where.departmentId = scope.departmentId;
    else if (params.get("department")) where.departmentId = params.get("department");
    if (params.get("member")) where.userId = params.get("member")!;
  }
  if (status) where.status = statusToDb(status);
  if (review) where.reviewStatus = review as "DRAFT" | "SUBMITTED" | "CHANGES_REQUESTED" | "APPROVED";
  if (from || to) where.taskDate = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  if (search) where.content = { contains: search, mode: "insensitive" };
  return where;
}
