"use client";

import { useRouter } from "next/navigation";

type Score = {
  id: string;
  competency: string;
  score: number;
  periodLabel: string;
  notes: string | null;
  scorerName: string;
  createdAt: string;
};

export default function ManualScoresList({ scores }: { scores: Score[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Delete this score entry?")) return;
    const res = await fetch(`/api/admin/manual-scores/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Could not delete score");
      return;
    }
    router.refresh();
  }

  if (scores.length === 0) {
    return <p className="text-sm text-muted">No manual scores recorded yet.</p>;
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-hairline text-muted">
          <th className="py-2">Period</th>
          <th className="py-2">Competency</th>
          <th className="py-2">Score</th>
          <th className="py-2">Notes</th>
          <th className="py-2">By</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {scores.map((s) => (
          <tr key={s.id} className="border-b border-hairline/60">
            <td className="py-2">{s.periodLabel}</td>
            <td className="py-2">{s.competency}</td>
            <td className="py-2">{s.score}/10</td>
            <td className="py-2 text-muted">{s.notes ?? "—"}</td>
            <td className="py-2 text-muted">{s.scorerName}</td>
            <td className="py-2 text-right">
              <button onClick={() => handleDelete(s.id)} className="text-xs text-red-600 hover:underline">
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
