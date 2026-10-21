import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Sidebar from "@/components/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role === "MEMBER") redirect("/member");
  // a lead whose department was removed has nothing to manage until they're reassigned
  if (session.user.role === "LEAD" && !session.user.departmentId) redirect("/no-department");

  return (
    <div className="lg:flex">
      <Sidebar
        role={session.user.role === "ADMIN" ? "admin" : "lead"}
        name={session.user.name ?? session.user.email ?? ""}
      />
      <main className="min-h-screen min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
