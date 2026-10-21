import { serializable } from "@/lib/transaction";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/request";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const { name } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Department name is required" }, { status: 400 });
  }
  if (name.trim().length > 100) {
    return NextResponse.json({ error: "Department name must be under 100 characters" }, { status: 400 });
  }

  try {
    const department = await serializable(async (tx) => {
      const saved = await tx.department.create({ data: { name: name.trim() } });
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Admin" }, "department.create", saved.id, saved.name, { after: saved });
      return saved;
    });
    return NextResponse.json({ department });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A department with that name already exists" }, { status: 400 });
    }
    return serverError(err);
  }
}
