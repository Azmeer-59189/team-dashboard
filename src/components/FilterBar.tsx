"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Option = { id: string; label: string; departmentId?: string | null };

export default function FilterBar({
  departments,
  members,
  hideDepartment = false,
}: {
  departments: Option[];
  members: Option[];
  hideDepartment?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedDepartment = searchParams.get("department") ?? "";
  const selectedMember = searchParams.get("member") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Changing the department scopes the member list to that department, so an
  // out-of-department member selection would be stale - clear it at the same time.
  function handleDepartmentChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("department", value);
    else params.delete("department");
    params.delete("member");
    router.push(`${pathname}?${params.toString()}`);
  }

  const visibleMembers = selectedDepartment
    ? members.filter((m) => m.departmentId === selectedDepartment)
    : members;

  return (
    <div className="card flex flex-wrap items-end gap-4">
      {!hideDepartment && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Department</label>
          <select className="input" value={selectedDepartment} onChange={(e) => handleDepartmentChange(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Member</label>
        <select className="input" value={selectedMember} onChange={(e) => setParam("member", e.target.value)}>
          <option value="">All members</option>
          {visibleMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Status</label>
        <select
          className="input"
          value={searchParams.get("status") ?? ""}
          onChange={(e) => setParam("status", e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">From</label>
        <input
          type="date"
          className="input"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">To</label>
        <input
          type="date"
          className="input"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
        />
      </div>

      <button onClick={() => router.push(pathname)} className="btn-secondary">
        Clear filters
      </button>
    </div>
  );
}
