"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Session = { authed: boolean };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data as T;
}

export default function HostHomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Session>("/api/admin/session")
      .then((s) => setAuthed(s.authed))
      .catch(() => setAuthed(false));
  }, []);

  async function login() {
    setLoading(true);
    setError(null);
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ passcode }),
      });
      setAuthed(true);
      setPasscode("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    await api("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setLoading(false);
  }

  // Loading state
  if (authed === null) {
    return <div className="min-h-screen px-6 py-10 text-white">Loading…</div>;
  }

  // 🔐 LOGIN GATE
  if (!authed) {
    return (
      <div className="min-h-screen px-6 py-12 text-white">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-black/40 p-6">
          <h1 className="text-xl font-semibold">Host Login</h1>
          <p className="mt-2 text-sm text-white/70">
            Enter your admin passcode to access Stayflo host tools.
          </p>

          <div className="mt-6 space-y-3">
            <input
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              type="password"
              placeholder="Admin passcode"
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/25"
            />
            <Button
              onClick={login}
              disabled={!passcode || loading}
              variant="primary"
              className="w-full"
            >
              {loading ? "Checking…" : "Unlock Host Portal"}
            </Button>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  // ✅ HOST PORTAL
  return (
    <div className="min-h-screen px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="text-xs uppercase tracking-wide text-white/60">Host</div>
          <h1 className="mt-1 text-2xl font-bold">Host Portal</h1>
          <p className="mt-2 text-sm text-white/70">
            Manage upgrades and future host tools.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-3">
          <Button href="/host/upgrades" variant="primary" className="w-full">
            ⚡ Manage Upgrades
          </Button>

          <Button href="/host/guides" variant="primary" className="w-full">
            📘 Manage Guides
          </Button>
          <Button href="/host/wifi" variant="primary" className="w-full">
           📶 Manage Wi-Fi & Tech
          </Button>

          <Button onClick={logout} className="w-full">
            🚪 Log out
          </Button>

          <p className="mt-2 text-xs text-white/60">
            Bookmark <span className="font-mono">/host</span> for quick access.
          </p>
        </div>
      </div>
    </div>
  );
}
