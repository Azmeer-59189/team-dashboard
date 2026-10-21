import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { passwordVersion } from "@/lib/passwordVersion";

// Use in Server Components and Route Handlers to get the current logged-in user.
// Returns null if not logged in.
export async function getSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  // Authorization must reflect account changes, rather than the login-time JWT.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { fullName: true, email: true, role: true, departmentId: true, passwordHash: true, archivedAt: true, authVersion: true },
  });
  if (!user || user.archivedAt) return null;
  if ((session.user.av ?? 0) !== user.authVersion) return null;
  // the password changed since this login (or the token predates this check): sign in again
  if (session.user.pwv !== passwordVersion(user.passwordHash)) return null;
  session.user = { ...session.user, name: user.fullName, email: user.email,
    role: user.role, departmentId: user.departmentId, pwv: undefined };
  return session;
}
