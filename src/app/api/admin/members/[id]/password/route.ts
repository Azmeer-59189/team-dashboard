import { isPassword } from "@/lib/input";
import { serializable, BusinessError } from "@/lib/transaction";
import { audit } from "@/lib/audit";
import { serverError } from "@/lib/apiError";
import { readJson } from "@/lib/request";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getScope, canManage, canManageUser } from "@/lib/scope";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(session);
  if (!canManage(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const { newPassword } = body;
  if (!isPassword(newPassword)) {
    return NextResponse.json({ error: "Password must be at least 6 characters and at most 72 UTF-8 bytes" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // your own password is changed from the Account page, which asks for the current one
  if (target.id === scope.userId) {
    return NextResponse.json({ error: "Change your own password from the Account page" }, { status: 400 });
  }
  // a lead may only reset passwords for ordinary members in their own department
  if (!canManageUser(scope, target)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  try {
    await serializable(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: params.id } });
      if (!current || current.archivedAt || !canManageUser(scope, current)) throw new BusinessError("Forbidden", 403);
      await tx.user.update({ where: { id: params.id }, data: { passwordHash } });
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Manager" }, "member.password_reset", current.id, `${current.fullName} (${current.email})`);
    });
  } catch (error) { return serverError(error); }

  return NextResponse.json({ ok: true });
}
