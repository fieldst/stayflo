"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getPropertyConfig } from "@/lib/property";

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

const KNOWN_PROPERTIES = ["lamar", "gabriel"] as const;

export default function HostGuidesPage() {
  const sp = useSearchParams();
  const activeProperty = String(sp.get("property") || "lamar"); // used for "Back to Guest" convenience

  const [guides, setGuides] = useState<Record<string, GuideRow | null>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<Record<string, string | null>>({});
  const [err, setErr] = useState<Record<string, string | null>>({});
  const [pageErr, setPageErr] = useState<string | null>(null);

  const properties = useMemo(() => {
    // If you add more properties later, just extend KNOWN_PROPERTIES (or wire into a PROPERTIES export).
    return [...KNOWN_PROPERTIES];
  }, []);

  async function loadAll() {
    setPageErr(null);
    try {
      const data = await fetchJSON<{ guides: GuideRow[] }>("/api/host/guide/list");
      const map: Record<string, GuideRow | null> = {};
      for (const slug of properties) map[slug] = null;
      for (const g of data.guides || []) {
        if (g?.property_slug) map[g.property_slug] = g;
      }
      setGuides(map);
    } catch (e: any) {
      setPageErr(e.message || "Failed to load guides");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadFor(slug: string) {
    const file = files[slug];
    if (!file) return;

    setLoading((p) => ({ ...p, [slug]: true }));
    setErr((p) => ({ ...p, [slug]: null }));
    setMsg((p) => ({ ...p, [slug]: null }));

    try {
      const fd = new FormData();
      fd.append("property", slug);
      fd.append("file", file);

      const res = await fetch("/api/host/guide/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Upload failed");

      setMsg((p) => ({ ...p, [slug]: "Guide uploaded ✅" }));
      setFiles((p) => ({ ...p, [slug]: null }));
      await loadAll();
      setTimeout(() => setMsg((p) => ({ ...p, [slug]: null })), 1600);
    } catch (e: any) {
      setErr((p) => ({ ...p, [slug]: e.message || "Upload failed" }));
    } finally {
      setLoading((p) => ({ ...p, [slug]: false }));
    }
  }

  function titleFor(slug: string) {
    const cfg = getPropertyConfig(slug);
    if (!cfg) return slug;
    if (cfg.slug === "lamar") return "Lamar";
    if (cfg.slug === "gabriel") return "Gabriel";
    return cfg.displayName || cfg.slug;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2b124c] via-black to-black px-6 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className={CARD}>
          <div className="text-xs uppercase tracking-wide text-white/60">Host</div>
          <h1 className="mt-1 text-2xl font-bold">Guides (PDF)</h1>
          <p className="mt-2 text-sm text-white/70">
            Manage guest guide PDFs for every property in one place. Uploading again replaces the existing guide.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button href="/host">← Host Home</Button>
            <Button href={`/p/${activeProperty}`} variant="primary">
              Back to Guest Hub
            </Button>
          </div>

          {pageErr ? <div className="mt-3 text-sm text-red-200">{pageErr}</div> : null}
        </div>

        <div className={SOFT}>
          <div className="grid gap-4 md:grid-cols-2">
            {properties.map((slug) => {
              const g = guides[slug] || null;
              const file = files[slug] || null;
              const isLoading = !!loading[slug];
              const m = msg[slug] || null;
              const e = err[slug] || null;

              return (
                <div key={slug} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-white/60">Property</div>
                      <div className="mt-1 text-lg font-semibold">{titleFor(slug)}</div>
                      <div className="mt-1 text-xs text-white/60">Slug: {slug}</div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button href={`/p/${slug}/guide`} className="whitespace-nowrap">
                        Guest guide page
                      </Button>
                      <Button href={`/p/${slug}`} className="whitespace-nowrap">
                        Guest hub
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-wide text-white/60">Current Guide</div>
                    {g ? (
                      <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="font-semibold break-all">{g.file_name}</div>
                        <div className="mt-1 text-xs text-white/60">
                          Uploaded: {new Date(g.uploaded_at).toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                        No guide uploaded yet.
                      </div>
                    )}
                  </div>

                  <div className="mt-5">
                    <div className="text-xs uppercase tracking-wide text-white/60">Upload / Replace</div>

                    <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(ev) => setFiles((p) => ({ ...p, [slug]: ev.target.files?.[0] || null }))}
                        className="block w-full text-sm text-white/80 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white hover:file:bg-white/15"
                      />

                      <div className="mt-4">
                        <Button
                          onClick={() => uploadFor(slug)}
                          variant="primary"
                          className="w-full"
                          disabled={!file || isLoading}
                        >
                          {isLoading ? "Uploading…" : "Upload PDF"}
                        </Button>
                      </div>

                      {m ? <div className="mt-3 text-sm text-emerald-200">{m}</div> : null}
                      {e ? <div className="mt-3 text-sm text-red-200">{e}</div> : null}

                      <div className="mt-3 text-xs text-white/60">
                        Tip: Name your file clearly (e.g. “Guest Guide - {titleFor(slug)}.pdf”).
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-white/50">
            Next: we can add a “Preview” button that opens the signed URL directly, but the guest page already embeds it.
          </div>
        </div>
      </div>
    </div>
  );
}