"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Notice = { id: string; title: string; message: string; createdAt: string; readAt: string | null };
export default function NotificationInbox({ manager }: { manager: boolean }) {
  const [rows, setRows] = useState<Notice[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load(cursor?: string, signal?: AbortSignal) {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/notifications${cursor ? `?before=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store", signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load notifications");
      setRows(old => cursor ? [...old, ...data.notifications].filter((row, i, all) => all.findIndex(n => n.id === row.id) === i) : data.notifications);
      setNext(data.next);
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Unable to load notifications"); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); void load(undefined, controller.signal); return () => controller.abort(); }, []);
  async function mark(ids: string[]) {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!res.ok) throw new Error("Unable to mark notifications as read");
      setRows(old => old.map(row => ids.includes(row.id) ? { ...row, readAt: new Date().toISOString() } : row));
      window.dispatchEvent(new Event("notifications-changed"));
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again"); }
    finally { setBusy(false); }
  }
  const unread = rows.filter(row => !row.readAt).slice(0, 50);
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <button className="btn-secondary" disabled={busy || loading} onClick={() => void load()}>Refresh</button>
      <button className="btn-secondary" disabled={busy || loading || !unread.length} onClick={() => void mark(unread.map(row => row.id))}>Mark displayed as read{unread.length ? ` (${unread.length})` : ""}</button>
      <Link className="btn-primary" href={manager ? "/admin/my-tasks" : "/member/tasks"}>My Tasks</Link>
      <Link className="btn-secondary" href="/leave">Leave & availability</Link>
      {manager && <Link className="btn-secondary" href="/admin/assignments">Assignments & reviews</Link>}
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <div aria-busy={loading} className="space-y-3">
      {!rows.length && <p className="card text-sm text-muted" role="status">{loading ? "Loading notifications…" : error ? "Use Refresh to try again." : "You're all caught up. New assignment and review updates will appear here."}</p>}
      {rows.map(row => <article key={row.id} className={`card ${!row.readAt ? "border-brand-200 bg-brand-50/40" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-semibold text-ink">{!row.readAt && <span aria-label="Unread" className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-500" />}{row.title}</h2>
          <time className="text-xs text-muted" dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time>
        </div>
        <p className="mt-2 text-sm text-muted">{row.message}</p>
        {!row.readAt && <button className="mt-3 text-sm font-medium text-brand-600 disabled:opacity-50" disabled={busy || loading} onClick={() => void mark([row.id])}>Mark as read</button>}
      </article>)}
    </div>
    {next && <button className="btn-secondary" disabled={loading || busy} onClick={() => void load(next)}>{loading ? "Loading…" : "Load older notifications"}</button>}
  </div>;
}
