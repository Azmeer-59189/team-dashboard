import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManage, getScope } from "@/lib/scope";
import { todayInTimeZone } from "@/lib/dates";
import Sidebar from "@/components/Sidebar";
import PageHeader from "@/components/PageHeader";
import LeavePanel from "@/components/LeavePanel";

export default async function LeavePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <div className="lg:flex">
    <Sidebar role={session.user.role === "ADMIN" ? "admin" : session.user.role === "LEAD" ? "lead" : "member"} name={session.user.name ?? ""} />
    <main className="min-h-screen min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9"><div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Workspace" title="Leave & availability" description="Request full-day leave and plan assignments around approved absences." />
      <LeavePanel manager={canManage(getScope(session))} today={todayInTimeZone().toISOString().slice(0, 10)} />
    </div></main>
  </div>;
}
