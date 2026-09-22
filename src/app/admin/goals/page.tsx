"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Department = { id: string; name: string };
type Member = { id: string; full_name: string };
type DeptGoal = { id: string; departmentId: string; departmentName: string; period: string; targetCount: number };
type MemberGoal = { id: string; userId: string; memberName: string; departmentName: string | null; period: string; targetCount: number };

export default function GoalsPage() {
  const { data: session } = useSession();
  const isLead = session?.user?.role === "LEAD";
  const leadDepartmentId = session?.user?.departmentId ?? "";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [deptGoals, setDeptGoals] = useState<DeptGoal[]>([]);
  const [memberGoals, setMemberGoals] = useState<MemberGoal[]>([]);

  const [deptForm, setDeptForm] = useState({ departmentId: "", period: "MONTHLY", targetCount: "" });
  const [memberForm, setMemberForm] = useState({ userId: "", period: "MONTHLY", targetCount: "" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [dRes, mRes, gRes] = await Promise.all([
      fetch("/api/admin/departments"),
      fetch("/api/admin/members"),
      fetch("/api/admin/goals"),
    ]);
    const dData = await dRes.json();
    const mData = await mRes.json();
    const gData = await gRes.json();
    setDepartments(dData.departments ?? []);
    setMembers((mData.members ?? []).filter((m: any) => m.role === "member"));
    setDeptGoals(gData.departmentGoals ?? []);
    setMemberGoals(gData.memberGoals ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function submitGoal(scope: "department" | "member", body: any) {
    setError(null);
    const res = await fetch("/api/admin/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, ...body }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "Could not save goal");
      return;
    }
    load();
  }

  // leads may only set the department default for their own department
  const visibleDepartments = isLead ? departments.filter((d) => d.id === leadDepartmentId) : departments;

  useEffect(() => {
    if (isLead && leadDepartmentId) setDeptForm((f) => ({ ...f, departmentId: leadDepartmentId }));
  }, [isLead, leadDepartmentId]);

  async function handleDeptSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitGoal("department", {
      departmentId: deptForm.departmentId,
      period: deptForm.period,
      targetCount: deptForm.targetCount,
    });
    setDeptForm({ departmentId: "", period: "MONTHLY", targetCount: "" });
  }

  async function handleMemberSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitGoal("member", {
      userId: memberForm.userId,
      period: memberForm.period,
      targetCount: memberForm.targetCount,
    });
    setMemberForm({ userId: "", period: "MONTHLY", targetCount: "" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/admin/goals/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">KPI Goals</h1>
        <p className="text-sm text-gray-500">
          Set how many "done" tasks each department (or specific member) should complete per week/month.
          An individual target overrides the department default for that person.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Department goals */}
      <div className="space-y-3">
        <h2 className="font-semibold">Department defaults</h2>
        <form onSubmit={handleDeptSubmit} className="card grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Department</label>
            <select
              className="input"
              required
              disabled={isLead}
              value={deptForm.departmentId}
              onChange={(e) => setDeptForm({ ...deptForm, departmentId: e.target.value })}
            >
              <option value="">Select...</option>
              {visibleDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Period</label>
            <select
              className="input"
              value={deptForm.period}
              onChange={(e) => setDeptForm({ ...deptForm, period: e.target.value })}
            >
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Target (done tasks)</label>
            <input
              type="number"
              min={1}
              required
              className="input"
              value={deptForm.targetCount}
              onChange={(e) => setDeptForm({ ...deptForm, targetCount: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              Save
            </button>
          </div>
        </form>

        <div className="card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2">Department</th>
                <th className="py-2">Period</th>
                <th className="py-2">Target</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {deptGoals.map((g) => (
                <tr key={g.id} className="border-b border-gray-100">
                  <td className="py-2">{g.departmentName}</td>
                  <td className="py-2 capitalize">{g.period.toLowerCase()}</td>
                  <td className="py-2">{g.targetCount}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => handleDelete(g.id)} className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {deptGoals.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-500">
                    No department goals yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual overrides */}
      <div className="space-y-3">
        <h2 className="font-semibold">Individual overrides</h2>
        <form onSubmit={handleMemberSubmit} className="card grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Member</label>
            <select
              className="input"
              required
              value={memberForm.userId}
              onChange={(e) => setMemberForm({ ...memberForm, userId: e.target.value })}
            >
              <option value="">Select...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Period</label>
            <select
              className="input"
              value={memberForm.period}
              onChange={(e) => setMemberForm({ ...memberForm, period: e.target.value })}
            >
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Target (done tasks)</label>
            <input
              type="number"
              min={1}
              required
              className="input"
              value={memberForm.targetCount}
              onChange={(e) => setMemberForm({ ...memberForm, targetCount: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              Save
            </button>
          </div>
        </form>

        <div className="card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2">Member</th>
                <th className="py-2">Department</th>
                <th className="py-2">Period</th>
                <th className="py-2">Target</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {memberGoals.map((g) => (
                <tr key={g.id} className="border-b border-gray-100">
                  <td className="py-2">{g.memberName}</td>
                  <td className="py-2">{g.departmentName ?? "—"}</td>
                  <td className="py-2 capitalize">{g.period.toLowerCase()}</td>
                  <td className="py-2">{g.targetCount}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => handleDelete(g.id)} className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {memberGoals.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No individual overrides yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
