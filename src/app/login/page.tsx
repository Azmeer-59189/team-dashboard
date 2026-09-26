"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push("/");
    router.refresh();
  }

  function fillDemo(role: "admin" | "lead" | "member") {
    const creds = {
      admin: { email: "demo-admin@example.com", password: "demopass123" },
      lead: { email: "demo-lead@example.com", password: "demopass123" },
      member: { email: "demo-ava.chen@example.com", password: "demopass123" },
    }[role];
    setEmail(creds.email);
    setPassword(creds.password);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        {DEMO_MODE && (
          <div className="card border-brand-100 bg-brand-50">
            <p className="mb-2 text-sm font-semibold text-brand-600">This is a public demo</p>
            <p className="mb-3 text-xs text-muted">
              Sample data only, no real organization data. Click a role to fill in demo credentials:
            </p>
            <div className="flex gap-2">
              <button onClick={() => fillDemo("admin")} className="btn-secondary text-xs">
                Admin
              </button>
              <button onClick={() => fillDemo("lead")} className="btn-secondary text-xs">
                Lead
              </button>
              <button onClick={() => fillDemo("member")} className="btn-secondary text-xs">
                Member
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <h1 className="mb-1 font-display text-xl font-semibold text-ink">Team Dashboard</h1>
          <p className="mb-6 text-sm text-muted">
            Sign in with the account your admin created for you.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
