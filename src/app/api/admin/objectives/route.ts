import { serializable } from "@/lib/transaction";
import { audit } from "@/lib/audit";
import { validateObjectiveInput } from "@/lib/input";
import { readJson } from "@/lib/request";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage } from "@/lib/scope";
import { getObjectivesProgress } from "@/lib/objectives";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const objectives = await prisma.objective.findMany({
    where: scope.isLead ? { departmentId: scope.departmentId! } : {},
    include: { department: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const progress = await getObjectivesProgress({ id: { in: objectives.map((o) => o.id) } });
  const byId = new Map(progress.map((p) => [p.id, p]));
  const withProgress = objectives.map((o) => ({ ...byId.get(o.id)!, departmentName: o.department.name }));

  return NextResponse.json({ objectives: withProgress });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const validationError = validateObjectiveInput(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const { departmentId, title, description, targetTaskCount } = body;

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
    const objective = await serializable(async (tx) => {
    const objective = await tx.objective.create({
      data: {
        departmentId: finalDepartmentId,
        title: title.trim(),
        description: description || null,
        targetTaskCount: targetTaskCount ? Number(targetTaskCount) : null,
      },
    });
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Manager" }, "objective.create", objective.id, objective.title, { after: objective });
      return objective;
    });
    return NextResponse.json({ objective });
  } catch (err: any) {
    return serverError(err);
  }
}
