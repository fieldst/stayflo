import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  city: string; // "San Antonio, TX"
  prefs: {
    duration: "half_day" | "full_day" | "two_days";
    pace: "chill" | "balanced" | "packed";
    transport: "walk" | "drive" | "bike";
    budget: "$" | "$$" | "$$$" | "$$$$";
    vibes: string[];
    notes?: string;
  };
  block: {
    id: string;
    title: string; // "Lunch"
    category:
      | "coffee"
      | "breakfast"
      | "lunch"
      | "dinner"
      | "attraction"
      | "shopping"
      | "outdoors"
      | "nightlife"
      | "relax";
    timeLabel: string; // "2:30 PM"
  };
  place: {
    placeId: string;
    name: string;
    rating?: number;
    userRatingsTotal?: number;
    priceLevel?: number;
    address?: string;
    googleMapsUri?: string;
  };
};

type OpenAIJson = Record<string, unknown>;

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const apiKey = assertEnv("OPENAI_API_KEY");
    const model = process.env.OPENAI_ITINERARY_MODEL || "gpt-4.1-mini";

    const schema: OpenAIJson = {
      type: "object",
      additionalProperties: false,
      required: ["whyThis", "tips"],
      properties: {
        whyThis: { type: "string" },
        tips: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 3 },
      },
    };

    const system = [
      "You are a premium hotel concierge for San Antonio, TX.",
      "Write practical guidance for a guest itinerary.",
      "Use only the provided place info (name, rating, review count, price).",
      "Do NOT invent facts like hours, menus, or distances.",
      "Keep 'whyThis' to 1–2 sentences. Tips: up to 3 short bullets.",
      "Tone: warm, direct, usable. No emojis.",
    ].join(" ");

    const place = body.place;
    const rating = typeof place.rating === "number" ? place.rating.toFixed(1) : "—";
    const reviews =
      typeof place.userRatingsTotal === "number" ? place.userRatingsTotal.toLocaleString() : "0";
    const price =
      typeof place.priceLevel === "number" ? "$".repeat(Math.min(Math.max(place.priceLevel, 1), 4)) : "";

    const data = {
      city: body.city,
      prefs: body.prefs,
      block: body.block,
      place: {
        name: place.name,
        rating,
        reviews,
        price,
        address: place.address || "",
      },
    };

    const payload: OpenAIJson = {
      model,
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            "Generate whyThis + tips for the place in this itinerary block.\n\nDATA:\n" +
            JSON.stringify(data),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          strict: true,
          name: "itinerary_block_narrative",
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
      return NextResponse.json(
        { ok: false, error: `OpenAI failed: ${res.status} ${res.statusText} ${txt}`.slice(0, 300) },
        { status: 500 }
      );
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
              if (typeof t === "string") return t;
            }
          }
        }
      }
      if (typeof json.text === "string") return json.text;
      return "";
    })();

    if (!outputText) {
      return NextResponse.json({ ok: false, error: "OpenAI returned empty output" }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return NextResponse.json({ ok: false, error: "OpenAI returned invalid JSON" }, { status: 500 });
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid AI response" }, { status: 500 });
    }
    if (!isString(parsed.whyThis) || !isStringArray(parsed.tips)) {
      return NextResponse.json({ ok: false, error: "AI response missing fields" }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, whyThis: parsed.whyThis, tips: parsed.tips },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: typeof e?.message === "string" ? e.message : "Failed to narrate" },
      { status: 500 }
    );
  }
}
