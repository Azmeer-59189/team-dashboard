"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/icons";

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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel (desktop only) */}
      <div className="relative hidden overflow-hidden bg-night-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-500/30 blur-3xl"
        />
        <div aria-hidden="true" className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lift">
            <Icon name="activity" size={20} />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Team Dashboard</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">
            Every task logged.
            <br />
            <span className="bg-gradient-to-r from-brand-200 to-violet-300 bg-clip-text text-transparent">Every goal in view.</span>
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-slate-400">
            Daily task tracking, KPI goals, and performance scores for every department, all in one place.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              { icon: "check-square", label: "Daily tasks" },
              { icon: "flag", label: "KPI goals" },
              { icon: "award", label: "Scores" },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span className="text-brand-200">
                  <Icon name={f.icon as "flag"} size={18} />
                </span>
                <p className="mt-3 text-sm font-medium text-slate-200">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">Accounts are created by your administrator.</p>
      </div>

      {/* Sign-in form */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
              <Icon name="activity" size={18} />
            </span>
            <span className="font-display text-base font-bold tracking-tight text-ink">Team Dashboard</span>
          </div>

          <div>
            <h1 className="font-display text-3xl font-bold text-ink">Welcome back</h1>
            <p className="mt-2 text-sm text-muted">Sign in with the account your admin created for you.</p>
          </div>

          {DEMO_MODE && (
            <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
              <p className="text-sm font-semibold text-brand-700">This is a public demo</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Sample data only, no real organization data. Pick a role to fill in demo credentials:
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["admin", "lead", "member"] as const).map((r) => (
                  <button key={r} type="button" onClick={() => fillDemo(r)} className="btn-secondary px-2 py-1.5 text-xs capitalize">
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="input h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="input h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="alert-error">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary h-11 w-full">
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <Icon name="arrow-right" size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
