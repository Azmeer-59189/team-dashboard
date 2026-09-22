import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Sidebar from "@/components/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role === "MEMBER") redirect("/member");

  return (
    <div className="flex">
      <Sidebar
        role={session.user.role === "ADMIN" ? "admin" : "lead"}
        name={session.user.name ?? session.user.email ?? ""}
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
