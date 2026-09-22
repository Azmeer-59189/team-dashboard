"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS: Record<string, string> = {
  Pending: "#9ca3af",
  "In progress": "#f59e0b",
  Done: "#22c55e",
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
    return <p className="py-8 text-center text-sm text-gray-400">No tasks in this selection yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={COLORS[d.name]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
