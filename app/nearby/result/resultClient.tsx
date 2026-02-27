"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/events";
import { Button } from "@/components/ui/Button";
import type { GeneratedItinerary, ItineraryBlock, PlaceCandidate } from "@/lib/itinerary/types";

function pretty(label: string) {
  return label.replaceAll("_", " ");
}

type ApiOk = { ok: true; itinerary: GeneratedItinerary };
type ApiErr = { ok: false; error: string };
type ApiResp = ApiOk | ApiErr;

function ratingLine(b: ItineraryBlock): string {
  const p = b.primary;
  if (!p) return "";

  const rating = typeof p.rating === "number" ? p.rating.toFixed(1) : "—";
  const count = typeof p.userRatingsTotal === "number" ? p.userRatingsTotal.toLocaleString() : "";
  const price =
    typeof p.priceLevel === "number" ? "$".repeat(Math.min(Math.max(p.priceLevel, 1), 4)) : "";
  const bits = [`⭐ ${rating}`];
  if (count) bits.push(`${count} reviews`);
  if (price) bits.push(price);
  return bits.join(" • ");
}

function getUsedPlaceIds(it: GeneratedItinerary): Set<string> {
  const used = new Set<string>();
  for (const b of it.blocks) {
    const id = b.primary?.placeId;
    if (id) used.add(id);
  }
  return used;
}

function pickNextSwap(args: {
  block: ItineraryBlock;
  usedGlobal: Set<string>;
}): { next: PlaceCandidate | null; rest: PlaceCandidate[] } {
  const { block, usedGlobal } = args;
  if (!block.alternates.length) return { next: null, rest: [] };

  const used = new Set(usedGlobal);
  if (block.primary?.placeId) used.delete(block.primary.placeId);

  const idx = block.alternates.findIndex((p) => !used.has(p.placeId));
  if (idx >= 0) {
    const next = block.alternates[idx];
    const rest = [...block.alternates.slice(0, idx), ...block.alternates.slice(idx + 1)];
    return { next, rest };
  }

  const [next, ...rest] = block.alternates;
  return { next: next ?? null, rest };
}

