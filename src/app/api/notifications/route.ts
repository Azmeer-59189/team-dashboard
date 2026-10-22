import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { serverError } from "@/lib/apiError";
import { isId } from "@/lib/input";
import { markNotificationsRead, notificationReadIds } from "@/lib/notifications";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const params = new URL(request.url).searchParams;
  try {
    if (params.get("count") === "true") return NextResponse.json({ unread: await prisma.notification.count({ where: { userId, readAt: null } }) }, { headers });
    const cursor = params.get("before");
    if (cursor !== null && !isId(cursor)) return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    const boundary = cursor ? await prisma.notification.findFirst({ where: { id: cursor, userId }, select: { id: true, createdAt: true } }) : null;
    if (cursor && !boundary) return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    const [rows, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId, ...(boundary ? { OR: [
        { createdAt: { lt: boundary.createdAt } }, { createdAt: boundary.createdAt, id: { lt: boundary.id } },
      ] } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 31,
      select: { id: true, title: true, message: true, createdAt: true, readAt: true } }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return NextResponse.json({ notifications: rows.slice(0, 30), unread, next: rows.length > 30 ? rows[29].id : null }, { headers });
  } catch (error) { return serverError(error); }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const ids = notificationReadIds(body);
  if (!ids) return NextResponse.json({ error: "Provide 1–50 notification IDs" }, { status: 400 });
  try {
    const result = await markNotificationsRead(prisma, session.user.id, ids);
    return NextResponse.json({ updated: result.count }, { headers });
  } catch (error) { return serverError(error); }
}
