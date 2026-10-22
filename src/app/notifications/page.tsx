import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Sidebar from "@/components/Sidebar";
import PageHeader from "@/components/PageHeader";
import NotificationInbox from "@/components/NotificationInbox";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const role = session.user.role === "ADMIN" ? "admin" : session.user.role === "LEAD" ? "lead" : "member";
  return <div className="lg:flex">
    <Sidebar role={role} name={session.user.name ?? ""} />
    <main className="min-h-screen min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader eyebrow="Workspace" title="Notifications" description="Assignment updates, submissions, and review decisions." />
        <NotificationInbox manager={role !== "member"} />
      </div>
    </main>
  </div>;
}
