import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { statusToDb, typeToDb } from "@/lib/format";
import { validateTaskFields } from "@/lib/validation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, content, task_date, status, objective_id } = await request.json();

  if (!type || !content || !task_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const validationError = validateTaskFields({ type, content, task_date, status: status ?? "pending" });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const task = await prisma.task.create({
      data: {
        userId: session.user.id,
        departmentId: session.user.departmentId,
        objectiveId: objective_id || null,
        type: typeToDb(type),
        content: content.trim(),
        taskDate: new Date(task_date),
        status: statusToDb(status ?? "pending"),
      },
    });
    return NextResponse.json({ task });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
