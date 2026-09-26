import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Sidebar from "@/components/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role === "MEMBER") redirect("/member");

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        role={session.user.role === "ADMIN" ? "admin" : "lead"}
        name={session.user.name ?? session.user.email ?? ""}
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
