import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";
import { formatMember } from "@/lib/format";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    where: scope.isLead ? { departmentId: scope.departmentId } : {},
    include: { department: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json({ members: users.map(formatMember) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { full_name, email, password, role, department_id } = await request.json();

  if (!full_name || !email || !password || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (typeof full_name !== "string" || full_name.trim().length === 0 || full_name.trim().length > 200) {
    return NextResponse.json({ error: "Name must be between 1 and 200 characters" }, { status: 400 });
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof email !== "string" || !emailPattern.test(email.trim())) {
    return NextResponse.json({ error: "Please provide a valid email address" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  let dbRole = String(role).toUpperCase();
  if (!["ADMIN", "LEAD", "MEMBER"].includes(dbRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Leads can only create ordinary members inside their own department
  let finalDepartmentId: string | null = department_id || null;
  if (scope.isLead) {
    if (dbRole !== "MEMBER") {
      return NextResponse.json({ error: "Leads can only create member accounts" }, { status: 403 });
    }
    finalDepartmentId = scope.departmentId;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        fullName: full_name.trim(),
        email: email.trim(),
        passwordHash,
        role: dbRole as any,
        departmentId: finalDepartmentId,
      },
    });
    await logAudit(
      { id: session.user.id, name: session.user.name ?? session.user.email ?? "Admin" },
      "member.create",
      `${user.fullName} (${user.email})`
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
