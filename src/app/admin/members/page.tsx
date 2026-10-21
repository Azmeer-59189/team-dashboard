"use client";

import PageHeader from "@/components/PageHeader";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon } from "@/components/icons";

type Department = { id: string; name: string };
type Member = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  job_title?: string | null;
  department_id: string | null;
  departments?: { name: string } | null;
};
type BulkResult = { row: number; email: string; ok: boolean; error?: string };

export default function MembersPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  const isLead = role === "LEAD";
  const leadDepartmentId = session?.user?.departmentId ?? "";

  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "member",
    department_id: "",
    job_title: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [mRes, dRes] = await Promise.all([
      fetch("/api/admin/members"),
      fetch("/api/admin/departments"),
    ]);
    const mData = await mRes.json();
    const dData = await dRes.json();
    setMembers(mData.members ?? []);
    setDepartments(dData.departments ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  // leads always create members in their own department, with the member role
  useEffect(() => {
    if (isLead) setForm((f) => ({ ...f, role: "member", department_id: leadDepartmentId }));
  }, [isLead, leadDepartmentId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not add member");
      return;
    }

    setForm({
      full_name: "",
      email: "",
      password: "",
      role: isLead ? "member" : "member",
      department_id: isLead ? leadDepartmentId : "",
      job_title: "",
    });
    load();
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this member? This deletes their login and task history.")) return;
    const res = await fetch(`/api/admin/members/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Could not remove member");
      return;
    }
    load();
  }

  async function handleResetPassword(id: string, name: string) {
    const newPassword = window.prompt(`New temporary password for ${name} (min 6 characters):`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    const res = await fetch(`/api/admin/members/${id}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Could not reset password");
      return;
    }
    alert(`Password reset. Give ${name} their new temporary password.`);
  }

  // Very simple CSV parser: no quoted-comma support, one row per line.
  // Expected header: full_name,email,password,department,role
  function parseCsv(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
      return row;
    });
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkLoading(true);
    setBulkResults(null);

    const text = await file.text();
    const rows = parseCsv(text).map((r) => ({
      full_name: r.full_name,
      email: r.email,
      password: r.password,
      department: r.department,
      role: r.role,
      job_title: r.job_title,
    }));

    const res = await fetch("/api/admin/members/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setBulkResults(data.results ?? []);
    setBulkLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Organization" title="Members" description="Create accounts, import in bulk, and manage access for your team." />

      <form onSubmit={handleAdd} className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <h2 className="card-title">Add a member</h2>
          <p className="card-subtitle">They can sign in straight away with the temporary password.</p>
        </div>
        <div>
          <label className="label">Full name</label>
          <input
            className="input"
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Temp password</label>
          <input
            className="input"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Job title (optional)</label>
          <input
            className="input"
            value={form.job_title}
            onChange={(e) => setForm({ ...form, job_title: e.target.value })}
            placeholder="e.g. Coordinator - Europe"
          />
        </div>
        {!isLead && (
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="member">Member</option>
              <option value="lead">Lead</option>
              {isAdmin && <option value="admin">Admin</option>}
            </select>
          </div>
        )}
        {!isLead && (
          <div>
            <label className="label">Department</label>
            <select
              className="input"
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
            >
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex justify-end sm:col-span-2 lg:col-span-3">
          <button type="submit" disabled={loading} className="btn-primary">
            <Icon name="plus" size={16} />
            {loading ? "Creating..." : "Create member"}
          </button>
        </div>
      </form>
      {error && <p className="alert-error">{error}</p>}

      <div className="card space-y-3">
        <div>
          <h2 className="card-title">Bulk import (CSV)</h2>
          <p className="card-subtitle leading-5">
            Columns: <code>full_name,email,password,department,role,job_title</code> (department, role, and job_title are optional —
            {isLead ? " everyone is added to your department as a member regardless of these columns." : " role defaults to member; department must match an existing department name exactly."}
          </p>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-7 text-center transition hover:border-brand-300 hover:bg-brand-50/50">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon name="upload" size={18} />
          </span>
          <span className="text-sm font-semibold text-ink">Choose a CSV file to import</span>
          <span className="text-xs text-muted">Rows are created one by one; results appear below.</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvUpload}
            disabled={bulkLoading}
            className="sr-only"
          />
        </label>
        {bulkLoading && <p className="text-sm text-muted">Importing...</p>}
        {bulkResults && (
          <div className="card max-h-64 overflow-y-auto !p-2 !shadow-none">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1">Row</th>
                  <th className="px-2 py-1">Email</th>
                  <th className="px-2 py-1">Result</th>
                </tr>
              </thead>
              <tbody>
                {bulkResults.map((r) => (
                  <tr key={r.row} className="border-b border-hairline/60">
                    <td className="px-2 py-1">{r.row}</td>
                    <td className="px-2 py-1">{r.email}</td>
                    <td className={`px-2 py-1 font-medium ${r.ok ? "text-positive" : "text-danger"}`}>
                      {r.ok ? "Created" : r.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-muted">
              <th className="py-2">Name</th>
              <th className="py-2">Job Title</th>
              <th className="py-2">Email</th>
              <th className="py-2">Role</th>
              <th className="py-2">Department</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-hairline/60">
                <td className="py-2">
                  <Link href={`/admin/members/${m.id}`} className="flex items-center gap-2.5 whitespace-nowrap font-semibold text-ink hover:text-brand-600">
                    <span aria-hidden="true" className="avatar h-8 w-8 text-xs">
                      {m.full_name.charAt(0).toUpperCase()}
                    </span>
                    {m.full_name}
                  </Link>
                </td>
                <td className="py-2 text-muted">{m.job_title ?? "—"}</td>
                <td className="py-2 text-slate-600">{m.email}</td>
                <td className="py-2">
                  <span
                    className={`badge capitalize ring-1 ring-inset ${
                      m.role === "admin"
                        ? "bg-brand-50 text-brand-700 ring-brand-600/15"
                        : m.role === "lead"
                        ? "bg-violet-50 text-violet-700 ring-violet-600/15"
                        : "bg-slate-100 text-slate-600 ring-slate-500/10"
                    }`}
                  >
                    {m.role}
                  </span>
                </td>
                <td className="py-2">{m.departments?.name ?? "—"}</td>
                <td className="whitespace-nowrap py-2 text-right">
                  <button
                    onClick={() => handleResetPassword(m.id, m.full_name)}
                    className="btn-ghost"
                  >
                    Reset password
                  </button>
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="btn-danger-ghost"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  No members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
