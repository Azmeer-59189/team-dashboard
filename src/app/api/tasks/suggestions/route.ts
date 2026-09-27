import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Distinct values this user (or their department) has used before, for
// autocomplete on Chapter/Category/Campaign - keeps free-text fields
// reasonably consistent without needing a full management page for each.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = session.user.departmentId
    ? { departmentId: session.user.departmentId }
    : { userId: session.user.id };

  const tasks = await prisma.task.findMany({
    where,
    select: { category: true, chapter: true, campaign: true },
    take: 500,
    orderBy: { createdAt: "desc" },
  });

  const distinct = (values: (string | null)[]) => Array.from(new Set(values.filter((v): v is string => !!v)));

  return NextResponse.json({
    categories: distinct(tasks.map((t) => t.category)),
    chapters: distinct(tasks.map((t) => t.chapter)),
    campaigns: distinct(tasks.map((t) => t.campaign)),
  });
}
