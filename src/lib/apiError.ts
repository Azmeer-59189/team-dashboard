import { NextResponse } from "next/server";
import { BusinessError } from "./transaction";

// Turn an unexpected exception into a response without leaking database internals
// (table names, constraint names, query fragments) to the browser. The real error
// goes to the server log; the client gets a short, safe message.
export function serverError(err: unknown, message = "Something went wrong. Please try again.") {
  if (err instanceof BusinessError) return NextResponse.json({ error: err.message }, { status: err.status });
  const code = (err as { code?: string } | null)?.code;
  if (code === "P2002") return NextResponse.json({ error: "This record already exists" }, { status: 409 });
  if (code === "P2034") return NextResponse.json({ error: "A concurrent change occurred. Please retry." }, { status: 409 });
  // Prisma: record to update/delete no longer exists
  if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Prisma: foreign key points at a record that doesn't exist
  if (code === "P2003") return NextResponse.json({ error: "A related record no longer exists" }, { status: 400 });
  console.error(err);
  return NextResponse.json({ error: message }, { status: 500 });
}
