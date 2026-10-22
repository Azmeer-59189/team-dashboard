import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getScope, canManageUser } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { isValidDate } from "@/lib/validation";
import { isId } from "@/lib/input";
import { serverError } from "@/lib/apiError";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const userId = params.get("user_id"), from = params.get("from"), to = params.get("to");
  if (!isId(userId) || !isValidDate(from!) || !isValidDate(to!) || from! > to!) return NextResponse.json({ error: "Provide a person and valid date range" }, { status: 400 });
  try {
    const owner = await prisma.user.findUnique({ where: { id: userId } });
    if (!owner || owner.archivedAt || !canManageUser(getScope(session), owner)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const leaves = await prisma.leaveRequest.findMany({ where: { userId, status: "APPROVED", startDate: { lte: new Date(to!) }, endDate: { gte: new Date(from!) } },
      select: { startDate: true, endDate: true }, orderBy: { startDate: "asc" } });
    return NextResponse.json({ available: !leaves.length, periods: leaves.map(row => ({ from: row.startDate.toISOString().slice(0, 10), to: row.endDate.toISOString().slice(0, 10) })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return serverError(error); }
}
