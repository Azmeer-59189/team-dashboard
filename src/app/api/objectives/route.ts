import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Lightweight, read-only: any logged-in user can see their own department's
// objectives, so they can optionally tag a task to one when submitting it.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.departmentId) return NextResponse.json({ objectives: [] });

  const objectives = await prisma.objective.findMany({
    where: { departmentId: session.user.departmentId },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ objectives });
}
