"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function Sidebar({
  role,
  name,
}: {
  role: "admin" | "lead" | "member";
  name: string;
}) {
  const pathname = usePathname();
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const sharedAdminLinks = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/my-tasks", label: "My Tasks" },
    { href: "/admin/tasks", label: "All Tasks" },
    { href: "/admin/objectives", label: "Objectives" },
    { href: "/admin/progress", label: "KPI Progress" },
    { href: "/admin/goals", label: "KPI Goals" },
    { href: "/admin/consistency", label: "Consistency" },
    { href: "/admin/members", label: "Members" },
  ];
  const adminOnlyLinks = [
    { href: "/admin/departments", label: "Departments" },
    { href: "/admin/audit", label: "Audit Log" },
  ];
  const accountLink = { href: "/account", label: "Account" };
  const memberLinks = [
    { href: "/member", label: "My Dashboard" },
    { href: "/member/tasks", label: "My Tasks" },
  ];

  const links =
    role === "member"
      ? [...memberLinks, accountLink]
      : role === "admin"
      ? [...sharedAdminLinks, ...adminOnlyLinks, accountLink]
      : [...sharedAdminLinks, accountLink];

  async function handleLogout() {
    await signOut({ callbackUrl: "/login" });
  }

  async function handleResetDemo() {
    if (!confirm("Reset all demo data back to sample state? This wipes anything visitors have added.")) return;
    setResetting(true);
    setResetMsg(null);
    const res = await fetch("/api/admin/demo-reset", { method: "POST" });
    setResetting(false);
    setResetMsg(res.ok ? "Demo data reset." : "Reset failed.");
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-4">
        <p className="text-sm font-semibold">Team Dashboard</p>
        <p className="truncate text-xs text-gray-500">{name}</p>
        {role === "lead" && <span className="badge mt-1 bg-brand-50 text-brand-700">Department Lead</span>}
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block rounded-lg px-3 py-2 text-sm font-medium ${
              pathname === link.href
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-gray-200 p-3 space-y-2">
        {DEMO_MODE && role === "admin" && (
          <button onClick={handleResetDemo} disabled={resetting} className="btn-secondary w-full text-xs">
            {resetting ? "Resetting..." : "Reset Demo Data"}
          </button>
        )}
        {resetMsg && <p className="text-center text-xs text-gray-500">{resetMsg}</p>}
        <button onClick={handleLogout} className="btn-secondary w-full">
          Log out
        </button>
      </div>
    </aside>
  );
}
