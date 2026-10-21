import { serializable } from "@/lib/transaction";
import { audit } from "@/lib/audit";
import { recordAssignment } from "@/lib/assignments";
import { recordGoal } from "@/lib/goalHistory";
import { getPeriodRange } from "@/lib/periods";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await serializable(async (tx) => {
      const affected = await tx.user.findMany({ where: { departmentId: params.id }, select: { id: true } });
      const goals = await tx.goal.findMany({ where: { departmentId: params.id } });
      for (const goal of goals) {
        await recordGoal(tx, goal, undefined, true);
        await tx.goalRevision.deleteMany({ where: { goalId: goal.id, effectiveFrom: { gt: getPeriodRange(goal.period).start } } });
      }
      const department = await tx.department.delete({ where: { id: params.id } });
      const unassigned = await tx.user.findMany({ where: { id: { in: affected.map((u) => u.id) } } });
      for (const user of unassigned) await recordAssignment(tx, user);
      await audit(tx, { id: session.user.id, name: session.user.name ?? "Admin" }, "department.delete", department.id, department.name, { before: department });
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return serverError(err);
  }
}
