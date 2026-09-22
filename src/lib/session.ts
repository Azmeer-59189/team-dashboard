import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Use in Server Components and Route Handlers to get the current logged-in user.
// Returns null if not logged in.
export async function getSession() {
  return getServerSession(authOptions);
}
