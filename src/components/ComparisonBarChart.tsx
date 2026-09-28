"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function ComparisonBarChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No data in this selection yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4ECE8" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64726D" }} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64726D" }} />
        <Tooltip
          cursor={{ fill: "rgba(15, 110, 92, 0.06)" }}
          contentStyle={{ borderRadius: 12, border: "1px solid #DDE6E1", fontSize: 12 }}
        />
        <Bar dataKey="value" fill="#3A9C86" radius={[8, 8, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
