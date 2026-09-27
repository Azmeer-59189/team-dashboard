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
    { href: "/admin/scores", label: "Composite Scores" },
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
    <aside className="flex h-screen w-56 flex-col border-r border-hairline bg-surface">
      <div className="border-b border-hairline p-4">
        <p className="font-display text-sm font-semibold text-ink">Team Dashboard</p>
        <p className="truncate text-xs text-muted">{name}</p>
        {role === "lead" && <span className="badge mt-1 bg-brand-50 text-brand-600">Department Lead</span>}
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
              pathname === link.href
                ? "border-brand-500 bg-brand-50/60 text-brand-600"
                : "border-transparent text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-hairline p-3 space-y-2">
        {DEMO_MODE && role === "admin" && (
          <button onClick={handleResetDemo} disabled={resetting} className="btn-secondary w-full text-xs">
            {resetting ? "Resetting..." : "Reset Demo Data"}
          </button>
        )}
        {resetMsg && <p className="text-center text-xs text-muted">{resetMsg}</p>}
        <button onClick={handleLogout} className="btn-secondary w-full">
          Log out
        </button>
      </div>
    </aside>
  );
}
