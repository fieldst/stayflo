import type { ItineraryPrefs, ItineraryBlock, GeneratedItinerary, PlaceCandidate } from "./types";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

type OpenAIJson = Record<string, unknown>;

function isString(x: unknown): x is string {
  return typeof x === "string";
}
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

function safePickPlaceSummary(p: PlaceCandidate | null): string {
  if (!p) return "No match found";
  const r = typeof p.rating === "number" ? p.rating.toFixed(1) : "—";
  const n = typeof p.userRatingsTotal === "number" ? p.userRatingsTotal : 0;
  return `${p.name} (rating ${r}, ${n} reviews)`;
}

export async function addAiNarrative(args: {
  city: string;
  prefs: ItineraryPrefs;
  blocks: Array<Pick<ItineraryBlock, "id" | "timeLabel" | "title" | "category" | "primary" | "alternates">>;
}): Promise<Pick<GeneratedItinerary, "headline" | "overview" | "blocks" | "generalTips" | "disclaimers">> {
  const apiKey = assertEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_ITINERARY_MODEL || "gpt-4.1-mini";

  const schema: OpenAIJson = {
    type: "object",
    additionalProperties: false,
    required: ["headline", "overview", "blocks", "generalTips", "disclaimers"],
    properties: {
      headline: { type: "string" },
      overview: { type: "string" },
      generalTips: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
      disclaimers: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
      blocks: {
        type: "array",
        minItems: 3,
        maxItems: 14,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "whyThis", "tips"],
          properties: {
            id: { type: "string" },
            whyThis: { type: "string" },
            tips: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 3 },
          },
        },
      },
    },
  };

  const system = [
    "You are a hotel-concierge-style itinerary writer for San Antonio, TX.",
    "Write practical, helpful guidance. No fluff. Keep it easy to act on.",
    "Use the provided places (with ratings + review counts) as your grounding.",
    "Do NOT invent ratings, addresses, or place names that aren't provided.",
    "If a block has no primary place, be honest and give a general suggestion.",
    "Treat guest notes as constraints. If notes say ‘no coffee’, do not suggest coffee. If notes mention BBQ or ice cream, explicitly incorporate them.",
  ].join(" ");

  const user = {
    city: args.city,
    prefs: {
      duration: args.prefs.duration,
      pace: args.prefs.pace,
      transport: args.prefs.transport,
      budget: args.prefs.budget,
      vibes: args.prefs.vibes,
      notes: args.prefs.notes || "",
    },
    blocks: args.blocks.map((b) => ({
      id: b.id,
      timeLabel: b.timeLabel,
      title: b.title,
      category: b.category,
      primary: safePickPlaceSummary(b.primary),
      alternates: b.alternates.slice(0, 3).map((p) => safePickPlaceSummary(p)),
    })),
  };

  const prompt = [
    "Create a concise headline and overview for the itinerary.",
    "For each block id, write:",
    "- whyThis: 1–2 sentences that explain why it matches the guest's vibe/budget/pace",
    "- tips: up to 3 short bullets with practical guidance (parking, best time, what to order, etc.)",
    "Also provide 2–8 generalTips and 1–6 disclaimers (e.g., hours change, double-check holiday closures).",
    "Tone: warm, premium concierge. Short sentences. No emojis in narrative (the UI will handle emojis).",
  ].join("\n");

  const payload: OpenAIJson = {
    model,
    input: [
      { role: "system", content: system },
      { role: "user", content: `${prompt}\n\nDATA:\n${JSON.stringify(user)}` },
    ],
    text: {
      format: {
        type: "json_schema",
        strict: true,
        name: "itinerary_narrative",
        schema,
      },
    },
  };

  const res = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed: ${res.status} ${res.statusText} ${txt}`.slice(0, 500));
  }

  const json = (await res.json()) as any;

  const outputText = (() => {
    const out = json.output;
    if (Array.isArray(out)) {
      for (const item of out) {
        const content = item?.content;
        if (Array.isArray(content)) {
          for (const c of content) {
            const t = c?.text;
            if (isString(t)) return t;
          }
        }
      }
    }
    if (isString(json.text)) return json.text;
    return "";
  })();

  if (!outputText) throw new Error("OpenAI returned empty output");

  let parsed: any;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("OpenAI output was not valid JSON");
  }

  if (!parsed || typeof parsed !== "object") throw new Error("Invalid AI payload");
  if (!isString(parsed.headline) || !isString(parsed.overview)) throw new Error("Invalid AI headline/overview");
  if (!Array.isArray(parsed.blocks)) throw new Error("Invalid AI blocks");
  if (!isStringArray(parsed.generalTips) || !isStringArray(parsed.disclaimers)) throw new Error("Invalid AI tips");

  const byId = new Map<string, { whyThis: string; tips: string[] }>();
  for (const b of parsed.blocks) {
    if (!b || typeof b !== "object") continue;
    const id = (b as any).id;
    const whyThis = (b as any).whyThis;
    const tips = (b as any).tips;
    if (isString(id) && isString(whyThis) && isStringArray(tips)) {
      byId.set(id, { whyThis, tips });
    }
  }

  const blocks: ItineraryBlock[] = args.blocks.map((b) => {
    const ai = byId.get(b.id);
    return {
      id: b.id,
      timeLabel: b.timeLabel,
      title: b.title,
      category: b.category,
      primary: b.primary ?? null,
      alternates: b.alternates ?? [],
      whyThis: ai?.whyThis ?? "Hand-picked based on top ratings and your preferences.",
      tips: ai?.tips ?? [],
    };
  });

  return {
    headline: parsed.headline,
    overview: parsed.overview,
    blocks,
    generalTips: parsed.generalTips,
    disclaimers: parsed.disclaimers,
  };
}
