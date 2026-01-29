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

export default function HostGuidePage() {
  const sp = useSearchParams();
  const property = String(sp.get("property") || "lamar");
  const cfg = getPropertyConfig(property);

  const slug = cfg?.slug || "lamar";

  const [guide, setGuide] = useState<GuideRow | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const title = useMemo(() => {
    if (!cfg) return slug;
    if (cfg.slug === "lamar") return "Lamar";
    if (cfg.slug === "gabriel") return "Gabriel";
    return cfg.displayName || cfg.slug;
  }, [cfg, slug]);

  async function loadCurrent() {
    setErr(null);
    const data = await fetchJSON<{ guide: GuideRow | null }>(`/api/host/guide/current?property=${encodeURIComponent(slug)}`);
    setGuide(data.guide);
  }

  useEffect(() => {
    loadCurrent().catch((e: any) => setErr(e.message || "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function upload() {
    if (!file) return;
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const fd = new FormData();
      fd.append("property", slug);
      fd.append("file", file);

      const res = await fetch("/api/host/guide/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Upload failed");

      setMsg("Uploaded. Replacing guide now…");
      setFile(null);
      await loadCurrent();
      setMsg("Guide uploaded ✅");
      setTimeout(() => setMsg(null), 1500);
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2b124c] via-black to-black px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className={CARD}>
          <div className="text-xs uppercase tracking-wide text-white/60">Host</div>
          <h1 className="mt-1 text-2xl font-bold">Guide PDF • {title}</h1>
          <p className="mt-2 text-sm text-white/70">
            Upload a single PDF per property. Guests will view it inside Stayflo.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button href={`/host?property=${slug}`}>← Host Home</Button>
            <Button href={`/p/${slug}/guide`} variant="primary">
              View Guest Guide Page
            </Button>
          </div>
        </div>

        <div className={SOFT}>
          <div className="text-sm text-white/80">
            <div className="text-xs uppercase tracking-wide text-white/60">Current Guide</div>

            {guide ? (
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-semibold">{guide.file_name}</div>
                <div className="mt-1 text-xs text-white/60">
                  Uploaded: {new Date(guide.uploaded_at).toLocaleString()}
                </div>
                <div className="mt-3">
                  <Button href={`/p/${slug}/guide`} className="w-full">
                    Open in guest view
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                No guide uploaded yet for this property.
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="text-xs uppercase tracking-wide text-white/60">Upload / Replace</div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-white/80 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white hover:file:bg-white/15"
              />

              <div className="mt-4">
                <Button
                  onClick={upload}
                  variant="primary"
                  className="w-full"
                  disabled={!file || loading}
                >
                  {loading ? "Uploading…" : "Upload PDF"}
                </Button>
              </div>

              {msg ? <div className="mt-3 text-sm text-emerald-200">{msg}</div> : null}
              {err ? <div className="mt-3 text-sm text-red-200">{err}</div> : null}

              <div className="mt-3 text-xs text-white/60">
                Tip: Name your file clearly (e.g. “Guest Guide - Lamar.pdf”). Uploading again replaces the guide.
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-white/50">
          Next: we’ll add the guest-facing embedded PDF viewer page.
        </div>
      </div>
    </div>
  );
}