import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readJson } from "@/lib/request";
import { serializable } from "@/lib/transaction";
import { manageAssignment } from "@/lib/assignmentManagement";
import { formatTask } from "@/lib/format";
import { serverError } from "@/lib/apiError";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const task = await serializable((tx) => manageAssignment(tx, session.user.id, params.id, body));
    return NextResponse.json({ task: formatTask(task) });
  } catch (error) { return serverError(error); }
}
