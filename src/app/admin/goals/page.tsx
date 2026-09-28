"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Department = { id: string; name: string };
type Member = { id: string; full_name: string; department_id: string | null };
type Objective = { id: string; title: string; departmentId: string };
type DeptGoal = {
  id: string;
  departmentId: string;
  departmentName: string;
  period: string;
  targetCount: number;
  weight: number;
  category: string;
  objectiveTitle: string | null;
};
type MemberGoal = {
  id: string;
  userId: string;
  memberName: string;
  departmentName: string | null;
  period: string;
  targetCount: number;
  weight: number;
  category: string;
  objectiveTitle: string | null;
};

const emptyDeptForm = { departmentId: "", period: "MONTHLY", targetCount: "", objectiveId: "", weight: "1", category: "CORE" };
const emptyMemberForm = { userId: "", period: "MONTHLY", targetCount: "", objectiveId: "", weight: "1", category: "CORE" };

export default function GoalsPage() {
  const { data: session } = useSession();
  const isLead = session?.user?.role === "LEAD";
  const leadDepartmentId = session?.user?.departmentId ?? "";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [deptGoals, setDeptGoals] = useState<DeptGoal[]>([]);
  const [memberGoals, setMemberGoals] = useState<MemberGoal[]>([]);

  const [deptForm, setDeptForm] = useState(emptyDeptForm);
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [dRes, mRes, gRes, oRes] = await Promise.all([
      fetch("/api/admin/departments"),
      fetch("/api/admin/members"),
      fetch("/api/admin/goals"),
      fetch("/api/admin/objectives"),
    ]);
    const dData = await dRes.json();
    const mData = await mRes.json();
    const gData = await gRes.json();
    const oData = await oRes.json();
    setDepartments(dData.departments ?? []);
    setMembers((mData.members ?? []).filter((m: any) => m.role === "member" || m.role === "lead"));
    setDeptGoals(gData.departmentGoals ?? []);
    setMemberGoals(gData.memberGoals ?? []);
    setObjectives((oData.objectives ?? []).map((o: any) => ({ id: o.id, title: o.title, departmentId: o.departmentId })));
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

  const objectivesForDeptForm = objectives.filter((o) => o.departmentId === deptForm.departmentId);
  const selectedMember = members.find((m) => m.id === memberForm.userId);
  const objectivesForMemberForm = objectives.filter((o) => o.departmentId === selectedMember?.department_id);

  async function handleDeptSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitGoal("department", {
      departmentId: deptForm.departmentId,
      period: deptForm.period,
      targetCount: deptForm.targetCount,
      objectiveId: deptForm.objectiveId || null,
      weight: deptForm.weight,
      category: deptForm.category,
    });
    setDeptForm({ ...emptyDeptForm, departmentId: isLead ? leadDepartmentId : "" });
  }

  async function handleMemberSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitGoal("member", {
      userId: memberForm.userId,
      period: memberForm.period,
      targetCount: memberForm.targetCount,
      objectiveId: memberForm.objectiveId || null,
      weight: memberForm.weight,
      category: memberForm.category,
    });
    setMemberForm(emptyMemberForm);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    setError(null);
    const res = await fetch(`/api/admin/goals/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not delete goal");
      return;
    }
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">KPI Goals</h1>
        <p className="text-sm text-muted">
          Set how many "done" tasks each department (or specific member) should complete per week/month/year.
          An individual target overrides the department default for that person. A person's monthly Core goal feeds
          the Core part of their Composite Score. Behavioural scores are entered separately on that person's profile;
          the category and weight settings here do not change the current Composite Score calculation.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Department goals */}
      <div className="space-y-3">
        <h2 className="font-display font-semibold text-ink">Department defaults</h2>
        <form onSubmit={handleDeptSubmit} className="card grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <div>
            <label className="mb-1 block text-sm font-medium">Department</label>
            <select
              className="input"
              required
              disabled={isLead}
              value={deptForm.departmentId}
              onChange={(e) => setDeptForm({ ...deptForm, departmentId: e.target.value, objectiveId: "" })}
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
              <option value="ANNUAL">Annual</option>
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
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select
              className="input"
              value={deptForm.category}
              onChange={(e) => setDeptForm({ ...deptForm, category: e.target.value })}
            >
              <option value="CORE">Core</option>
              <option value="BEHAVIOURAL">Behavioural</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Weight</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              className="input"
              value={deptForm.weight}
              onChange={(e) => setDeptForm({ ...deptForm, weight: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Objective (optional)</label>
            <select
              className="input"
              value={deptForm.objectiveId}
              onChange={(e) => setDeptForm({ ...deptForm, objectiveId: e.target.value })}
              disabled={!deptForm.departmentId}
            >
              <option value="">None</option>
              {objectivesForDeptForm.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              Save
            </button>
          </div>
        </form>

        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-muted">
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4">Target</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Weight</th>
                <th className="py-2 pr-4">Objective</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {deptGoals.map((g) => (
                <tr key={g.id} className="border-b border-hairline/60">
                  <td className="py-2 pr-4">{g.departmentName}</td>
                  <td className="py-2 pr-4 capitalize">{g.period.toLowerCase()}</td>
                  <td className="py-2 pr-4">{g.targetCount}</td>
                  <td className="py-2 pr-4 capitalize">{g.category?.toLowerCase() ?? "core"}</td>
                  <td className="py-2 pr-4">{g.weight ?? 1}</td>
                  <td className="py-2 pr-4 text-muted">{g.objectiveTitle ?? "—"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => handleDelete(g.id)} className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {deptGoals.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted">
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
        <h2 className="font-display font-semibold text-ink">Individual overrides</h2>
        <form onSubmit={handleMemberSubmit} className="card grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <div>
            <label className="mb-1 block text-sm font-medium">Member</label>
            <select
              className="input"
              required
              value={memberForm.userId}
              onChange={(e) => setMemberForm({ ...memberForm, userId: e.target.value, objectiveId: "" })}
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
              <option value="ANNUAL">Annual</option>
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
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select
              className="input"
              value={memberForm.category}
              onChange={(e) => setMemberForm({ ...memberForm, category: e.target.value })}
            >
              <option value="CORE">Core</option>
              <option value="BEHAVIOURAL">Behavioural</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Weight</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              className="input"
              value={memberForm.weight}
              onChange={(e) => setMemberForm({ ...memberForm, weight: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Objective (optional)</label>
            <select
              className="input"
              value={memberForm.objectiveId}
              onChange={(e) => setMemberForm({ ...memberForm, objectiveId: e.target.value })}
              disabled={!memberForm.userId}
            >
              <option value="">None</option>
              {objectivesForMemberForm.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              Save
            </button>
          </div>
        </form>

        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-muted">
                <th className="py-2 pr-4">Member</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4">Target</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Weight</th>
                <th className="py-2 pr-4">Objective</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {memberGoals.map((g) => (
                <tr key={g.id} className="border-b border-hairline/60">
                  <td className="py-2 pr-4">{g.memberName}</td>
                  <td className="py-2 pr-4">{g.departmentName ?? "—"}</td>
                  <td className="py-2 pr-4 capitalize">{g.period.toLowerCase()}</td>
                  <td className="py-2 pr-4">{g.targetCount}</td>
                  <td className="py-2 pr-4 capitalize">{g.category?.toLowerCase() ?? "core"}</td>
                  <td className="py-2 pr-4">{g.weight ?? 1}</td>
                  <td className="py-2 pr-4 text-muted">{g.objectiveTitle ?? "—"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => handleDelete(g.id)} className="text-xs text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {memberGoals.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted">
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
