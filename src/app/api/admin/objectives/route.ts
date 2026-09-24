import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";
import { getObjectiveProgress } from "@/lib/objectives";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const objectives = await prisma.objective.findMany({
    where: scope.isLead ? { departmentId: scope.departmentId } : {},
    include: { department: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const withProgress = await Promise.all(
    objectives.map(async (o) => ({
      ...(await getObjectiveProgress(o.id))!,
      departmentName: o.department.name,
    }))
  );

  return NextResponse.json({ objectives: withProgress });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { departmentId, title, description, targetTaskCount } = await request.json();

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (title.trim().length > 200) {
    return NextResponse.json({ error: "Title must be under 200 characters" }, { status: 400 });
  }
  if (targetTaskCount !== null && targetTaskCount !== undefined && targetTaskCount !== "") {
    const n = Number(targetTaskCount);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "Task target must be a positive number" }, { status: 400 });
    }
  }
  let finalDepartmentId = departmentId;
  if (scope.isLead) finalDepartmentId = scope.departmentId;
  if (!finalDepartmentId) {
    return NextResponse.json({ error: "Department is required" }, { status: 400 });
  }

  try {
    const objective = await prisma.objective.create({
      data: {
        departmentId: finalDepartmentId,
        title: title.trim(),
        description: description || null,
        targetTaskCount: targetTaskCount ? Number(targetTaskCount) : null,
      },
    });
    await logAudit(
      { id: session.user.id, name: session.user.name ?? session.user.email ?? "Admin" },
      "objective.create",
      objective.title
    );
    return NextResponse.json({ objective });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
