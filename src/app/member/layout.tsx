import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Sidebar from "@/components/Sidebar";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex">
      <Sidebar
        role={session.user.role === "ADMIN" ? "admin" : "member"}
        name={session.user.name ?? session.user.email ?? ""}
      />
      <main className="min-h-screen flex-1 overflow-y-auto bg-canvas p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
