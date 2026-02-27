"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/events";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicShell } from "@/components/PublicShell";

type Vibe =
  | "Foodie"
  | "Local Gems"
  | "Family"
  | "Romantic"
  | "Nightlife"
  | "Relaxed"
  | "Outdoors";

const VIBES: Vibe[] = [
  "Foodie",
  "Local Gems",
  "Family",
  "Romantic",
  "Nightlife",
  "Relaxed",
  "Outdoors",
];

const DURATIONS = [
  { value: "half_day", label: "Half Day (4–6 hrs)" },
  { value: "full_day", label: "Full Day (8–10 hrs)" },
  { value: "two_days", label: "Two Days" },
];

const PACE = [
  { value: "chill", label: "Chill" },
  { value: "balanced", label: "Balanced" },
  { value: "packed", label: "Packed" },
];

const TRANSPORT = [
  { value: "walk", label: "Walk" },
  { value: "drive", label: "Drive" },
  { value: "bike", label: "Bike" },
];

const BUDGET = [
  { value: "$", label: "Budget-friendly" },
  { value: "$$", label: "Moderate" },
  { value: "$$$", label: "Nice" },
  { value: "$$$$", label: "Splurge" },
] as const;

const TIME_OPTIONS = [
  "06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30",
  "11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30",
  "21:00"
] as const;

