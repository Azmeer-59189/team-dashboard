"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const TOOLTIP_STYLE = { borderRadius: 12, border: "1px solid #E6E9F2", fontSize: 12, boxShadow: "0 8px 24px rgba(15,23,42,0.08)" };

export default function ComparisonBarChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No data in this selection yet.</p>;
  }

  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={sorted} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C82F7" />
            <stop offset="100%" stopColor="#5B5FEF" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#EEF0F6" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} tickLine={false} axisLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "rgba(91, 95, 239, 0.06)" }} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" name="Tasks" fill="url(#barFill)" radius={[8, 8, 3, 3]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}
