"use client";

import { useState } from "react";

type WifiPayload = {
  ssid: string;
  password: string;
  notes?: string[];
};

export default function WifiClient({ wifi }: { wifi: WifiPayload | null }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied("Copy failed");
      setTimeout(() => setCopied(null), 1200);
    }
  }

  if (!wifi) {
    return (
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-white/70">
          Wi-Fi details aren’t available yet. Please message your host in the Airbnb app.
        </p>
      </section>
    );
  }

  const notes = Array.isArray(wifi.notes) ? wifi.notes : [];

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-semibold text-white">Wi-Fi</h2>

      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-sm text-white/60">Network (SSID)</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="text-xl font-semibold text-white">{wifi.ssid}</div>
            <button
              onClick={() => copy(wifi.ssid, "SSID")}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-white hover:bg-white/15"
            >
              {copied === "SSID" ? "Copied" : "Copy SSID"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-sm text-white/60">Password</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="text-xl font-semibold text-white">{wifi.password}</div>
            <button
              onClick={() => copy(wifi.password, "Password")}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-white hover:bg-white/15"
            >
              {copied === "Password" ? "Copied" : "Copy Password"}
            </button>
          </div>
        </div>

        {notes.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold text-white">Tech notes</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-white/70">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}