export default function NearbyResultClient() {
  const sp = useSearchParams();

    const prefs = useMemo(() => {
    const duration = sp.get("duration") || "full_day";
    const pace = sp.get("pace") || "balanced";
    const transport = sp.get("transport") || "drive";
    const budget = sp.get("budget") || "$$";
    const vibes = (sp.get("vibes") || "Foodie").split(",").filter(Boolean);
    const notes = sp.get("notes") || "";
    const startTime = sp.get("startTime") || "";

    const planDayParam = sp.get("planDay");
    const planDay: "today" | "tomorrow" | "now" =
      planDayParam === "tomorrow" ? "tomorrow" : planDayParam === "now" ? "now" : "today";

    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));

    return { duration, pace, transport, budget, vibes, notes, planDay, startTime, lat, lng };
  }, [sp]);

  const hasCoords = Number.isFinite(prefs.lat) && Number.isFinite(prefs.lng);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [narrating, setNarrating] = useState<Record<string, boolean>>({});

  const LOADING_LINES = [
    "Mapping out your perfect day…",
    "Finding hidden gems locals love…",
    "Balancing vibes, budget, and travel time…",
    "Locking in the best stops for your schedule…",
    "Almost ready — this is going to be fun…",
  ];
  const [loadingLineIdx, setLoadingLineIdx] = useState(0);

  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    trackEvent("public", "nearby_itinerary_result_view", {
      duration: prefs.duration,
      pace: prefs.pace,
      transport: prefs.transport,
      budget: prefs.budget,
      planDay: prefs.planDay,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!hasCoords) {
        setError("Missing location. Go back and tap “Use my location”.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setItinerary(null);

      try {
        const res = await fetch("/api/public/itinerary/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: prefs.lat,
            lng: prefs.lng,
            duration: prefs.duration,
            pace: prefs.pace,
            transport: prefs.transport,
            budget: prefs.budget,
            vibes: prefs.vibes,
            notes: prefs.notes,
            planDay: prefs.planDay,
            startTime: prefs.planDay === "now" ? undefined : prefs.startTime || undefined,
          }),
        });

        const json = (await res.json()) as ApiResp;
        if (!res.ok || !json || json.ok === false) {
          const msg = (json as ApiErr)?.error || `Request failed (${res.status})`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setItinerary((json as ApiOk).itinerary);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(typeof e?.message === "string" ? e.message : "Failed to generate itinerary");
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [hasCoords, prefs]);

  useEffect(() => {
    if (!loading) return;

    const t = setInterval(() => {
      setLoadingLineIdx((i) => (i + 1) % LOADING_LINES.length);
    }, 1300);

    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    if (!itinerary) return;

    const t = setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    return () => clearTimeout(t);
  }, [loading, itinerary]);

  async function refreshNarrativeForBlock(args: {
    blockId: string;
    place: PlaceCandidate;
    block: ItineraryBlock;
  }) {
    if (!itinerary) return;

    setNarrating((prev) => ({ ...prev, [args.blockId]: true }));

    try {
      const res = await fetch("/api/public/itinerary/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: itinerary.city,
          prefs: {
            duration: itinerary.prefs.duration,
            pace: itinerary.prefs.pace,
            transport: itinerary.prefs.transport,
            budget: itinerary.prefs.budget,
            vibes: itinerary.prefs.vibes,
            notes: itinerary.prefs.notes || "",
          },
          block: {
            id: args.block.id,
            title: args.block.title,
            category: args.block.category,
            timeLabel: args.block.timeLabel,
          },
          place: {
            placeId: args.place.placeId,
            name: args.place.name,
            rating: args.place.rating,
            userRatingsTotal: args.place.userRatingsTotal,
            priceLevel: args.place.priceLevel,
            address: args.place.address,
            googleMapsUri: args.place.googleMapsUri,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Narration failed");

      setItinerary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) =>
            b.id === args.blockId ? { ...b, whyThis: json.whyThis, tips: json.tips } : b
          ),
        };
      });
    } catch (e) {
      console.error(e);
    } finally {
      setNarrating((prev) => ({ ...prev, [args.blockId]: false }));
    }
  }

  function swap(blockId: string) {
    setItinerary((prev) => {
      if (!prev) return prev;

      const usedGlobal = getUsedPlaceIds(prev);

      const blocks = prev.blocks.map((b) => {
        if (b.id !== blockId) return b;
        if (!b.alternates.length) return b;

        const { next, rest } = pickNextSwap({ block: b, usedGlobal });
        if (!next) return b;

        const newAlternates = b.primary ? [...rest, b.primary] : rest;

        setTimeout(() => {
          refreshNarrativeForBlock({
            blockId,
            place: next,
            block: { ...b, primary: next },
          });
        }, 0);

        return { ...b, primary: next, alternates: newAlternates };
      });

      return { ...prev, blocks };
    });
  }

  return (
    <div className="space-y-6">
      {/* Top card */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-white/60">Stayflo Concierge</div>
            <h1 className="text-2xl font-bold">Your Itinerary</h1>
            <p className="text-sm text-white/70">
              Built from live Google ratings + a concierge-style plan tailored to your vibe and budget.
            </p>
          </div>

          <div className="flex gap-2">
            <Button href={`/nearby?lat=${encodeURIComponent(String(prefs.lat))}&lng=${encodeURIComponent(
              String(prefs.lng)
            )}`} variant="secondary">
              Edit
            </Button>
            <Button href="/" variant="primary">
              Home
            </Button>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Your preferences</h2>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs text-white/60">Budget</div>
            <div className="font-semibold">{prefs.budget}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs text-white/60">Pace</div>
            <div className="font-semibold">{pretty(prefs.pace)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs text-white/60">Duration</div>
            <div className="font-semibold">{pretty(prefs.duration)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs text-white/60">Transport</div>
            <div className="font-semibold">{pretty(prefs.transport)}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-xs text-white/60">Vibes</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {prefs.vibes.map((v) => (
              <span
                key={v}
                className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/80"
              >
                {v}
              </span>
            ))}
          </div>
        </div>

        {prefs.notes ? (
          <div className="mt-3">
            <div className="text-xs text-white/60">Notes</div>
            <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/80">
              {prefs.notes}
            </div>
          </div>
        ) : null}
      </div>

      {/* Loading / Error / Results */}
      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="text-sm text-white/70">{LOADING_LINES[loadingLineIdx]}</div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-white/40" />
            </div>
            <div className="mt-3 text-xs text-white/50">Pulling top-rated options near you…</div>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6">
          <div className="text-sm font-semibold text-white">Couldn’t generate itinerary</div>
          <div className="mt-2 text-sm text-white/70">{error}</div>
          <div className="mt-4">
            <Button
              variant="primary"
              onClick={() => {
                trackEvent("public", "nearby_itinerary_retry_click", {});
                window.location.reload();
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : itinerary ? (
        <>
          <div ref={resultsRef} className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">{itinerary.headline}</h2>
            <p className="mt-2 text-sm text-white/70">{itinerary.overview}</p>
          </div>

          <div className="space-y-3">
            {itinerary.blocks.map((b) => (
              <div key={b.id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="text-xs uppercase tracking-wide text-white/60">{b.timeLabel}</div>
                <div className="mt-1 text-lg font-semibold">{b.title}</div>

                {b.primary ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{b.primary.name}</div>
                        <div className="mt-1 text-xs text-white/60">{ratingLine(b)}</div>

                        {typeof b.primary.openNow === "boolean" ? (
                          <div className="mt-1 text-xs text-white/60">
                            {b.primary.openNow ? "Open now" : "Likely closed right now"}
                          </div>
                        ) : null}

                        {b.primary.address ? (
                          <div className="mt-2 text-sm text-white/70">{b.primary.address}</div>
                        ) : null}
                      </div>

                      {b.primary.googleMapsUri ? (
                        <a
                          href={b.primary.googleMapsUri}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 hover:bg-white/10"
                        >
                          Open in Maps
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-3 text-sm text-white/80">
                      {narrating[b.id] ? "Updating details..." : b.whyThis}
                    </div>

                    {b.tips.length ? (
                      <ul className="mt-3 space-y-1 text-sm text-white/70">
                        {b.tips.map((t, i) => (
                          <li key={i}>• {t}</li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="text-xs text-white/50">
                        {b.alternates.length
                          ? `${b.alternates.length} swap option(s) available`
                          : "No swaps available"}
                      </div>

                      <button
                        className={[
                          "rounded-2xl border px-4 py-2 text-sm transition-all duration-150",
                          "active:scale-[0.98]",
                          b.alternates.length
                            ? "border-white/10 bg-black/20 text-white/90 hover:bg-white/10 hover:border-white/20"
                            : "border-white/10 bg-black/10 text-white/40 cursor-not-allowed",
                        ].join(" ")}
                        disabled={!b.alternates.length}
                        onClick={() => swap(b.id)}
                      >
                        Swap
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/70">
                    We couldn’t find a strong match for this block right now. Try changing your vibe or budget.
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">General tips</h2>
            <ul className="mt-3 space-y-1 text-sm text-white/70">
              {itinerary.generalTips.map((t, i) => (
                <li key={i}>• {t}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Quick notes</h2>
            <ul className="mt-3 space-y-1 text-sm text-white/70">
              {itinerary.disclaimers.map((t, i) => (
                <li key={i}>• {t}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}