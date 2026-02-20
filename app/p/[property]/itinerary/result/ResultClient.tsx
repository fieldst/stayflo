"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getPropertyConfig } from "@/lib/property";
import { trackEvent } from "@/lib/events";
import { Button } from "@/components/ui/Button";
import { PropertyBadge } from "@/components/PropertyBadge";
import type {
  GeneratedItinerary,
  ItineraryBlock,
  PlaceCandidate,
} from "@/lib/itinerary/types";

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
  const count =
    typeof p.userRatingsTotal === "number"
      ? p.userRatingsTotal.toLocaleString()
      : "";
  const price =
    typeof p.priceLevel === "number"
      ? "$".repeat(Math.min(Math.max(p.priceLevel, 1), 4))
      : "";
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

/**
 * Pick the next alternate that is not used by other blocks.
 * - We allow swapping out the current primary (so remove it from used for selection).
 * - If all alternates are used, we fallback to the first alternate.
 */
function pickNextSwap(args: {
  block: ItineraryBlock;
  usedGlobal: Set<string>;
}): { next: PlaceCandidate | null; rest: PlaceCandidate[] } {
  const { block, usedGlobal } = args;

  if (!block.alternates.length) return { next: null, rest: [] };

  // Allow swapping away from the current primary (don't treat it as "blocked" for selection)
  const used = new Set(usedGlobal);
  if (block.primary?.placeId) used.delete(block.primary.placeId);

  // Find first alternate not used
  const idx = block.alternates.findIndex((p) => !used.has(p.placeId));
  if (idx >= 0) {
    const next = block.alternates[idx];
    const rest = [
      ...block.alternates.slice(0, idx),
      ...block.alternates.slice(idx + 1),
    ];
    return { next, rest };
  }

  // Fallback: everything is used; still cycle so Swap does something
  const [next, ...rest] = block.alternates;
  return { next: next ?? null, rest };
}

export default function ResultClient() {
  const params = useParams();
  const propertySlug = String(params.property || "");
  const cfg = getPropertyConfig(propertySlug);
  const sp = useSearchParams();

  const prefs = useMemo(() => {
    const duration = sp.get("duration") || "full_day";
    const pace = sp.get("pace") || "balanced";
    const transport = sp.get("transport") || "drive";
    const budget = sp.get("budget") || "$$";
    const vibes = (sp.get("vibes") || "Foodie")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const notes = sp.get("notes") || "";

    const planDayParam = sp.get("planDay");
    const planDay: "today" | "tomorrow" | "now" =
  planDayParam === "tomorrow" ? "tomorrow" : planDayParam === "now" ? "now" : "today";

    return { duration, pace, transport, budget, vibes, notes, planDay };
  }, [sp]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);

  const [narrating, setNarrating] = useState<Record<string, boolean>>({});

  // ✅ Full-screen “exciting” loader
  const LOADING_LINES = [
    "Mapping out your perfect day…",
    "Finding hidden gems locals love…",
    "Avoiding tourist traps (you’re welcome 😄)…",
    "Balancing vibes, budget, and travel time…",
    "Locking in the best stops for your schedule…",
    "Almost ready — this is going to be fun…",
  ];
  const [loadingLineIdx, setLoadingLineIdx] = useState(0);

  // ✅ Scroll target (so results auto-jump into view)
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (cfg) {
      trackEvent(cfg.slug, "itinerary_result_view", prefs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.slug]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!cfg) return;
      setLoading(true);
      setError("");
      setItinerary(null);

      try {
        const res = await fetch("/api/public/itinerary/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property: cfg.slug,
            duration: prefs.duration,
            pace: prefs.pace,
            transport: prefs.transport,
            budget: prefs.budget,
            vibes: prefs.vibes,
            notes: prefs.notes,
            planDay: prefs.planDay,
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
      } catch (e: unknown) {
        if (!cancelled) {
          const msg =
            typeof (e as any)?.message === "string"
              ? (e as any).message
              : "Failed to generate itinerary";
          setError(msg);
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [cfg, prefs]);

  // Rotate loading lines while loading
  useEffect(() => {
    if (!loading) return;

    const t = setInterval(() => {
      setLoadingLineIdx((i) => (i + 1) % LOADING_LINES.length);
    }, 1300);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Auto-scroll to results once itinerary loads
  useEffect(() => {
    if (loading) return;
    if (!itinerary) return;

    const t = setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
            planDay: itinerary.prefs.planDay, // ✅ keep consistent
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

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Narration failed");
      }

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

        // Trigger narrative refresh AFTER swapping
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
      {/* ✅ Full-screen loading overlay (blocks all interaction) */}
      {loading ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="text-2xl font-semibold text-white">✨ Planning your day</div>
            <div className="mt-2 text-sm text-white/70">
              {LOADING_LINES[loadingLineIdx]}
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white/70" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-white/50 [animation-delay:200ms]" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-white/30 [animation-delay:400ms]" />
            </div>

            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-white/30" />
            </div>

            <div className="mt-4 text-xs text-white/50">
              Hang tight — we’re pulling top-rated spots and routing your day.
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <PropertyBadge slug={cfg.slug} />
            <h1 className="text-2xl font-bold">Your Itinerary</h1>
            <p className="text-sm text-white/70">
              Built from live Google ratings + a concierge-style plan tailored to your vibe and budget.
            </p>
          </div>

          <div className="flex gap-2">
            <Button href={`/p/${cfg.slug}/itinerary`} variant="secondary">
              Edit
            </Button>
            <Button href={`/p/${cfg.slug}`} variant="primary">
              Home
            </Button>
          </div>
        </div>
      </div>

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

      {/* ✅ No inline loading card anymore — overlay handles loading */}
      {error ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6">
          <div className="text-sm font-semibold text-white">Couldn’t generate itinerary</div>
          <div className="mt-2 text-sm text-white/70">{error}</div>
          <div className="mt-4">
            <Button
              variant="primary"
              onClick={() => {
                trackEvent(cfg.slug, "itinerary_retry_click", {});
                window.location.reload();
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : itinerary ? (
          <>
  <div
    ref={resultsRef}
    className="rounded-3xl border border-white/10 bg-white/5 p-6"
  >
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
                          onClick={() =>
                            trackEvent(cfg.slug, "itinerary_maps_click", {
                              id: b.id,
                              placeId: b.primary?.placeId || "",
                            })
                          }
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

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Optional upgrades</h2>
            <p className="mt-1 text-sm text-white/70">
              If you want to make the stay easier, request these below.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85 hover:bg-white/10"
                href={`/p/${cfg.slug}/request?type=early_checkin`}
              >
                Early Check-In
              </Link>
              <Link
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85 hover:bg-white/10"
                href={`/p/${cfg.slug}/request?type=late_checkout`}
              >
                Late Check-Out
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}