import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";
import { logAudit } from "@/lib/audit";

type Row = { full_name: string; email: string; password: string; department?: string; role?: string };

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { rows }: { rows: Row[] } = await request.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const departments = await prisma.department.findMany();
  const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d]));

  const results: { row: number; email: string; ok: boolean; error?: string }[] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    if (!row.full_name || !row.email || !row.password) {
      results.push({ row: rowNum, email: row.email ?? "", ok: false, error: "Missing full_name/email/password" });
      continue;
    }
    if (row.password.length < 6) {
      results.push({ row: rowNum, email: row.email, ok: false, error: "Password must be at least 6 characters" });
      continue;
    }

    let departmentId: string | null = null;
    if (row.department) {
      const dep = deptByName.get(row.department.trim().toLowerCase());
      if (!dep) {
        results.push({ row: rowNum, email: row.email, ok: false, error: `Unknown department "${row.department}"` });
        continue;
      }
      departmentId = dep.id;
    }

    let dbRole = (row.role ?? "member").toUpperCase();
    if (!["ADMIN", "LEAD", "MEMBER"].includes(dbRole)) dbRole = "MEMBER";

    if (scope.isLead) {
      // leads can only bulk-import ordinary members into their own department
      dbRole = "MEMBER";
      departmentId = scope.departmentId;
    }

    try {
      const passwordHash = await bcrypt.hash(row.password, 10);
      await prisma.user.create({
        data: { fullName: row.full_name, email: row.email, passwordHash, role: dbRole as any, departmentId },
      });
      results.push({ row: rowNum, email: row.email, ok: true });
      successCount++;
    } catch (err: any) {
      results.push({
        row: rowNum,
        email: row.email,
        ok: false,
        error: err.code === "P2002" ? "Email already exists" : err.message,
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
