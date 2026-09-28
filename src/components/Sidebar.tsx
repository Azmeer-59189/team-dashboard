"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Icon, type IconName } from "./icons";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const STORAGE_KEY = "sidebar-collapsed";

type NavLink = { href: string; label: string; icon: IconName };

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

  // Restore the saved preference; with none saved, start collapsed on small screens.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setCollapsed(saved === "1");
      else if (window.innerWidth < 768) setCollapsed(true);
    } catch {
      // storage unavailable (private mode etc.) - just stay expanded
    }
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  const sharedAdminLinks: NavLink[] = [
    { href: "/admin", label: "Overview", icon: "grid" },
    { href: "/admin/my-tasks", label: "My Tasks", icon: "check-square" },
    { href: "/admin/tasks", label: "All Tasks", icon: "list" },
    { href: "/admin/objectives", label: "Objectives", icon: "target" },
    { href: "/admin/progress", label: "KPI Progress", icon: "bar-chart" },
    { href: "/admin/scores", label: "Composite Scores", icon: "award" },
    { href: "/admin/goals", label: "KPI Goals", icon: "flag" },
    { href: "/admin/consistency", label: "Consistency", icon: "calendar" },
    { href: "/admin/members", label: "Members", icon: "users" },
  ];
  const adminOnlyLinks: NavLink[] = [
    { href: "/admin/departments", label: "Departments", icon: "layers" },
    { href: "/admin/audit", label: "Audit Log", icon: "clipboard" },
  ];
  const accountLink: NavLink = { href: "/account", label: "Account", icon: "user" };
  const memberLinks: NavLink[] = [
    { href: "/member", label: "My Dashboard", icon: "home" },
    { href: "/member/tasks", label: "My Tasks", icon: "check-square" },
  ];

  const links =
    role === "member"
      ? [...memberLinks, accountLink]
      : role === "admin"
      ? [...sharedAdminLinks, ...adminOnlyLinks, accountLink]
      : [...sharedAdminLinks, accountLink];

  function isActive(href: string) {
    if (pathname === href) return true;
    // nested pages (e.g. /admin/members/123) keep their parent section highlighted,
    // except the two dashboard roots, which would otherwise match everything
    if (href === "/admin" || href === "/member") return false;
    return pathname.startsWith(href + "/");
  }

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

  const itemBase =
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col self-start bg-gradient-to-b from-brand-500 to-brand-700 text-white transition-[width] duration-200 ${
        collapsed ? "w-[72px]" : "w-60"
      }`}
    >
      <div className={`flex items-center border-b border-white/10 p-4 ${collapsed ? "flex-col gap-3" : "justify-between gap-2"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Icon name="grid" />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold">Team Dashboard</p>
              <p className="truncate text-xs text-white/70">{name}</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="sidebar-nav"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} />
        </button>
      </div>

      {role === "lead" && !collapsed && (
        <div className="px-4 pt-3">
          <span className="badge bg-white/15 text-white">Department Lead</span>
        </div>
      )}

      <nav id="sidebar-nav" aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto p-3">
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-label={collapsed ? link.label : undefined}
              aria-current={active ? "page" : undefined}
              title={collapsed ? link.label : undefined}
              className={`${itemBase} ${collapsed ? "justify-center" : ""} ${
                active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon name={link.icon} />
              {!collapsed && <span className="truncate">{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-white/10 p-3">
        {DEMO_MODE && role === "admin" && (
          <button
            type="button"
            onClick={handleResetDemo}
            disabled={resetting}
            aria-label={collapsed ? "Reset demo data" : undefined}
            title={collapsed ? "Reset demo data" : undefined}
            className={`${itemBase} w-full text-white/75 hover:bg-white/10 hover:text-white disabled:opacity-50 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Icon name="refresh" />
            {!collapsed && <span>{resetting ? "Resetting..." : "Reset Demo Data"}</span>}
          </button>
        )}
        {resetMsg && !collapsed && <p className="px-3 text-xs text-white/70">{resetMsg}</p>}
        <button
          type="button"
          onClick={handleLogout}
          aria-label={collapsed ? "Log out" : undefined}
          title={collapsed ? "Log out" : undefined}
          className={`${itemBase} w-full text-white/75 hover:bg-white/10 hover:text-white ${collapsed ? "justify-center" : ""}`}
        >
          <Icon name="log-out" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}
