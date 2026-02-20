"use client";

import { useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getPropertyConfig } from "@/lib/property";
import { trackEvent } from "@/lib/events";
import { Button } from "@/components/ui/Button";
import { PropertyBadge } from "@/components/PropertyBadge";

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

export default function ItineraryWizard() {
  const router = useRouter();
  const params = useParams();

  const propertySlug = String(params.property || "");
  const cfg = getPropertyConfig(propertySlug);

  const [duration, setDuration] = useState<string>("full_day");
  const [pace, setPace] = useState<string>("balanced");
  const [transport, setTransport] = useState<string>("drive");
  const [budget, setBudget] = useState<string>(""); // required
  const [vibes, setVibes] = useState<Vibe[]>(["Foodie", "Local Gems"]);
  const [notes, setNotes] = useState<string>("");
  const [planDay, setPlanDay] = useState<"today" | "tomorrow" | "now">("today");

  const canGenerate = useMemo(
    () => Boolean(cfg && budget && vibes.length > 0),
    [cfg, budget, vibes.length]
  );

  function toggleVibe(v: Vibe) {
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  function onGenerate() {
    if (!cfg || !canGenerate) return;

    trackEvent(cfg.slug, "itinerary_generate_click", {
      duration,
      pace,
      transport,
      budget,
      vibes,
    });

    const qs = new URLSearchParams();
    qs.set("duration", duration);
    qs.set("pace", pace);
    qs.set("transport", transport);
    qs.set("budget", budget);
    qs.set("planDay", planDay);
    qs.set("vibes", vibes.join(","));
    if (notes.trim()) qs.set("notes", notes.trim());

    router.push(`/p/${cfg.slug}/itinerary/result?${qs.toString()}`);
  }

  if (!cfg) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
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
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/60">{cfg.city}</div>
            <h1 className="mt-1 text-2xl font-bold">Plan My Day</h1>
            <p className="mt-2 text-sm text-white/70">
              Pick your vibe + budget and we’ll generate a time-blocked plan (host favorites included).
            </p>
          </div>

          <Button href={`/p/${cfg.slug}`} className="shrink-0">
            Home
          </Button>
        </div>
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

        {!budget ? (
          <p className="mt-3 text-xs text-white/60">Choose a budget to generate your plan.</p>
        ) : null}
      </div>

      {/* Vibe */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">🎭 Vibe</h2>
        <p className="mt-1 text-sm text-white/70">Pick 1+ (we’ll prioritize host favorites first).</p>

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
       <div className="mt-6">
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
      If it’s late, “Today” will focus on open-now night options.
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
            placeholder='Example: "Traveling with kids", "Vegetarian", "Love coffee shops"'
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
            rows={3}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <Button
          onClick={onGenerate}
          className={[
            "w-full",
            !canGenerate ? "opacity-40 pointer-events-none" : "",
          ].join(" ")}
          variant="primary"
        >
          ✨ Generate My Itinerary
        </Button>

        <p className="mt-3 text-xs text-white/60">
          No login needed. This is just for your stay.
        </p>

        {!budget ? (
          <p className="mt-2 text-xs text-white/50">
            Tip: choose a budget first — it’s required.
          </p>
        ) : null}
      </div>

      {/* Tiny footer nav (optional) */}
      <div className="flex justify-center">
        <Link
          href={`/p/${cfg.slug}/request`}
          className="text-xs text-white/60 hover:text-white/80 underline underline-offset-4"
        >
          Looking for upgrades instead?
        </Link>
      </div>
    </div>
  );
}
