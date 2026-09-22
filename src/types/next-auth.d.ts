import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "LEAD" | "MEMBER";
      departmentId: string | null;
    } & DefaultSession["user"];
  }
}
