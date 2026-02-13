"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getPropertyConfig } from "@/lib/property";
import { PropertyBadge } from "@/components/PropertyBadge";

type GuideRow = {
  property_slug: string;
  file_path: string;
  file_name: string;
  uploaded_at: string;
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
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

export default function GuestGuidePage() {
  const params = useParams();
  const propertySlug = String(params.property || "");
  const cfg = getPropertyConfig(propertySlug);

  const [guide, setGuide] = useState<GuideRow | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const slug = cfg?.slug || "";

  useEffect(() => {
    (async () => {
      if (!cfg) return;
      setLoading(true);
      setErr(null);

      try {
        // We reuse the host "current" endpoint for now (ok for V1).
        const data = await fetchJSON<{ guide: GuideRow | null }>(
          `/api/host/guide/current?property=${encodeURIComponent(cfg.slug)}`
        );

        if (!data.guide) {
          setGuide(null);
          setSignedUrl(null);
          setLoading(false);
          return;
        }

        setGuide(data.guide);

        // We need a signed URL to read private bucket files.
        const s = await fetchJSON<{ url: string }>(
          `/api/public/guide-url?property=${encodeURIComponent(cfg.slug)}`
        );

        setSignedUrl(s.url);
      } catch (e: any) {
        setErr(e.message || "Failed to load guide");
      } finally {
        setLoading(false);
      }
    })();
  }, [cfg?.slug]);

  const title = useMemo(() => {
    if (!cfg) return "Guide";
    return cfg.slug === "lamar" ? "Guest Guide" : cfg.slug === "gabriel" ? "Guest Guide" : "Guest Guide";
  }, [cfg]);

  if (!cfg) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
        <h1 className="text-xl font-semibold">Property not found</h1>
        <p className="mt-2 text-sm text-white/70">Go back and try a valid property.</p>
        <div className="mt-4">
          <Button href="/p/lamar">Go to Lamar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PropertyBadge slug={cfg.slug} />

      <div className={CARD}>
        <h1 className="text-2xl font-bold">📘 {title}</h1>
        <p className="mt-2 text-sm text-white/70">
          Everything you need for a smooth stay — rules, instructions, and local tips.
        </p>

        <div className="mt-4 flex gap-3">
          <Button href={`/p/${cfg.slug}`} className="shrink-0">
            ← Back
          </Button>
          {signedUrl ? (
            <Button href={signedUrl} variant="primary" className="w-full">
              Open full guide
            </Button>
          ) : (
            <Button disabled variant="primary" className="w-full">
              Open full guide
            </Button>
          )}
        </div>
      </div>

      <div className={SOFT}>
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
            Loading guide…
          </div>
        ) : err ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">{err}</div>
        ) : !guide ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
            No guide has been uploaded yet.
          </div>
        ) : !signedUrl ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
            Guide found, but we couldn’t load it. Please try again.
          </div>
        ) : (
          <div
  className="
    relative
    h-[80vh]
    w-full
    overflow-y-scroll
    overflow-x-hidden
    rounded-3xl
    border border-white/10
    bg-black/20
  "
  style={{ WebkitOverflowScrolling: "touch" }}
>
  <iframe
    title="Guest guide PDF"
    src={signedUrl}
    className="absolute inset-0 h-full w-full"
    style={{
      border: "none",
      touchAction: "pan-y",
    }}
  />
</div>

        )}
      </div>
    </div>
  );
}