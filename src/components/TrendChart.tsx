"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function TrendChart({ data }: { data: { date: string; value: number }[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No data in this selection yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2E8A76" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#2E8A76" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4ECE8" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64726D" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64726D" }} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #DDE6E1", fontSize: 12 }} />
        <Area type="monotone" dataKey="value" stroke="#2E8A76" strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
