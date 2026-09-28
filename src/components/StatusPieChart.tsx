"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

// Same three hues as StatusBadge: sand / sky / teal-green.
const COLORS: Record<string, string> = {
  Pending: "#D8C9A3",
  "In progress": "#6FA8D6",
  Done: "#2E9E7A",
};

export default function StatusPieChart({
  pending,
  inProgress,
  done,
}: {
  pending: number;
  inProgress: number;
  done: number;
}) {
  const data = [
    { name: "Pending", value: pending },
    { name: "In progress", value: inProgress },
    { name: "Done", value: done },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No tasks in this selection yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="none">
          {data.map((d) => (
            <Cell key={d.name} fill={COLORS[d.name]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #DDE6E1", fontSize: 12 }} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
