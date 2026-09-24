"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type Department = { id: string; name: string };
type Member = {
  id: string;
  full_name: string;
  email: string;
  role: string;
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
      <h1 className="text-xl font-semibold">Members</h1>

      <form onSubmit={handleAdd} className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Full name</label>
          <input
            className="input"
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            type="email"
            className="input"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Temp password</label>
          <input
            className="input"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        {!isLead && (
          <div>
            <label className="mb-1 block text-sm font-medium">Role</label>
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
            <label className="mb-1 block text-sm font-medium">Department</label>
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
        <div className="sm:col-span-2 lg:col-span-5">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Creating..." : "Create member"}
          </button>
        </div>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card space-y-3">
        <div>
          <h2 className="font-semibold">Bulk import (CSV)</h2>
          <p className="text-xs text-gray-500">
            Columns: <code>full_name,email,password,department,role</code> (department and role are optional —
            {isLead ? " everyone is added to your department as a member regardless of these columns." : " role defaults to member; department must match an existing department name exactly."}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsvUpload}
          disabled={bulkLoading}
          className="text-sm"
        />
        {bulkLoading && <p className="text-sm text-gray-500">Importing...</p>}
        {bulkResults && (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                  <th className="px-2 py-1">Row</th>
                  <th className="px-2 py-1">Email</th>
                  <th className="px-2 py-1">Result</th>
                </tr>
              </thead>
              <tbody>
                {bulkResults.map((r) => (
                  <tr key={r.row} className="border-b border-gray-100">
                    <td className="px-2 py-1">{r.row}</td>
                    <td className="px-2 py-1">{r.email}</td>
                    <td className={`px-2 py-1 ${r.ok ? "text-green-600" : "text-red-600"}`}>
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
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Role</th>
              <th className="py-2">Department</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-gray-100">
                <td className="py-2">
                  <Link href={`/admin/members/${m.id}`} className="text-brand-600 hover:underline">
                    {m.full_name}
                  </Link>
                </td>
                <td className="py-2">{m.email}</td>
                <td className="py-2 capitalize">{m.role}</td>
                <td className="py-2">{m.departments?.name ?? "—"}</td>
                <td className="py-2 text-right space-x-3">
                  <button
                    onClick={() => handleResetPassword(m.id, m.full_name)}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Reset password
                  </button>
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-500">
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
