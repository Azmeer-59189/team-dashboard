import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readJson } from "@/lib/request";
import { validateAction } from "@/lib/taskWorkflow";
import { applyTaskAction } from "@/lib/taskWorkflowService";
import { serializable } from "@/lib/transaction";
import { serverError } from "@/lib/apiError";
import { formatTask } from "@/lib/format";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const error = validateAction(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    const task = await serializable((tx) => applyTaskAction(tx, session.user.id, params.id, body.action, body.version, body.note ?? ""));
    return NextResponse.json({ task: formatTask(task) });
  } catch (error) { return serverError(error); }
}
