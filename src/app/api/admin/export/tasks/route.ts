import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";
import { statusToDb, typeFromDb, statusFromDb } from "@/lib/format";

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department");
  const member = searchParams.get("member");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: any = {};
  // leads are always locked to their own department, regardless of what's in the URL
  if (scope.isLead) where.departmentId = scope.departmentId;
  else if (department) where.departmentId = department;

  if (member) where.userId = member;
  if (status) where.status = statusToDb(status);
  if (from || to) {
    where.taskDate = {};
    if (from) where.taskDate.gte = new Date(from);
    if (to) where.taskDate.lte = new Date(to);
  }

  const tasks = await prisma.task.findMany({
    where,
    include: { user: { select: { fullName: true, email: true } }, department: { select: { name: true } } },
    orderBy: { taskDate: "desc" },
    take: 5000,
  });

  const header = ["Date", "Member", "Email", "Department", "Type", "Status", "Content"];
  const rows = tasks.map((t) => [
    t.taskDate.toISOString().slice(0, 10),
    t.user.fullName,
    t.user.email,
    t.department?.name ?? "",
    typeFromDb(t.type),
    statusFromDb(t.status),
    t.content,
  ]);

  const csv = [header, ...rows].map((r) => r.map((c) => csvEscape(String(c))).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tasks-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
