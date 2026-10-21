import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();

  if (!session) redirect("/login");
  if (session.user.role === "LEAD" && !session.user.departmentId) redirect("/no-department");
  redirect(session.user.role === "MEMBER" ? "/member" : "/admin");
}
