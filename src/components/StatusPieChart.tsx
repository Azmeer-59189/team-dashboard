"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { STATUS_COLORS } from "./StatusBadge";

const TOOLTIP_STYLE = { borderRadius: 12, border: "1px solid #E6E9F2", fontSize: 12, boxShadow: "0 8px 24px rgba(15,23,42,0.08)" };

export default function StatusPieChart({
  pending,
  inProgress,
  done,
}: {
  pending: number;
  inProgress: number;
  done: number;
}) {
  const all = [
    { name: "Pending", value: pending, color: STATUS_COLORS.pending },
    { name: "In progress", value: inProgress, color: STATUS_COLORS["in-progress"] },
    { name: "Done", value: done, color: STATUS_COLORS.done },
  ];
  const total = pending + inProgress + done;
  const data = all.filter((d) => d.value > 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted">No tasks in this selection yet.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
      <div className="relative h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={66} outerRadius={92} paddingAngle={2} cornerRadius={6} stroke="none">
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold tabular-nums text-ink">{total}</span>
          <span className="text-xs font-medium text-muted">tasks</span>
        </div>
      </div>
      <ul className="w-full max-w-[240px] space-y-3">
        {all.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2.5 whitespace-nowrap text-slate-600">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="tabular-nums">
              <span className="font-semibold text-ink">{d.value}</span>
              <span className="ml-1.5 text-xs text-muted">{Math.round((d.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
