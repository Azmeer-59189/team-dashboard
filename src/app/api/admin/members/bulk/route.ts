import { recordAssignment } from "@/lib/assignments";
import { validateMemberInput } from "@/lib/input";
import { serializable } from "@/lib/transaction";
import { audit, memberSnapshot } from "@/lib/audit";
import { readJson } from "@/lib/request";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";
import { logAudit } from "@/lib/audit";


export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const { rows } = body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  if (rows.length > 100) return NextResponse.json({ error: "Import at most 100 members at a time" }, { status: 400 });
  const departments = await prisma.department.findMany();
  const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d]));

  const results: { row: number; email: string; ok: boolean; error?: string }[] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    const validationError = row && typeof row === "object" && !Array.isArray(row)
      ? validateMemberInput(scope.isLead ? { ...row, role: "member", department: undefined } : row)
      : "Each row must be an object";
    if (validationError) {
      results.push({ row: rowNum, email: typeof row?.email === "string" ? row.email : "", ok: false, error: validationError });
      continue;
    }
    const email = row.email.trim().toLowerCase();
    let departmentId: string | null = null;
    if (row.department && !scope.isLead) {
      const dep = deptByName.get(row.department.trim().toLowerCase());
      if (!dep) {
        results.push({ row: rowNum, email: row.email, ok: false, error: `Unknown department "${row.department}"` });
        continue;
      }
      departmentId = dep.id;
    }

    let dbRole = scope.isLead ? "MEMBER" : (row.role ?? "member").toUpperCase();
    if (!["ADMIN", "LEAD", "MEMBER"].includes(dbRole)) dbRole = "MEMBER";

    if (scope.isLead) {
      // leads can only bulk-import ordinary members into their own department
      dbRole = "MEMBER";
      departmentId = scope.departmentId;
    }

    const duplicate = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) {
      results.push({ row: rowNum, email, ok: false, error: "Email already exists" });
      continue;
    }

    try {
      const passwordHash = await bcrypt.hash(row.password, 10);
      await serializable(async (tx) => {
      const member = await tx.user.create({
        data: {
          fullName: String(row.full_name).trim(),
          email,
          passwordHash,
          role: dbRole as any,
          departmentId,
          jobTitle: row.job_title ? row.job_title.trim() : null,
        },
      });
      await recordAssignment(tx, member);
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Manager" }, "member.create", member.id, `${member.fullName} (${member.email})`, { after: memberSnapshot(member), source: "bulk_import" });
      });
      results.push({ row: rowNum, email: row.email, ok: true });
      successCount++;
    } catch (err: any) {
      results.push({
        row: rowNum,
        email: row.email,
        ok: false,
        error: err.code === "P2002" ? "Email already exists" : "Could not create this member",
      });
    }
  }

  if (successCount > 0) {
    await logAudit(
      { id: session.user.id, name: session.user.name ?? session.user.email ?? "Admin" },
      "member.bulk_import",
      `${successCount} member(s) imported`
    );
  }

  return NextResponse.json({ results });
}
