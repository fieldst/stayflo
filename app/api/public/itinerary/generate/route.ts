import { NextResponse } from "next/server";
import { getPropertyConfig } from "@/lib/property";
import type { ItineraryPrefs, GeneratedItinerary } from "@/lib/itinerary/types";
import { buildItineraryBlocks } from "@/lib/itinerary/planner";
import { addAiNarrative } from "@/lib/itinerary/openai";
import { estimateTravelBetweenPlaceIds } from "@/lib/itinerary/travel";

export const runtime = "nodejs";

type Body = {
  property: string;
  duration: string;
  pace: string;
  transport: string;
  budget: string;
  vibes: string[];
  notes?: string;

  // ✅ new
  planDay?: string;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function asEnum<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest("Invalid JSON");
  }

  const propertySlug = String(body.property || "");
  const cfg = getPropertyConfig(propertySlug);
  if (!cfg) return badRequest("Unknown property");

  const duration = asEnum(body.duration, ["half_day", "full_day", "two_days"] as const);
  const pace = asEnum(body.pace, ["chill", "balanced", "packed"] as const);
  const transport = asEnum(body.transport, ["walk", "drive", "bike"] as const);
  const budget = asEnum(body.budget, ["$", "$$", "$$$", "$$$$"] as const);
  const planDay = asEnum(body.planDay || "today", ["today", "tomorrow", "now"] as const);
  if (!planDay) return badRequest("Missing or invalid planDay");

  if (!duration || !pace || !transport || !budget) {
    return badRequest("Missing or invalid inputs");
  }

  const vibes = Array.isArray(body.vibes) ? body.vibes.map(String).filter(Boolean).slice(0, 6) : [];
  if (!vibes.length) return badRequest("Pick at least one vibe");

  const prefs: ItineraryPrefs = {
    propertySlug: cfg.slug,
    city: `${cfg.city}, TX`,
    duration,
    pace,
    transport,
    budget,
    vibes,
    notes: body.notes ? String(body.notes).slice(0, 280) : undefined,
    planDay,
  };

  try {
    const rawBlocks = await buildItineraryBlocks(prefs);

    const ai = await addAiNarrative({
      city: prefs.city,
      prefs,
      blocks: rawBlocks,
    });

    // ✅ Add travel-time tips between consecutive primary stops (best-effort).
    const enrichedBlocks = [...ai.blocks];
    const mode =
      prefs.transport === "walk" ? "walking" : prefs.transport === "bike" ? "bicycling" : "driving";

    for (let i = 1; i < enrichedBlocks.length; i++) {
      const prev = enrichedBlocks[i - 1];
      const cur = enrichedBlocks[i];
      const prevId = prev?.primary?.placeId;
      const curId = cur?.primary?.placeId;
      if (!prevId || !curId) continue;

      try {
        const est = await estimateTravelBetweenPlaceIds({
          originPlaceId: prevId,
          destPlaceId: curId,
          mode,
        });

        if (!est) continue;

        const tip = `Travel from last stop: ~${est.durationText}${
          est.distanceText ? ` (${est.distanceText})` : ""
        }.`;

        const tips = Array.isArray(cur.tips) ? [...cur.tips] : [];
        const nextTips = [tip, ...tips.filter((t) => t !== tip)].slice(0, 3);
        enrichedBlocks[i] = { ...cur, tips: nextTips };
      } catch {
        // ignore (best-effort)
      }
    }

    const out: GeneratedItinerary = {
      version: 1,
      city: prefs.city,
      generatedAt: new Date().toISOString(),
      prefs: {
        propertySlug: prefs.propertySlug,
        duration: prefs.duration,
        pace: prefs.pace,
        transport: prefs.transport,
        budget: prefs.budget,
        vibes: prefs.vibes,
        notes: prefs.notes,
        planDay: prefs.planDay,
      },
      headline: ai.headline,
      overview: ai.overview,
      blocks: enrichedBlocks,
      generalTips: ai.generalTips,
      disclaimers: ai.disclaimers,
    };

    return NextResponse.json({ ok: true, itinerary: out }, { status: 200 });
  } catch (e: unknown) {
    const msg =
      typeof (e as any)?.message === "string"
        ? (e as any).message
        : "Failed to generate itinerary";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}