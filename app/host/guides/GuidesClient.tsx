"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import * as Property from "@/lib/property";

type GuideRow = {
  property_slug: string;
  file_path: string;
  file_name: string;
  uploaded_at: string;
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
  return cfg.displayName || cfg.name || cfg.slug || slug;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function GuidesClient() {
  const sp = useSearchParams();
  const activeProperty = String(sp.get("property") || "lamar");

  const propertySlugs = useMemo(() => {
    const maybe = (Property as any).PROPERTIES;
    if (maybe && typeof maybe === "object") return Object.keys(maybe);
    return ["lamar", "gabriel"];
  }, []);

  const [rows, setRows] = useState<GuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const byProperty = useMemo(() => {
    const map = new Map<string, GuideRow>();
    for (const r of rows) {
      const prev = map.get(r.property_slug);
      if (!prev) map.set(r.property_slug, r);
      else if (new Date(r.uploaded_at).getTime() > new Date(prev.uploaded_at).getTime()) {
        map.set(r.property_slug, r);
      }
    }
    return map;
  }, [rows]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchJSON<{ guides: GuideRow[] }>("/api/host/guide/list");
      setRows(data.guides || []);
    } catch (e: any) {
      setErr(e.message || "Failed to load guides");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openSigned(slug: string) {
    try {
      const data = await fetchJSON<{ url: string }>(`/api/public/guide-url?property=${encodeURIComponent(slug)}`);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      alert(e.message || "Could not open guide");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2b124c] via-black to-black px-6 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className={CARD}>
          <div className="text-xs uppercase tracking-wide text-white/60">Host</div>
          <h1 className="mt-1 text-2xl font-bold">Guides</h1>
          <p className="mt-2 text-sm text-white/70">
            Upload a PDF guest guide per property. Guests can view it at{" "}
            <span className="text-white/80">/p/[property]/guide</span>.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button href="/host">← Host Home</Button>
            <Button href={`/p/${activeProperty}`} variant="primary">
              Back to Guest Hub
            </Button>
            <Button href="/host/wifi">Wi-Fi</Button>
            <Button href="/host/upgrades">Upgrades</Button>
          </div>

          {err ? <div className="mt-3 text-sm text-red-200">{err}</div> : null}
        </div>

        <div className={SOFT}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Your properties</h2>
            <Button onClick={load} className="shrink-0">
              Refresh
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {propertySlugs.map((slug) => {
              const active = slug === activeProperty;
              return (
                <Button
                  key={slug}
                  href={`/host/guides?property=${encodeURIComponent(slug)}`}
                  variant={active ? "primary" : "secondary"}
                >
                  {titleForProperty(slug)}
                </Button>
              );
            })}
          </div>

          {loading ? (
            <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
              Loading…
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4">
              {propertySlugs.map((slug) => {
                const row = byProperty.get(slug) || null;

                return (
                  <div key={slug} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                    {/* ✅ Mobile-safe layout: stack on small screens */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Left: info */}
                      <div className="min-w-0">
                        <div className="text-lg font-semibold">{titleForProperty(slug)}</div>

                        <div className="mt-2 text-sm text-white/70">
                          {row ? (
                            <>
                              <div className="text-white/60">Current guide:</div>

                              {/* ✅ Prevent overflow */}
                              <div className="mt-1 font-semibold text-white/90 break-words leading-snug">
                                {row.file_name}
                              </div>

                              <div className="mt-1 text-white/60">
                                Uploaded {fmtDate(row.uploaded_at)}
                              </div>
                            </>
                          ) : (
                            <span className="text-white/60">No guide uploaded yet.</span>
                          )}
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="grid grid-cols-1 gap-2 sm:w-[220px]">
                        <Button
                          href={`/host/guide?property=${encodeURIComponent(slug)}`}
                          variant="primary"
                          className="w-full"
                        >
                          {row ? "Replace PDF" : "Upload PDF"}
                        </Button>

                        <Button href={`/p/${encodeURIComponent(slug)}/guide`} className="w-full">
                          Guest view
                        </Button>

                        <Button className="w-full" disabled={!row} onClick={() => openSigned(slug)}>
                          Open PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-xs text-white/60">
            Tip: keep the filename friendly (e.g., “Fields of Comfort Guest Guide.pdf”). Guests will view a signed link securely.
          </p>
        </div>
      </div>
    </div>
  );
}
