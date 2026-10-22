"use client";
import { useEffect, useState } from "react";

export default function AvailabilityHint({ userId, from, to }: { userId: string; from: string; to: string }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    setMessage("");
    if (!userId || !from || !to || from > to) return;
    const controller = new AbortController();
    setMessage("Checking approved leave…");
    void fetch(`/api/availability?${new URLSearchParams({ user_id: userId, from, to })}`, { signal: controller.signal, cache: "no-store" }).then(async res => {
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!controller.signal.aborted) setMessage(data.available ? "No approved leave overlaps these dates." : "Unavailable: approved leave overlaps these dates. Choose different dates or another person.");
    }).catch(() => { if (!controller.signal.aborted) setMessage("Availability could not be checked. It will be checked again when you save."); });
    return () => controller.abort();
  }, [userId, from, to]);
  return message ? <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-muted">{message}</p> : null;
}
