import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Icon } from "@/components/icons";
import SignOutButton from "@/components/SignOutButton";

// Where a Department Lead lands when they aren't assigned to any department
// (usually because their department was deleted). Lead access is scoped to a
// department, so there is nothing to show until an admin reassigns them.
export default async function NoDepartmentPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "LEAD" || session.user.departmentId) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md space-y-4 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-tint-sand text-pending">
          <Icon name="layers" size={22} />
        </span>
        <h1 className="font-display text-xl font-bold text-ink">You're not assigned to a department</h1>
        <p className="text-sm leading-6 text-muted">
          As a Department Lead, you can only see and manage your own department. Ask an administrator to assign you
          to one, then sign in again.
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
