"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Icon, type IconName } from "./icons";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const STORAGE_KEY = "sidebar-collapsed";

type NavLink = { href: string; label: string; icon: IconName };
type NavGroup = { title: string; links: NavLink[] };

const ROLE_LABELS = { admin: "Administrator", lead: "Department lead", member: "Team member" } as const;

function navGroups(role: "admin" | "lead" | "member"): NavGroup[] {
  const account: NavLink = { href: "/account", label: "Account", icon: "user" };
  if (role === "member") {
    return [
      {
        title: "Workspace",
        links: [
          { href: "/member", label: "My Dashboard", icon: "home" },
          { href: "/member/tasks", label: "My Tasks", icon: "check-square" },
        ],
      },
      { title: "Settings", links: [account] },
    ];
  }
  const groups: NavGroup[] = [
    {
      title: "Workspace",
      links: [
        { href: "/admin", label: "Overview", icon: "grid" },
        { href: "/admin/my-tasks", label: "My Tasks", icon: "check-square" },
        { href: "/admin/tasks", label: "All Tasks", icon: "list" },
      ],
    },
    {
      title: "Performance",
      links: [
        { href: "/admin/objectives", label: "Objectives", icon: "target" },
        { href: "/admin/progress", label: "KPI Progress", icon: "bar-chart" },
        { href: "/admin/scores", label: "Composite Scores", icon: "award" },
        { href: "/admin/goals", label: "KPI Goals", icon: "flag" },
        { href: "/admin/consistency", label: "Consistency", icon: "calendar" },
      ],
    },
    {
      title: "Organization",
      links: [
        { href: "/admin/members", label: "Members", icon: "users" },
        ...(role === "admin"
          ? ([
              { href: "/admin/departments", label: "Departments", icon: "layers" },
              { href: "/admin/audit", label: "Audit Log", icon: "clipboard" },
            ] as NavLink[])
          : []),
        account,
      ],
    },
  ];
  return groups;
}

export default function Sidebar({
  role,
  name,
}: {
  role: "admin" | "lead" | "member";
  name: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // storage unavailable (private mode etc.) - just stay expanded
    }
  }, []);

  // close the mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  function isActive(href: string) {
    if (pathname === href) return true;
    // nested pages (e.g. /admin/members/123) keep their parent section highlighted,
    // except the two dashboard roots, which would otherwise match everything
    if (href === "/admin" || href === "/member") return false;
    return pathname.startsWith(href + "/");
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

  const initial = name.trim().charAt(0).toUpperCase() || "U";
  const groups = navGroups(role);

  // `compact` = icon-only rail (desktop collapsed); the mobile drawer is always full width
  function renderPanel(compact: boolean, onClose?: () => void) {
    const itemBase =
      "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";
    return (
      <div className="flex h-full flex-col">
        <div className={`flex items-center px-4 pb-4 pt-5 ${compact ? "flex-col gap-3" : "justify-between gap-2"}`}>
          <Link href={role === "member" ? "/member" : "/admin"} className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lift">
              <Icon name="activity" size={18} />
            </span>
            {!compact && (
              <span className="min-w-0">
                <span className="block truncate font-display text-[15px] font-bold tracking-tight text-white">Team Dashboard</span>
                <span className="block truncate text-[11px] text-slate-400">Team performance</span>
              </span>
            )}
          </Link>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <Icon name="x" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!compact}
              aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
              title={compact ? "Expand sidebar" : "Collapse sidebar"}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <Icon name={compact ? "chevron-right" : "chevron-left"} size={18} />
            </button>
          )}
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.title}>
              {compact ? (
                <div className="mx-3 mb-2 border-t border-white/5" />
              ) : (
                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{group.title}</p>
              )}
              <div className="space-y-0.5">
                {group.links.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-label={compact ? link.label : undefined}
                      aria-current={active ? "page" : undefined}
                      title={compact ? link.label : undefined}
                      className={`${itemBase} ${compact ? "justify-center" : ""} ${
                        active
                          ? "bg-brand-500 text-white shadow-lift"
                          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <Icon name={link.icon} size={18} />
                      {!compact && <span className="truncate">{link.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/5 p-3">
          {DEMO_MODE && role === "admin" && (
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={resetting}
              aria-label={compact ? "Reset demo data" : undefined}
              title={compact ? "Reset demo data" : undefined}
              className={`${itemBase} w-full text-slate-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-50 ${
                compact ? "justify-center" : ""
              }`}
            >
              <Icon name="refresh" size={18} />
              {!compact && <span>{resetting ? "Resetting..." : "Reset demo data"}</span>}
            </button>
          )}
          {resetMsg && !compact && <p className="px-3 text-xs text-slate-400">{resetMsg}</p>}
          <div className={`flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5 ${compact ? "justify-center" : ""}`}>
            <span aria-hidden="true" className="avatar h-9 w-9 bg-brand-500/20 text-sm text-brand-200">
              {initial}
            </span>
            {!compact && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{name}</p>
                <p className="truncate text-[11px] text-slate-400">{ROLE_LABELS[role]}</p>
              </div>
            )}
            {!compact && (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                aria-label="Log out"
                title="Log out"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <Icon name="log-out" size={18} />
              </button>
            )}
          </div>
          {compact && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Log out"
              title="Log out"
              className={`${itemBase} w-full justify-center text-slate-400 hover:bg-white/[0.06] hover:text-white`}
            >
              <Icon name="log-out" size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile / tablet: slim top bar with a menu button */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white">
            <Icon name="activity" size={16} />
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight text-ink">Team Dashboard</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className="rounded-lg border border-hairline p-2 text-ink hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Icon name="menu" size={18} />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-night-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-night-950 shadow-2xl">
            {renderPanel(false, () => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* Desktop: sticky full-height sidebar, collapsible to an icon rail */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 self-start bg-night-950 transition-[width] duration-200 lg:block ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        {renderPanel(collapsed)}
      </aside>
    </>
  );
}
