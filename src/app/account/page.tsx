import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ChangePasswordForm from "@/components/ChangePasswordForm";

// Available to any logged-in role - not gated under /admin or /member since
// account settings aren't role-specific.
export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">My Account</h1>
        <p className="text-sm text-gray-500">{session.user.name} · {session.user.email}</p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
