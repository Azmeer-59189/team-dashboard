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
        { href: "/admin/assignments", label: "Assignments & reviews", icon: "clipboard" },
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
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const res = await fetch("/api/notifications?count=true", { cache: "no-store", signal: controller.signal });
        if (res.ok) { const data = await res.json(); if (!controller.signal.aborted) setUnread(data.unread); }
      } catch { /* Keep navigation usable during connection failures. */ }
      finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    window.addEventListener("notifications-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort(); window.clearInterval(timer);
      window.removeEventListener("notifications-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

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

  const iconButton =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60";

  // `compact` = icon-only rail (desktop collapsed); the mobile drawer is always full width
  function renderPanel(compact: boolean, onClose?: () => void) {
    return (
      <div className="sidebar-surface relative flex h-full flex-col overflow-hidden">
        {/* Brand */}
        <div className={`flex items-center px-4 pb-5 pt-6 ${compact ? "flex-col gap-4" : "justify-between gap-2"}`}>
          <Link
            href={role === "member" ? "/member" : "/admin"}
            className="flex min-w-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60"
          >
            <span className="sidebar-logo flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white">
              <Icon name="activity" size={19} />
            </span>
            {!compact && (
              <span className="min-w-0">
                <span className="block truncate font-display text-[15px] font-bold tracking-tight text-white">Team Dashboard</span>
                <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-400">Performance workspace</span>
              </span>
            )}
          </Link>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close menu" className={iconButton}>
              <Icon name="x" size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!compact}
              aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
              title={compact ? "Expand sidebar" : "Collapse sidebar"}
              className={iconButton}
            >
              <Icon name={compact ? "chevron-right" : "chevron-left"} size={16} />
            </button>
          )}
        </div>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Navigation: thin scrollbar only on hover, soft fades at the edges */}
        <nav aria-label="Main navigation" className="sidebar-scroll flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {groups.map((group, i) => (
            <div key={group.title}>
              {compact ? (
                i > 0 && <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
              ) : (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{group.title}</p>
              )}
              <div className="space-y-1">
                {group.links.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-label={compact ? link.label : undefined}
                      aria-current={active ? "page" : undefined}
                      title={compact ? link.label : undefined}
                      className={`sidebar-item group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 ${
                        compact ? "justify-center" : ""
                      } ${active ? "sidebar-item-active text-white" : "text-slate-400 hover:text-slate-100"}`}
                    >
                      {active && <span aria-hidden="true" className="sidebar-indicator" />}
                      <span
                        className={`transition-colors ${active ? "text-brand-200" : "text-slate-500 group-hover:text-slate-300"}`}
                      >
                        <Icon name={link.icon} size={18} />
                      </span>
                      {!compact && <span className="truncate">{link.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="space-y-2 p-3">
          <Link href="/notifications" aria-current={pathname === "/notifications" ? "page" : undefined}
            aria-label={`Notifications, ${unread} unread`} title={`Notifications (${unread} unread)`}
            className={`sidebar-item flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 ${compact ? "justify-center" : ""} ${pathname === "/notifications" ? "sidebar-item-active" : ""}`}>
            <Icon name="clipboard" size={18} />
            {!compact && <span className="flex-1">Notifications</span>}
            {unread > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-xs text-white">{unread > 99 ? "99+" : unread}</span>}
          </Link>
          {DEMO_MODE && role === "admin" && (
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={resetting}
              aria-label={compact ? "Reset demo data" : undefined}
              title={compact ? "Reset demo data" : undefined}
              className={`sidebar-item flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-400 hover:text-white disabled:opacity-50 ${
                compact ? "justify-center" : ""
              }`}
            >
              <Icon name="refresh" size={17} />
              {!compact && <span>{resetting ? "Resetting..." : "Reset demo data"}</span>}
            </button>
          )}
          {resetMsg && !compact && <p className="px-3 text-xs text-slate-400">{resetMsg}</p>}

          <div className={`sidebar-profile flex items-center gap-3 rounded-2xl p-2.5 ${compact ? "flex-col" : ""}`}>
            <span
              aria-hidden="true"
              className="sidebar-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-white"
            >
              {initial}
            </span>
            {!compact && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{name}</p>
                <p className="truncate text-[11px] text-slate-400">{ROLE_LABELS[role]}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Log out"
              title="Log out"
              className={iconButton}
            >
              <Icon name="log-out" size={17} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile / tablet: slim top bar with a menu button */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <span className="sidebar-logo flex h-8 w-8 items-center justify-center rounded-lg text-white">
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
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            {renderPanel(false, () => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* Desktop: sticky full-height sidebar, collapsible to an icon rail */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 self-start transition-[width] duration-300 ease-out lg:block ${
          collapsed ? "w-[80px]" : "w-[264px]"
        }`}
      >
        {renderPanel(collapsed)}
      </aside>
    </>
  );
}
