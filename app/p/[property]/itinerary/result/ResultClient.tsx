"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getPropertyConfig } from "@/lib/property";
import { trackEvent } from "@/lib/events";

function pretty(label: string) {
  return label.replaceAll("_", " ");
}

export default function ResultClient() {
  const params = useParams();
  const propertySlug = String(params.property || "");
  const cfg = getPropertyConfig(propertySlug);
  const sp = useSearchParams();

  const data = useMemo(() => {
    const duration = sp.get("duration") || "full_day";
    const pace = sp.get("pace") || "balanced";
    const transport = sp.get("transport") || "drive";
    const budget = sp.get("budget") || "$$";
    const vibes = (sp.get("vibes") || "Foodie").split(",").filter(Boolean);
    const notes = sp.get("notes") || "";
    return { duration, pace, transport, budget, vibes, notes };
  }, [sp]);

  if (!cfg) {
    return (
      <main className="min-h-screen p-6">
        <div className="mx-auto max-w-lg rounded-2xl border p-6">
          <h1 className="text-xl font-semibold">Property not found</h1>
          <p className="mt-2 text-sm text-gray-600">Go back and try a valid property.</p>
          <div className="mt-4">
            <Link className="rounded-xl border px-4 py-2 text-sm" href="/p/lamar">
              Go to Lamar
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Track view once per render cycle
  useMemo(() => {
    trackEvent(cfg.slug, "itinerary_result_view", data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocks = [
    { time: "9:00 AM", title: "Coffee + quick bite", note: "A cozy spot that matches your budget and vibe." },
    { time: "11:00 AM", title: "Top local attraction", note: "A classic pick — easy to adjust based on pace." },
    { time: "1:00 PM", title: "Lunch (Host Favorite)", note: "One of our go-to spots. Great reviews and consistent quality." },
    { time: "3:00 PM", title: "Explore + photo stop", note: "Walkable or drive-friendly depending on your choice." },
    { time: "6:00 PM", title: "Dinner + evening option", note: "We’ll tailor this to nightlife/relaxed/romantic based on your vibe." },
  ];

  return (
    <main className="min-h-screen p-5">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="rounded-2xl border p-5">
          <div className="text-xs uppercase tracking-wide text-gray-500">{cfg.city}</div>
          <h1 className="mt-1 text-2xl font-semibold">Your Itinerary</h1>
          <p className="mt-2 text-sm text-gray-600">
            Placeholder itinerary for now — next we’ll connect AI generation so this becomes fully tailored.
          </p>

          <div className="mt-4 flex gap-2">
            <Link className="rounded-2xl border px-4 py-2 text-sm" href={`/p/${cfg.slug}/itinerary`}>
              ← Edit
            </Link>
            <Link className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white" href={`/p/${cfg.slug}`}>
              Home
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border p-5">
          <h2 className="text-lg font-semibold">Your preferences</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl border p-3">
              <div className="text-xs text-gray-500">Budget</div>
              <div className="font-semibold">{data.budget}</div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="text-xs text-gray-500">Pace</div>
              <div className="font-semibold">{pretty(data.pace)}</div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="text-xs text-gray-500">Duration</div>
              <div className="font-semibold">{pretty(data.duration)}</div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="text-xs text-gray-500">Transport</div>
              <div className="font-semibold">{pretty(data.transport)}</div>
            </div>
          </div>

          <div className="mt-3 text-sm">
            <div className="text-xs text-gray-500">Vibes</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {data.vibes.map((v) => (
                <span key={v} className="rounded-full border px-3 py-1 text-xs">
                  {v}
                </span>
              ))}
            </div>
          </div>

          {data.notes ? (
            <div className="mt-3 text-sm">
              <div className="text-xs text-gray-500">Notes</div>
              <div className="mt-1 rounded-2xl border p-3">{data.notes}</div>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          {blocks.map((b) => (
            <div key={b.time} className="rounded-2xl border p-5">
              <div className="text-xs uppercase tracking-wide text-gray-500">{b.time}</div>
              <div className="mt-1 text-lg font-semibold">{b.title}</div>
              <div className="mt-2 text-sm text-gray-600">{b.note}</div>

              <button
                className="mt-4 rounded-2xl border px-4 py-2 text-sm"
                onClick={() => trackEvent(cfg.slug, "itinerary_swap_click", { time: b.time, title: b.title })}
              >
                🔁 Swap this
              </button>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border p-5">
          <h2 className="text-lg font-semibold">✨ Enhance your stay</h2>
          <p className="mt-1 text-sm text-gray-600">Optional extras available upon request.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link className="rounded-2xl border px-4 py-3 text-sm" href={`/p/${cfg.slug}/request?type=early_checkin`}>
              ⏰ Early Check-In
            </Link>
            <Link className="rounded-2xl border px-4 py-3 text-sm" href={`/p/${cfg.slug}/request?type=late_checkout`}>
              🌙 Late Check-Out
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
