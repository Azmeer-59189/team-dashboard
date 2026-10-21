"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const TOOLTIP_STYLE = { borderRadius: 12, border: "1px solid #E6E9F2", fontSize: 12, boxShadow: "0 8px 24px rgba(15,23,42,0.08)" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10-21" -> "Oct 21"
function shortDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : iso;
}

export default function TrendChart({ data }: { data: { date: string; value: number }[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No data in this selection yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5B5FEF" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#5B5FEF" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#EEF0F6" />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
        <Tooltip labelFormatter={(l) => shortDate(String(l))} contentStyle={TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="value" name="Tasks" stroke="#5B5FEF" strokeWidth={2.5} fill="url(#trendFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
