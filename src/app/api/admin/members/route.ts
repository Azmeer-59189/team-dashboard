import { recordAssignment } from "@/lib/assignments";
import { serializable } from "@/lib/transaction";
import { audit, memberSnapshot } from "@/lib/audit";
import { validateMemberInput } from "@/lib/input";
import { readJson } from "@/lib/request";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";
import { formatMember } from "@/lib/format";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const showArchived = scope.isAdmin && new URL(request.url).searchParams.get("archived") === "true";
  const users = await prisma.user.findMany({
    where: { archivedAt: showArchived ? { not: null } : null, ...(scope.isLead ? { departmentId: scope.departmentId } : {}) },
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

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const validationError = validateMemberInput(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const { full_name, email, password, role, department_id, job_title } = body;

  if (!full_name || !email || !password || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (typeof full_name !== "string" || full_name.trim().length === 0 || full_name.trim().length > 200) {
    return NextResponse.json({ error: "Name must be between 1 and 200 characters" }, { status: 400 });
  }
  if (job_title && (typeof job_title !== "string" || job_title.trim().length > 150)) {
    return NextResponse.json({ error: "Job title must be under 150 characters" }, { status: 400 });
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

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 400 });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await serializable(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: full_name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: dbRole as any,
        departmentId: finalDepartmentId,
        jobTitle: job_title ? job_title.trim() : null,
      },
    });
    await recordAssignment(tx, user);
    await audit(tx, { id: session.user.id, name: session.user.name ?? "Manager" }, "member.create", user.id, `${user.fullName} (${user.email})`, { after: memberSnapshot(user) });
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 400 });
    }
    return serverError(err);
  }
}
