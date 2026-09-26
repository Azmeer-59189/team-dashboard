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
  const [collapsed, setCollapsed] = useState(false);
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
    <aside className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-hairline bg-surface/95 shadow-[2px_0_16px_rgba(20,23,31,0.025)] backdrop-blur transition-[width] duration-200 ${collapsed ? "w-16" : "w-56"}`}>
      <div className={`border-b border-hairline ${collapsed ? "p-3" : "p-4"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between gap-2"}`}>
          {!collapsed && <p className="font-display text-sm font-semibold text-ink">Team Dashboard</p>}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded p-1.5 text-muted hover:bg-canvas hover:text-ink"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              {collapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
            </svg>
          </button>
        </div>
        {!collapsed && <>
          <p className="truncate text-xs text-muted">{name}</p>
          {role === "lead" && <span className="badge mt-1 bg-brand-50 text-brand-600">Department Lead</span>}
        </>}
      </div>
      <nav className={`flex-1 space-y-0.5 ${collapsed ? "p-2" : "p-3"}`}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            title={collapsed ? link.label : undefined}
            aria-label={collapsed ? link.label : undefined}
            className={`flex items-center border-l-2 py-2 text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${
              pathname === link.href
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-transparent text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <NavIcon href={link.href} />
            {!collapsed && <span>{link.label}</span>}
          </Link>
        ))}
      </nav>
      <div className={`border-t border-hairline space-y-2 ${collapsed ? "p-2" : "p-3"}`}>
        {DEMO_MODE && role === "admin" && (
          <button onClick={handleResetDemo} disabled={resetting} title={collapsed ? "Reset Demo Data" : undefined} className={`btn-secondary w-full text-xs ${collapsed ? "px-0" : ""}`}>
            {collapsed ? <NavIcon href="reset" /> : resetting ? "Resetting..." : "Reset Demo Data"}
          </button>
        )}
        {resetMsg && <p className="text-center text-xs text-muted">{resetMsg}</p>}
        <button onClick={handleLogout} title={collapsed ? "Log out" : undefined} aria-label={collapsed ? "Log out" : undefined} className={`btn-secondary w-full ${collapsed ? "px-0" : ""}`}>
          {collapsed ? <NavIcon href="logout" /> : "Log out"}
        </button>
      </div>
    </aside>
  );
}

function NavIcon({ href }: { href: string }) {
  const paths: Record<string, React.ReactNode> = {
    "/admin": <><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></>,
    "/member": <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
    "/admin/my-tasks": <><path d="m5 12 4 4L19 6" /><path d="M20 12v7H4V5h11" /></>,
    "/member/tasks": <><path d="m5 12 4 4L19 6" /><path d="M20 12v7H4V5h11" /></>,
    "/admin/tasks": <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    "/admin/objectives": <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
    "/admin/progress": <><path d="M4 19V5M4 19h16" /><path d="m7 15 3-4 3 2 5-6" /></>,
    "/admin/goals": <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="8.5" /></>,
    "/admin/consistency": <><path d="M4 18h16M6 15l4-5 3 2 5-7" /><circle cx="6" cy="15" r="1" /></>,
    "/admin/members": <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 5v1" /></>,
    "/admin/departments": <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
    "/admin/audit": <><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></>,
    "/account": <><circle cx="12" cy="8" r="3.5" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
    reset: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      {paths[href] ?? paths["/admin"]}
    </svg>
  );
}
