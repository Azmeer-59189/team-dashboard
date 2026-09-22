import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const departments = await prisma.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ departments });
}

export async function POST(request: Request) {
  const session = await getSession();
  // only full admins manage the department list itself
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Department name is required" }, { status: 400 });
  }

  try {
    const department = await prisma.department.create({ data: { name: name.trim() } });
    await logAudit(
      { id: session.user.id, name: session.user.name ?? session.user.email ?? "Admin" },
      "department.create",
      department.name
    );
    return NextResponse.json({ department });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A department with that name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
