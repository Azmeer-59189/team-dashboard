"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Leave = { id: string; user_id: string; name: string; start_date: string; end_date: string; reason: string; status: string; version: number; review_note: string | null; reviewed_by: string | null; can_review: boolean; own: boolean; conflicts: number };
export default function LeavePanel({ manager, today }: { manager: boolean; today: string }) {
  const [view, setView] = useState("mine"), [rows, setRows] = useState<Leave[]>([]), [next, setNext] = useState<string | null>(null);
  const [start, setStart] = useState(today), [end, setEnd] = useState(today), [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  async function load(cursor?: string, signal?: AbortSignal) {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/leave?view=${view}${cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store", signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load leave");
      if (!signal?.aborted) { setRows(old => cursor ? [...old, ...data.leaves] : data.leaves); setNext(data.next); }
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Connection failed"); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); setRows([]); void load(undefined, controller.signal); return () => controller.abort(); }, [view]);
  async function save(url: string, method: string, body: unknown) {
    setBusy(true); setError("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save leave");
      setReason(""); await load(); window.dispatchEvent(new Event("notifications-changed"));
    } catch (e) { setError(e instanceof Error ? e.message : "Connection failed"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <form className="card space-y-4" aria-label="Request leave" onSubmit={e => { e.preventDefault(); void save("/api/leave", "POST", { start_date: start, end_date: end, reason }); }}>
      <h2 className="card-title">Request leave</h2>
      <p className="text-sm text-muted">Dates include both the first and last day. Requests need manager approval. KPI targets stay unchanged.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="label">First day</span><input required type="date" min={today} value={start} onChange={e => setStart(e.target.value)} className="input" disabled={busy} /></label>
        <label><span className="label">Last day</span><input required type="date" min={start} value={end} onChange={e => setEnd(e.target.value)} className="input" disabled={busy} /></label>
      </div>
      <label className="block"><span className="label">Reason for leave</span><textarea required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} className="input" rows={2} disabled={busy} /></label>
      <button className="btn-primary" disabled={busy || loading || !reason.trim()}>Request leave</button>
    </form>
    <div className="flex flex-wrap gap-3">
      <button className="btn-secondary" disabled={busy || loading} onClick={() => void load()}>Refresh leave</button>
      {manager && <label><span className="sr-only">Leave view</span><select className="input" value={view} onChange={e => setView(e.target.value)} disabled={busy || loading}><option value="mine">My leave</option><option value="team">Team requests & availability</option></select></label>}
    </div>
    {error && <p role="alert" className="alert-error">{error}</p>}
    <section aria-label="Leave requests" aria-busy={loading} className="space-y-4">
      {!rows.length && <p role="status" className="card text-sm text-muted">{loading ? "Loading leave…" : error ? "Use Refresh leave to try again." : "No leave requests yet."}</p>}
      {rows.map(row => <article key={row.id} className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-ink">{row.name}</h2><p className="mt-1 text-sm text-muted">{row.start_date} to {row.end_date}</p></div><span className="badge bg-brand-50 text-brand-700">{row.status}</span></div>
        <p className="whitespace-pre-wrap break-words text-sm">{row.reason}</p>
        {row.reviewed_by && <p className="text-xs text-muted">Reviewed by {row.reviewed_by}</p>}
        {row.review_note && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{row.review_note}</p>}
        {row.conflicts > 0 && <p className="text-sm text-amber-800">{row.conflicts} existing assignment(s) overlap this leave. {manager && <Link className="underline" href="/admin/assignments?state=ALL">Review assignments</Link>}</p>}
        {row.can_review && row.status === "PENDING" && <div className="space-y-3">
          <label className="block"><span className="label">Leave review note</span><textarea maxLength={2000} className="input" value={notes[row.id] ?? ""} onChange={e => setNotes(old => ({ ...old, [row.id]: e.target.value }))} disabled={busy} /></label>
          <div className="flex gap-2"><button disabled={busy || loading} className="btn-primary" onClick={() => void save(`/api/leave/${row.id}`, "PATCH", { action: "approve", version: row.version, note: notes[row.id] ?? "" })}>Approve leave</button>
            <button disabled={busy || loading || !notes[row.id]?.trim()} className="btn-secondary" onClick={() => void save(`/api/leave/${row.id}`, "PATCH", { action: "reject", version: row.version, note: notes[row.id] ?? "" })}>Reject leave</button></div>
        </div>}
        {row.own && ["PENDING", "APPROVED"].includes(row.status) && row.end_date >= today && <button disabled={busy || loading} className="btn-secondary" onClick={() => { if (confirm("Cancel this leave request? These dates will no longer block assignments.")) void save(`/api/leave/${row.id}`, "PATCH", { action: "cancel", version: row.version }); }}>Cancel leave</button>}
      </article>)}
    </section>
    {next && <button className="btn-secondary" disabled={busy || loading} onClick={() => void load(next)}>Older leave requests</button>}
  </div>;
}
