import PageHeader from "@/components/PageHeader";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import Sidebar from "@/components/Sidebar";

// Available to any logged-in role - not gated under /admin or /member since
// account settings aren't role-specific.
export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="lg:flex">
      <Sidebar
        role={session.user.role === "ADMIN" ? "admin" : session.user.role === "LEAD" ? "lead" : "member"}
        name={session.user.name ?? session.user.email ?? ""}
      />
      <main className="min-h-screen min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-7xl"><div className="max-w-2xl space-y-6">
          <PageHeader eyebrow="Settings" title="My Account" description="Manage your sign-in details." />
          <div className="card flex items-center gap-4">
            <span aria-hidden="true" className="avatar h-14 w-14 text-xl">
              {(session.user.name ?? "U").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-ink">{session.user.name}</p>
              <p className="truncate text-sm text-muted">{session.user.email}</p>
            </div>
          </div>
          <ChangePasswordForm />
        </div></div>
      </main>
    </div>
  );
}