export default function NearbyWizard() {
  const router = useRouter();
  const sp = useSearchParams();

  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const [duration, setDuration] = useState<string>("full_day");
  const [pace, setPace] = useState<string>("balanced");
  const [transport, setTransport] = useState<string>("drive");
  const [budget, setBudget] = useState<string>(""); // required
  const [vibes, setVibes] = useState<Vibe[]>(["Foodie", "Local Gems"]);
  const [notes, setNotes] = useState<string>("");
  const [planDay, setPlanDay] = useState<"today" | "tomorrow" | "now">("today");
  const [startTime, setStartTime] = useState<string>("09:00");
  // Location changer state
  const [locInput, setLocInput] = useState("");
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState("");

  const canGenerate = useMemo(
    () => Boolean(hasCoords && budget && vibes.length > 0),
    [hasCoords, budget, vibes.length]
  );

  useEffect(() => {
  if (planDay === "tomorrow") {
    setStartTime("09:00");
  } else if (planDay === "today") {
    setStartTime((prev) => (prev ? prev : "09:00"));
  } else {
    // Right now mode ignores start time
    setStartTime("09:00");
  }
}, [planDay]);

  function toggleVibe(v: Vibe) {
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  async function applyCityOrZip() {
    const q = locInput.trim();
    if (!q) return;

    setLocError("");
    setLocBusy(true);

    try {
      const res = await fetch(`/api/public/geocode?q=${encodeURIComponent(q)}`);
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not find that location.");
      }

      const newLat = json.lat as number;
      const newLng = json.lng as number;

      // stays on this page, updates location
      router.push(`/nearby?lat=${encodeURIComponent(newLat)}&lng=${encodeURIComponent(newLng)}`);
    } catch (e: any) {
      setLocError(e?.message || "Could not find that location.");
    } finally {
      setLocBusy(false);
    }
  }

  function useCurrentLocation() {
    setLocError("");
    setLocBusy(true);

    try {
      if (!navigator.geolocation) {
        throw new Error("Your browser doesn’t support location.");
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLat = pos.coords.latitude;
          const newLng = pos.coords.longitude;
          router.push(`/nearby?lat=${encodeURIComponent(newLat)}&lng=${encodeURIComponent(newLng)}`);
          setLocBusy(false);
        },
        () => {
          setLocBusy(false);
          setLocError("Location permission denied. Please allow location and try again.");
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    } catch (e: any) {
      setLocBusy(false);
      setLocError(e?.message || "Could not access location.");
    }
  }

  function onGenerate() {
    if (!canGenerate) return;

    trackEvent("public", "nearby_itinerary_generate_click", {
      duration,
      pace,
      transport,
      budget,
      vibes,
      planDay,
    });

    const qs = new URLSearchParams();
    qs.set("lat", String(lat));
    qs.set("lng", String(lng));
    qs.set("duration", duration);
    qs.set("pace", pace);
    qs.set("transport", transport);
    qs.set("budget", budget);
    qs.set("planDay", planDay);
    if (planDay !== "now" && startTime) qs.set("startTime", startTime);
    qs.set("vibes", vibes.join(","));
    if (notes.trim()) qs.set("notes", notes.trim());

    router.push(`/nearby/result?${qs.toString()}`);
  }

  return (
    <PublicShell>
      <div className="min-h-screen">
        <PublicHeader subtitle="Tell us your vibe + budget — we’ll build something fun near you using live ratings and smart routing." />

        <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
          {/* ✅ ALWAYS SHOW THIS LOCATION CARD */}
          <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-white/60">Change location</div>

            <div className="mt-2 text-sm text-white/80">
              Planning somewhere else? Enter a city or ZIP — or switch back to your current location.
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={locInput}
                onChange={(e) => setLocInput(e.target.value)}
                placeholder='City or ZIP (e.g., "Austin" or "78701")'
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyCityOrZip();
                }}
              />

              <button
                onClick={applyCityOrZip}
                disabled={locBusy || !locInput.trim()}
                className="shrink-0 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
              >
                {locBusy ? "Updating…" : "Use this city"}
              </button>

              <button
                onClick={useCurrentLocation}
                disabled={locBusy}
                className="shrink-0 rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-sm font-semibold text-white/90 hover:bg-white/10 disabled:opacity-50"
              >
                {locBusy ? "…" : "Use my location"}
              </button>
            </div>

            {locError ? <div className="mt-3 text-sm text-red-200">{locError}</div> : null}

            {!hasCoords ? (
              <div className="mt-3 text-xs text-white/60">
                Tip: set a location above to unlock itinerary generation.
              </div>
            ) : null}
          </div>

          {/* If no coords, show the message and stop here */}
          {!hasCoords ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h1 className="text-xl font-semibold">Location needed</h1>
              <p className="mt-2 text-sm text-white/70">
                Enter a city/ZIP above or tap “Use my location” so we can plan something near you.
              </p>
              <div className="mt-4">
                <Button href="/" variant="primary">
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="text-xs uppercase tracking-wide text-white/60">Stayflo Concierge</div>
                <h1 className="mt-1 text-2xl font-bold">Plan something near you</h1>
                <p className="mt-2 text-sm text-white/70">
                  Pick your vibe + budget and we’ll generate a time-blocked plan with travel-time tips.
                </p>
              </div>

              {/* Budget */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">💵 Budget</h2>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                    Required
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {BUDGET.map((b) => {
                    const active = budget === b.value;
                    return (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => setBudget(b.value)}
                        className={[
                          "rounded-3xl border px-4 py-4 text-left transition-all duration-150",
                          "active:scale-[0.98]",
                          active
                            ? "border-white/25 bg-white/15"
                            : "border-white/10 bg-black/20 hover:bg-white/10 hover:border-white/20",
                        ].join(" ")}
                      >
                        <div className="text-lg font-bold">{b.value}</div>
                        <div className={`mt-1 text-xs ${active ? "text-white/80" : "text-white/60"}`}>
                          {b.label}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!budget ? <p className="mt-3 text-xs text-white/60">Choose a budget to generate.</p> : null}
              </div>

              {/* Vibe */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold">🎭 Vibe</h2>
                <p className="mt-1 text-sm text-white/70">Pick 1+.</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {VIBES.map((v) => {
                    const active = vibes.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => toggleVibe(v)}
                        className={[
                          "rounded-full border px-4 py-2 text-sm transition-all duration-150",
                          "active:scale-[0.98]",
                          active
                            ? "border-white/25 bg-white/15 text-white"
                            : "border-white/10 bg-black/20 text-white/90 hover:bg-white/10 hover:border-white/20",
                        ].join(" ")}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Controls */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-5">
                <div className="mt-2">
                  <div className="text-sm font-medium text-white/80">Plan for</div>
                  <div className="mt-2">
                    <select
                      value={planDay}
                      onChange={(e) => setPlanDay(e.target.value as "today" | "tomorrow" | "now")}
                      className="w-full rounded-xl bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-white/20"
                    >
                      <option value="today" className="text-black">
                        Today (right now / tonight)
                      </option>
                      <option value="tomorrow" className="text-black">
                        Tomorrow (start in the morning)
                      </option>
                      <option value="now" className="text-black">
                        Right now (surprise me)
                      </option>
                    </select>
                    <div className="mt-2 text-xs text-white/60">
                      “Right now” will prioritize open-now options.
                    </div>
                  </div>
                </div>
                <div>
  <div className="text-sm font-medium text-white/80">Start time</div>
  <div className="mt-2">
    <select
      value={startTime}
      onChange={(e) => setStartTime(e.target.value)}
      disabled={planDay === "now"}
      className={[
        "w-full rounded-xl bg-white/5 px-4 py-3 text-white ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-white/20",
        planDay === "now" ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t} className="text-black">
          {t}
        </option>
      ))}
    </select>
    <div className="mt-2 text-xs text-white/60">
      {planDay === "now"
        ? "Disabled for “Right now” mode."
        : "Pick when you want the itinerary to begin (Central Time)."}
    </div>
  </div>
</div>
                <div>
                  <label className="text-sm font-semibold text-white/90">⏱️ Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                  >
                    {DURATIONS.map((d) => (
                      <option key={d.value} value={d.value} className="bg-black">
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-white/90">🏃 Pace</label>
                  <select
                    value={pace}
                    onChange={(e) => setPace(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                  >
                    {PACE.map((p) => (
                      <option key={p.value} value={p.value} className="bg-black">
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-white/90">🚗 Transportation</label>
                  <select
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
                  >
                    {TRANSPORT.map((t) => (
                      <option key={t.value} value={t.value} className="bg-black">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-white/90">📝 Anything we should know?</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder='Example: "No coffee", "Kids", "BBQ", "Avoid crowds"'
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
                    rows={3}
                  />
                </div>
              </div>

              {/* CTA */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <Button
                  onClick={onGenerate}
                  className={["w-full", !canGenerate ? "opacity-40 pointer-events-none" : ""].join(" ")}
                  variant="primary"
                >
                  ✨ Generate My Itinerary
                </Button>

                <p className="mt-3 text-xs text-white/60">Public concierge. No login needed.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </PublicShell>
  );
}