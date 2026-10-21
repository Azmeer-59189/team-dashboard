import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      av?: number;
      role: "ADMIN" | "LEAD" | "MEMBER";
      departmentId: string | null;
      // fingerprint of the password hash at sign-in; see lib/passwordVersion.ts
      pwv?: string;
    } & DefaultSession["user"];
  }
}
