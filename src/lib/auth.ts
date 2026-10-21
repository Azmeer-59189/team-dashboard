import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { passwordVersion } from "@/lib/passwordVersion";
import { allowLogin } from "@/lib/loginThrottle";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (credentials.email.length > 254 || credentials.password.length > 1024) return null;
        if (!(await allowLogin(credentials.email))) return null;

        // emails are matched case-insensitively ("Ali@x.com" and "ali@x.com" are the same person)
        const user = await prisma.user.findFirst({
          where: { email: { equals: credentials.email.trim(), mode: "insensitive" } },
        });
        if (!user || user.archivedAt) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
          pwv: passwordVersion(user.passwordHash),
          av: user.authVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.departmentId = (user as any).departmentId;
        token.pwv = (user as any).pwv;
        token.av = (user as any).av;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).departmentId = token.departmentId;
        (session.user as any).pwv = token.pwv;
        (session.user as any).av = token.av;
      }
      return session;
    },
  },
};
