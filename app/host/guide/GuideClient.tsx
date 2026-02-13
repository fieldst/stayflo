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

export default function GuideClient() {
  const sp = useSearchParams();
  const property = String(sp.get("property") || "lamar");

  const [current, setCurrent] = useState<GuideRow | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchJSON<{ guide: GuideRow | null }>(`/api/host/guide/current?property=${encodeURIComponent(property)}`);
      setCurrent(data.guide || null);

      if (data.guide) {
        const s = await fetchJSON<{ url: string }>(`/api/public/guide-url?property=${encodeURIComponent(property)}`);
        setSignedUrl(s.url);
      } else {
        setSignedUrl(null);
      }
    } catch (e: any) {
      setErr(e.message || "Failed to load guide");
      setCurrent(null);
      setSignedUrl(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property]);

  async function upload() {
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Please select a PDF file.");
      return;
    }

    setUploading(true);
    setErr(null);
    setMsg(null);

    try {
      const form = new FormData();
      form.append("property", property);
      form.append("file", file);

      const res = await fetch("/api/host/guide/upload", { method: "POST", body: form });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      if (!res.ok) throw new Error(data?.error || data?.message || data?.raw || `Upload failed (${res.status})`);

      setMsg("Uploaded ✅");
      setFile(null);
      await load();
      setTimeout(() => setMsg(null), 1500);
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const headerTitle = useMemo(() => titleForProperty(property), [property]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2b124c] via-black to-black px-6 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className={CARD}>
          <div className="text-xs uppercase tracking-wide text-white/60">Host</div>
          <h1 className="mt-1 text-2xl font-bold">Upload Guest Guide</h1>
          <p className="mt-2 text-sm text-white/70">
            Property: <span className="text-white/90 font-semibold">{headerTitle}</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button href={`/host/guides?property=${encodeURIComponent(property)}`}>← Back to Guides</Button>
            <Button href={`/p/${encodeURIComponent(property)}`} variant="primary">
              Back to Guest Hub
            </Button>
          </div>

          {err ? <div className="mt-3 text-sm text-red-200">{err}</div> : null}
          {msg ? <div className="mt-3 text-sm text-emerald-200">{msg}</div> : null}
        </div>

        <div className={SOFT}>
          <h2 className="text-lg font-semibold">Current guide</h2>

          {loading ? (
            <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">Loading…</div>
          ) : !current ? (
            <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
              No guide uploaded yet.
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-sm text-white/80">
                <div className="font-semibold text-white/95 break-words leading-snug">
                  {current.file_name}
                </div>
                <div className="mt-1 text-white/60">
                  Uploaded {fmtDate(current.uploaded_at)}
                </div>
              </div>


              <div className="mt-3 flex flex-wrap gap-2">
                <Button href={`/p/${encodeURIComponent(property)}/guide`}>Guest view</Button>
                <Button
                  variant="primary"
                  disabled={!signedUrl}
                  onClick={() => signedUrl && window.open(signedUrl, "_blank", "noopener,noreferrer")}
                >
                  Open PDF
                </Button>
                <Button onClick={load}>Refresh</Button>
              </div>

              {signedUrl ? (
                <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                  <iframe title="Guide preview" src={signedUrl} className="h-[70vh] w-full" />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className={SOFT}>
          <h2 className="text-lg font-semibold">Upload / Replace</h2>
          <p className="mt-1 text-sm text-white/70">Upload a PDF. It will replace the existing file for this property.</p>

          <div className="mt-4 space-y-3">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/15"
            />

            <Button
              variant="primary"
              className="w-full"
              disabled={!file || uploading}
              onClick={upload}
            >
              {uploading ? "Uploading…" : "Upload PDF"}
            </Button>

            <p className="text-xs text-white/60">
              Guests view this at: <span className="text-white/80">/p/{property}/guide</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
