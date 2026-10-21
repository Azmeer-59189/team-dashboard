"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not change password");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(true);
    // every session signed in with the old password (this one included) is now invalid
    setTimeout(() => signOut({ callbackUrl: "/login" }), 1500);
  }

  return (
    <div className="card space-y-4">
      <h2 className="card-title">Change password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Current password</label>
          <input
            type="password"
            required
            className="input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label">New password</label>
          <input
            type="password"
            required
            minLength={6}
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input
            type="password"
            required
            minLength={6}
            className="input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && <p className="alert-error">{error}</p>}
        {success && <p className="alert-success">Password changed. Signing you out so you can sign in with the new one…</p>}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
