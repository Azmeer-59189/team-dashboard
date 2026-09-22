"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export default function Sidebar({
  role,
  name,
}: {
  role: "admin" | "lead" | "member";
  name: string;
}) {
  const pathname = usePathname();

  const sharedAdminLinks = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/tasks", label: "All Tasks" },
    { href: "/admin/progress", label: "KPI Progress" },
    { href: "/admin/goals", label: "KPI Goals" },
    { href: "/admin/consistency", label: "Consistency" },
    { href: "/admin/members", label: "Members" },
  ];
  const adminOnlyLinks = [
    { href: "/admin/departments", label: "Departments" },
    { href: "/admin/audit", label: "Audit Log" },
  ];
  const memberLinks = [
    { href: "/member", label: "My Dashboard" },
    { href: "/member/tasks", label: "My Tasks" },
  ];

  const links =
    role === "member" ? memberLinks : role === "admin" ? [...sharedAdminLinks, ...adminOnlyLinks] : sharedAdminLinks;

  async function handleLogout() {
    await signOut({ callbackUrl: "/login" });
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
      <div className="border-t border-gray-200 p-3">
        <button onClick={handleLogout} className="btn-secondary w-full">
          Log out
        </button>
      </div>
    </aside>
  );
}
