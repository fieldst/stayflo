"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicShell } from "@/components/PublicShell";
import { TypingDemo } from "@/components/TypingDemo";

type GeocodeOk = { ok: true; lat: number; lng: number; formatted: string };
type GeocodeErr = { ok: false; error: string };
type GeocodeResp = GeocodeOk | GeocodeErr;

export default function Home() {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);

  const [error, setError] = useState("");

  const [manualPlace, setManualPlace] = useState("");

  function useMyLocation() {
    setError("");
    setBusy(true);

    try {
      if (!navigator.geolocation) {
        throw new Error("Your browser doesn’t support location.");
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          router.push(`/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
        },
        () => {
          setBusy(false);
          setError("Location permission denied. Please allow location and try again.");
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    } catch (e: any) {
      setBusy(false);
      setError(e?.message || "Could not access location.");
    }
  }

  async function useCityOrZip() {
    const q = manualPlace.trim();
    if (!q) return;

    setError("");
    setManualBusy(true);

    try {
      const res = await fetch(`/api/public/geocode?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as GeocodeResp;

      if (!res.ok || !json || json.ok === false) {
        const msg = (json as GeocodeErr)?.error || `Could not find that location (${res.status})`;
        throw new Error(msg);
      }

      const ok = json as GeocodeOk;
      router.push(`/nearby?lat=${encodeURIComponent(ok.lat)}&lng=${encodeURIComponent(ok.lng)}`);
    } catch (e: any) {
      setError(typeof e?.message === "string" ? e.message : "Could not find that location.");
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <PublicShell>
      <div className="min-h-screen">
        <PublicHeader subtitle="Instantly generate a time-blocked plan near you — powered by live Google ratings, open-now filters, and travel-time awareness." />

        <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
              ✨ New: “Right now” mode
            </div>

            <h1 className="mt-4 text-3xl font-bold leading-tight">
              Find something fun near you — in seconds.
            </h1>

            <p className="mt-3 text-sm text-white/70">
              Pick your vibe + budget, add any “must-knows” (kids, no coffee, BBQ, avoid crowds), and
              we’ll build a plan that feels like a local friend curated it.
            </p>

            <div className="mt-6">
              {/* Step 1 helper */}
              <div className="mb-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <span className="font-semibold">Step 1</span> — Share your location to start
                </div>
                <div className="mt-2 text-sm text-white/70">
                  We need your location so we can search nearby spots and build your plan.
                </div>
              </div>

              {/* Solid CTA */}
              <button
                onClick={useMyLocation}
                disabled={busy}
                className="w-full py-5 text-lg rounded-3xl bg-purple-600 hover:bg-purple-500 text-white font-semibold border border-white/10 shadow-[0_12px_40px_rgba(168,85,247,0.35)] transition-all duration-200 active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? "Locating you…" : "📍  Use my location"}
              </button>

              {/* Manual City/ZIP option */}
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-white/60">
                  Prefer not to share location?
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={manualPlace}
                    onChange={(e) => setManualPlace(e.target.value)}
                    placeholder='Enter city or ZIP (e.g., "Austin" or "78701")'
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") useCityOrZip();
                    }}
                  />

                  <button
                    onClick={useCityOrZip}
                    disabled={manualBusy || !manualPlace.trim()}
                    className="shrink-0 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                  >
                    {manualBusy ? "Finding…" : "Use this city"}
                  </button>
                </div>

                <div className="mt-2 text-xs text-white/50">
                  We’ll convert it to a nearby search area and build your plan the same way.
                </div>
              </div>

              {error ? <div className="mt-3 text-sm text-red-200">{error}</div> : null}

              <div className="mt-5">
                <TypingDemo />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                  <div className="text-sm font-semibold">Travel-time aware</div>
                  <div className="mt-1 text-xs text-white/60">We avoid zig-zag routes.</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                  <div className="text-sm font-semibold">Open-now smart</div>
                  <div className="mt-1 text-xs text-white/60">Perfect for “right now”.</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                  <div className="text-sm font-semibold">Swap anytime</div>
                  <div className="mt-1 text-xs text-white/60">Instant alternatives.</div>
                </div>
              </div>

              <div className="mt-4 text-xs text-white/50">
                Privacy: we only use your location (or the city/ZIP you enter) to search nearby places.
                No login required.
              </div>
            </div>
          </div>
        </main>
      </div>
    </PublicShell>
  );
}