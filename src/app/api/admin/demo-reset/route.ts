import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { seedDemoData } from "@/lib/demoSeed";

// Only usable when NEXT_PUBLIC_DEMO_MODE=true is set on this deployment -
// lets a demo admin reset the sandbox after visitors have poked at it,
// without needing shell/CLI access to the demo database.
export async function POST() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const creds = await seedDemoData();
    return NextResponse.json({ ok: true, creds });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
