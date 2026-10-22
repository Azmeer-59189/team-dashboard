import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readJson } from "@/lib/request";
import { serializable } from "@/lib/transaction";
import { changeLeave } from "@/lib/leave";
import { serverError } from "@/lib/apiError";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const leave = await serializable(tx => changeLeave(tx, session.user.id, params.id, body));
    return NextResponse.json({ id: leave.id, status: leave.status, version: leave.version });
  } catch (error) { return serverError(error); }
}
