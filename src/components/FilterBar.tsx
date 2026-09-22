"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Option = { id: string; label: string };

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

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="card flex flex-wrap items-end gap-4">
      {!hideDepartment && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Department</label>
          <select
            className="input"
            defaultValue={searchParams.get("department") ?? ""}
            onChange={(e) => setParam("department", e.target.value)}
          >
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
        <label className="mb-1 block text-xs font-medium text-gray-500">Member</label>
        <select
          className="input"
          defaultValue={searchParams.get("member") ?? ""}
          onChange={(e) => setParam("member", e.target.value)}
        >
          <option value="">All members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
        <select
          className="input"
          defaultValue={searchParams.get("status") ?? ""}
          onChange={(e) => setParam("status", e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
        <input
          type="date"
          className="input"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
        <input
          type="date"
          className="input"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
        />
      </div>

      <button
        onClick={() => router.push(pathname)}
        className="btn-secondary"
      >
        Clear filters
      </button>
    </div>
  );
}
