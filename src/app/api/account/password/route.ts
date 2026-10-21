import { isPassword } from "@/lib/input";
import { serializable, BusinessError } from "@/lib/transaction";
import { audit } from "@/lib/audit";
import { serverError } from "@/lib/apiError";
import { readJson } from "@/lib/request";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;
  const { currentPassword, newPassword } = body;

  if (typeof currentPassword !== "string" || !currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both current and new password are required" }, { status: 400 });
  }
  if (!isPassword(newPassword)) {
    return NextResponse.json({ error: "Password must be at least 6 characters and at most 72 UTF-8 bytes" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  try {
    await serializable(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current || current.archivedAt || current.passwordHash !== user.passwordHash) throw new BusinessError("Your account changed. Sign in again.", 409);
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await audit(tx, { id: user.id, name: user.fullName }, "member.password_change", user.id, user.fullName);
    });
  } catch (error) { return serverError(error); }

  return NextResponse.json({ ok: true });
}
