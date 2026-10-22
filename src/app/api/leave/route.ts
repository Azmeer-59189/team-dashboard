import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getScope, canManage, canManageUser } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { serializable } from "@/lib/transaction";
import { serverError } from "@/lib/apiError";
import { isId } from "@/lib/input";
import { leaveScope, requestLeave } from "@/lib/leave";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const scope = getScope(session), team = params.get("view") === "team";
  if (team && !canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const after = params.get("after");
  if (after && !isId(after)) return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  try {
    const rows = await prisma.leaveRequest.findMany({ where: { AND: [team ? leaveScope(scope) : { userId: scope.userId }, ...(after ? [{ id: { lt: after } }] : [])] },
      orderBy: { id: "desc" }, take: 31, include: { user: { select: { id: true, fullName: true, role: true, departmentId: true, archivedAt: true } } } });
    const leaves = await Promise.all(rows.slice(0, 30).map(async row => ({
      id: row.id, user_id: row.userId, name: row.user.fullName, start_date: row.startDate.toISOString().slice(0, 10), end_date: row.endDate.toISOString().slice(0, 10),
      reason: row.reason, status: row.status, version: row.version, review_note: row.reviewNote, reviewed_by: row.reviewedByName,
      can_review: !row.user.archivedAt && canManageUser(scope, row.user), own: row.userId === scope.userId,
      conflicts: ["PENDING", "APPROVED"].includes(row.status) ? await prisma.task.count({ where: {
        userId: row.userId, assignedById: { not: null }, cancelledAt: null, reviewStatus: { not: "APPROVED" }, taskDate: { lte: row.endDate },
        OR: [{ dueDate: { gte: row.startDate } }, { dueDate: null, taskDate: { gte: row.startDate } }],
      } }) : 0,
    })));
    return NextResponse.json({ leaves, next: rows.length > 30 ? rows[29].id : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return serverError(error); }
}
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const leave = await serializable(tx => requestLeave(tx, session.user.id, body));
    return NextResponse.json({ id: leave.id }, { status: 201 });
  } catch (error) { return serverError(error); }
}
