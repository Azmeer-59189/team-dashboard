"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Department = { id: string; name: string };

export default function DepartmentsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/departments");
    const data = await res.json();
    setDepartments(data.departments ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not add department");
      return;
    }

    setName("");
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this department? Members in it will keep their tasks but lose their department link.")) return;
    const res = await fetch(`/api/admin/departments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not delete department");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Departments</h1>

      {isAdmin && (
        <form onSubmit={handleAdd} className="card flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">New department name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Designers"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            Add
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Name</th>
              {isAdmin && <th className="py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id} className="border-b border-gray-100">
                <td className="py-2">{d.name}</td>
                {isAdmin && (
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan={2} className="py-6 text-center text-gray-500">
                  No departments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
