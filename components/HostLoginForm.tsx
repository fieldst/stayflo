"use client";

import { useMemo, useState } from "react";

export default function HostLoginForm({
  propertySlug,
  nextUrl,
}: {
  propertySlug: string;     // "lamar" | "gabriel"
  nextUrl: string;          // where to land after login
}) {
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const backToGuest = useMemo(() => `/p/${propertySlug}`, [propertySlug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(data?.error || "Login failed");
        setLoading(false);
        return;
      }

      // Hard navigate so cookie-based AdminBarGate updates instantly
      window.location.replace(nextUrl || "/host");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
        <div className="text-xs tracking-widest text-white/60">HOST</div>
        <h1 className="mt-1 text-2xl font-semibold">Host Login</h1>
        <p className="mt-2 text-white/70">
          Please log in to manage upgrades and host settings.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block">
            <div className="mb-1 text-xs font-medium text-white/70">Passcode</div>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
              autoFocus
            />
          </label>

          {err ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {err}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !passcode}
            className="
              w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black
              transition hover:opacity-90 disabled:opacity-50
            "
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="mt-4">
          <a
            href={backToGuest}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Back to Guest Portal
          </a>
        </div>
      </div>
    </div>
  );
}