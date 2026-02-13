"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import * as Property from "@/lib/property";

type WifiRow = {
  id: string;
  scope_type: string; // "property"
  scope_key: string; // "lamar" | "gabriel"
  ssid: string;
  password: string;
  notes: any;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type Draft = {
  scope_key: string;
  ssid: string;
  password: string;
  notesText: string; // textarea string, split into array
  enabled: boolean;
};

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data?.error || data?.message || data?.raw || `Request failed (${res.status})`);
  return data as T;
}

const CARD = "rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 text-white";
const SOFT = "rounded-3xl border border-white/10 bg-white/5 p-6 text-white";

function titleForProperty(slug: string) {
  const cfg = (Property as any).getPropertyConfig?.(slug);
  if (!cfg) return slug;
  return cfg.displayName || cfg.slug || slug;
}

function notesToText(notes: any): string {
  if (!Array.isArray(notes)) return "";
  return notes.map((n) => String(n)).filter(Boolean).join("\n");
}

function textToNotes(text: string): string[] {
  return (text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function WifiClient() {
  const sp = useSearchParams();
  const activeProperty = String(sp.get("property") || "lamar");

  const propertySlugs = useMemo(() => {
    const maybe = (Property as any).PROPERTIES;
    if (maybe && typeof maybe === "object") return Object.keys(maybe);
    return ["lamar", "gabriel"];
  }, []);

  const [rows, setRows] = useState<WifiRow[]>([]);
  const [pageErr, setPageErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  async function loadAll() {
    setPageErr(null);
    try {
      const data = await fetchJSON<{ wifi: WifiRow[] }>("/api/host/wifi/list");
      setRows(data.wifi || []);
    } catch (e: any) {
      setPageErr(e.message || "Failed to load Wi-Fi");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure each property has a draft, seeded from DB row if present
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };

      for (const slug of propertySlugs) {
        if (next[slug]) continue;

        const existing = rows.find((r) => r.scope_type === "property" && r.scope_key === slug);
        next[slug] = {
          scope_key: slug,
          ssid: existing?.ssid || "",
          password: existing?.password || "",
          notesText: notesToText(existing?.notes),
          enabled: existing?.enabled ?? true,
        };
      }

      return next;
    });
  }, [rows, propertySlugs]);

  async function save(slug: string) {
    const d = drafts[slug];
    if (!d) return;

    const payload = {
      scope_type: "property",
      scope_key: slug,
      ssid: d.ssid.trim(),
      password: d.password.trim(),
      notes: textToNotes(d.notesText),
      enabled: !!d.enabled,
    };

    if (!payload.ssid) return alert("SSID is required.");
    if (!payload.password) return alert("Password is required.");

    setSavingKey(slug);
    setMsg(null);

    try {
      await fetchJSON<{ wifi: WifiRow }>("/api/host/wifi/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setMsg("Saved ✅");
      await loadAll();
      setTimeout(() => setMsg(null), 1400);
    } catch (e: any) {
      alert(e.message || "Save failed");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2b124c] via-black to-black px-6 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className={CARD}>
          <div className="text-xs uppercase tracking-wide text-white/60">Host</div>
          <h1 className="mt-1 text-2xl font-bold">Wi-Fi & Tech</h1>
          <p className="mt-2 text-sm text-white/70">
            Set SSID, password, and tech notes per property. Guests will see this in the portal.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button href="/host">← Host Home</Button>
            <Button href={`/p/${activeProperty}`} variant="primary">
              Back to Guest Hub
            </Button>
            <Button href="/host/guides">Guides</Button>
            <Button href="/host/upgrades">Upgrades</Button>
          </div>

          {pageErr ? <div className="mt-3 text-sm text-red-200">{pageErr}</div> : null}
          {msg ? <div className="mt-3 text-sm text-emerald-200">{msg}</div> : null}
        </div>

        <div className={SOFT}>
          <div className="grid gap-4 md:grid-cols-2">
            {propertySlugs.map((slug) => {
              const d = drafts[slug];
              const saving = savingKey === slug;

              return (
                <div key={slug} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="text-lg font-semibold">{titleForProperty(slug)}</div>

                  {!d ? (
                    <div className="mt-3 text-sm text-white/70">Loading…</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <label className="block">
                        <div className="text-xs text-white/60">Wi-Fi Name (SSID)</div>
                        <input
                          value={d.ssid}
                          onChange={(e) => setDrafts((p) => ({ ...p, [slug]: { ...d, ssid: e.target.value } }))}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                          placeholder="FieldsOfComfort"
                        />
                      </label>

                      <label className="block">
                        <div className="text-xs text-white/60">Wi-Fi Password</div>
                        <input
                          value={d.password}
                          onChange={(e) => setDrafts((p) => ({ ...p, [slug]: { ...d, password: e.target.value } }))}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                          placeholder="Password"
                        />
                      </label>

                      <label className="block">
                        <div className="text-xs text-white/60">Tech notes (one per line)</div>
                        <textarea
                          value={d.notesText}
                          onChange={(e) => setDrafts((p) => ({ ...p, [slug]: { ...d, notesText: e.target.value } }))}
                          rows={5}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                          placeholder={
                            "If the TV won’t connect: Settings → Network → Wi-Fi\nUnplug router for 30 seconds if slow"
                          }
                        />
                      </label>

                      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!d.enabled}
                          onChange={(e) => setDrafts((p) => ({ ...p, [slug]: { ...d, enabled: e.target.checked } }))}
                        />
                        <span className="text-sm">Enabled (visible to guests)</span>
                      </label>

                      <Button variant="primary" className="w-full" disabled={saving} onClick={() => save(slug)}>
                        {saving ? "Saving…" : "Save Wi-Fi"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
