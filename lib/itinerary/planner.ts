import type { ItineraryPrefs, ItineraryBlock, PlaceCandidate } from "./types";
import { searchPlacesText } from "./places";
import { distanceKm } from "./travel";

const TZ = "America/Chicago";

type YMD = { year: number; month: number; day: number };

function getPartsInTz(d: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const year = parseInt(get("year") || "1970", 10);
  const month = parseInt(get("month") || "01", 10);
  const day = parseInt(get("day") || "01", 10);
  const hour = parseInt(get("hour") || "00", 10);
  const minute = parseInt(get("minute") || "00", 10);
  return { year, month, day, hour, minute };
}

function getLocalYmdInTz(d: Date): YMD {
  const p = getPartsInTz(d);
  return { year: p.year, month: p.month, day: p.day };
}

function addLocalDays(base: YMD, days: number): YMD {
  // Use a UTC noon anchor so DST edges are less likely to bite.
  const anchor = new Date(Date.UTC(base.year, base.month - 1, base.day, 12, 0, 0));
  const shifted = new Date(anchor.getTime() + days * 24 * 60 * 60_000);
  return getLocalYmdInTz(shifted);
}

function zonedTimeToUtc(args: { ymd: YMD; hour: number; minute: number }): Date {
  const { ymd, hour, minute } = args;

  // Initial guess: treat the provided local time as if it were UTC.
  const guess = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, hour, minute, 0));
  // What local time does that guess actually map to in our TZ?
  const rendered = getPartsInTz(guess);

  const renderedMs = Date.UTC(rendered.year, rendered.month - 1, rendered.day, rendered.hour, rendered.minute, 0);
  const targetMs = Date.UTC(ymd.year, ymd.month - 1, ymd.day, hour, minute, 0);

  // Adjust guess back by the difference between what we rendered and what we wanted.
  const diffMs = renderedMs - targetMs;
  return new Date(guess.getTime() - diffMs);
}

function parseStartTimeHHMM(s: string | undefined): { hour: number; minute: number } | null {
  const raw = (s || "").trim();
  if (!raw) return null;
  const m = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  return { hour, minute };
}

function resolveStartUtc(p: ItineraryPrefs): Date {
  const now = nowUtc();
  if (p.planDay === "now") return now;

  const ymdToday = getLocalYmdInTz(now);
  const ymd = p.planDay === "tomorrow" ? addLocalDays(ymdToday, 1) : ymdToday;

  const parsed = parseStartTimeHHMM(p.startTime);
  if (!parsed) {
    // Keep existing behavior if no explicit start time was provided
    return p.planDay === "tomorrow" ? zonedTimeToUtc({ ymd, hour: 9, minute: 0 }) : now;
  }

  const chosen = zonedTimeToUtc({ ymd, hour: parsed.hour, minute: parsed.minute });
  // If "today" + chosen is in the past, clamp to now so labels don't start behind the user.
  if (p.planDay === "today" && chosen.getTime() < now.getTime()) return now;
  return chosen;
}

/**
 * We stay within the Places API limit:
 * circle.radius must be <= 50,000
 *
 * To cover "outskirts", we use multiple centers (still <= 50k each).
 */
type Bias = { lat: number; lng: number; radiusMeters: number; key: string };

const BIASES: Bias[] = [
  { key: "downtown", lat: 29.4241, lng: -98.4936, radiusMeters: 50_000 },
  { key: "rim", lat: 29.6027, lng: -98.6153, radiusMeters: 35_000 }, // La Cantera / The Rim
  { key: "stone_oak", lat: 29.6499, lng: -98.473, radiusMeters: 35_000 },
  { key: "boerne", lat: 29.7947, lng: -98.7319, radiusMeters: 35_000 },
  { key: "new_braunfels", lat: 29.703, lng: -98.1245, radiusMeters: 35_000 },
  { key: "schertz", lat: 29.5522, lng: -98.2697, radiusMeters: 35_000 },
];

function nowUtc(): Date {
  return new Date();
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function chicagoHour(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hr = parts.find((p) => p.type === "hour")?.value;
  return hr ? clamp(parseInt(hr, 10), 0, 23) : 12;
}

function formatTimeLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatDayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(d);
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

// "Tomorrow 9am" approximation in UTC that labels correctly in Chicago.
function tomorrowAt9amUtc(now: Date): Date {
  const tomorrow = addMinutes(now, 24 * 60);
  const hr = chicagoHour(tomorrow);
  const deltaHours = 9 - hr;
  return addMinutes(tomorrow, deltaHours * 60);
}

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type NoteSignals = {
  noCoffee: boolean;
  wantsBbq: boolean;
  wantsIceCream: boolean;
  kidFriendly: boolean;

  // Structured intent
  cuisines: string[];
  nightlife: string[];
  activities: string[];
  includeKeywords: string[];
  avoidKeywords: string[];
  areaHints: string[];
};

const CUISINE_TERMS = [
  "bbq",
  "barbecue",
  "brisket",
  "ribs",
  "mediterranean",
  "greek",
  "turkish",
  "lebanese",
  "middle eastern",
  "mexican",
  "tex mex",
  "tacos",
  "italian",
  "pizza",
  "sushi",
  "japanese",
  "ramen",
  "korean",
  "thai",
  "vietnamese",
  "pho",
  "indian",
  "pakistani",
  "caribbean",
  "cuban",
  "seafood",
  "steakhouse",
  "vegan",
  "vegetarian",
  "gluten free",
  "halal",
] as const;

const NIGHTLIFE_TERMS = [
  "speakeasy",
  "cocktail",
  "cocktail bar",
  "rooftop",
  "rooftop bar",
  "brewery",
  "taproom",
  "wine bar",
  "sports bar",
  "dive bar",
  "live music",
  "jazz",
  "karaoke",
] as const;

const ACTIVITY_TERMS = [
  "museum",
  "art",
  "history",
  "market",
  "farmers market",
  "shopping",
  "boutiques",
  "hike",
  "trail",
  "river walk",
  "scenic",
] as const;

function uniqLimit(arr: string[], n: number) {
  return Array.from(new Set(arr)).slice(0, n);
}

function extractPhrases(notes: string): string[] {
  // Keep simple: build 2-word phrases (bigrams) from the notes.
  const words = notes.split(" ").filter(Boolean);
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i];
    const b = words[i + 1];
    if (!a || !b) continue;
    if (a.length < 3 || b.length < 3) continue;
    phrases.push(`${a} ${b}`);
  }
  return phrases;
}

function matchTerms(text: string, terms: readonly string[]): string[] {
  const hits: string[] = [];
  for (const t of terms) {
    const re = new RegExp(`\\b${t.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (re.test(text)) hits.push(t.toLowerCase());
  }
  return hits;
}

function extractSignals(notesRaw: string | undefined, vibes: string[]): NoteSignals {
  const notes = normalize(notesRaw || "");
  const vibeText = normalize(vibes.join(" "));

  const noCoffee =
    /\b(no coffee|dont like coffee|don't like coffee|hate coffee|avoid coffee|no caffeine)\b/.test(notes);

  const wantsBbq = /\b(bbq|barbecue|brisket|ribs|smoked)\b/.test(notes) || /\bbbq\b/.test(vibeText);

  const wantsIceCream = /\b(ice cream|gelato|frozen custard|milkshake)\b/.test(notes);

  const kidFriendly =
    /\b(kids|kid|children|family|toddler|stroller)\b/.test(notes) || /\bfamily\b/.test(vibeText);

  // Detect “avoid X” constraints (negative keywords)
  const avoidMatches = Array.from(
    notes.matchAll(/\b(?:avoid|no|skip|not into|dont want|don't want|do not want)\s+([a-z]{3,18})\b/g)
  ).map((m) => m[1]);

  const avoidKeywords = Array.from(new Set(avoidMatches)).slice(0, 6);

  // Pull useful keywords + phrases from notes to steer search (dynamic)
  const stop = new Set([
    "i",
    "we",
    "my",
    "me",
    "our",
    "us",
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "to",
    "of",
    "for",
    "with",
    "on",
    "in",
    "like",
    "love",
    "want",
    "dont",
    "don't",
    "no",
    "avoid",
    "please",
    "prefer",
    "really",
    "very",
    "not",
    "into",
    "something",
    "anything",
    "should",
    "know",
    "do",
    "does",
    "did",
    "be",
    "is",
    "are",
    "was",
    "were",
    "it",
    "this",
    "that",
  ]);

  const singleWords = notes
    .split(" ")
    .filter(Boolean)
    .filter((w) => w.length >= 3 && w.length <= 22)
    .filter((w) => !stop.has(w));

  const phrases = extractPhrases(notes).filter((p) => {
    const parts = p.split(" ");
    if (parts.some((w) => stop.has(w))) return false;
    return p.length >= 7 && p.length <= 30;
  });

  // Recognize “category” terms explicitly
  const cuisines = uniqLimit(matchTerms(notes, CUISINE_TERMS), 6);
  const nightlife = uniqLimit(matchTerms(notes, NIGHTLIFE_TERMS), 5);
  const activities = uniqLimit(matchTerms(notes, ACTIVITY_TERMS), 5);

  // Include category matches + best words/phrases as boost keywords
  const includeKeywords = uniqLimit([...cuisines, ...nightlife, ...activities, ...phrases, ...singleWords], 12);

  // Area hints (lightweight, prevents overfitting)
  const areaHints: string[] = [];
  const areaMap: Array<[RegExp, string]> = [
    [/\bpearl\b/, "Pearl"],
    [/\bsouthtown\b/, "Southtown"],
    [/\bking william\b/, "King William"],
    [/\briver walk\b|\briverwalk\b/, "River Walk"],
    [/\balamo heights\b/, "Alamo Heights"],
    [/\bla cantera\b|\bthe rim\b/, "La Cantera"],
  ];

  for (const [re, label] of areaMap) {
    if (re.test(notes)) areaHints.push(label);
  }

  return {
    noCoffee,
    wantsBbq,
    wantsIceCream,
    kidFriendly,
    cuisines,
    nightlife,
    activities,
    includeKeywords,
    avoidKeywords,
    areaHints: areaHints.slice(0, 3),
  };
}

type SlotTemplate = {
  id: string;
  title: string;
  category: ItineraryBlock["category"];
  queries: string[];
  startAt: Date;
  requireOpenNow: boolean;
};

function budgetToHint(budget: ItineraryPrefs["budget"]): string {
  switch (budget) {
    case "$":
      return "budget-friendly";
    case "$$":
      return "mid-priced";
    case "$$$":
      return "upscale";
    case "$$$$":
      return "fine dining";
  }
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rotate<T>(arr: T[], offset: number): T[] {
  if (!arr.length) return arr;
  const o = ((offset % arr.length) + arr.length) % arr.length;
  return [...arr.slice(o), ...arr.slice(0, o)];
}

function dedupeByPlaceId(items: PlaceCandidate[]): PlaceCandidate[] {
  const seen = new Set<string>();
  const out: PlaceCandidate[] = [];
  for (const it of items) {
    if (seen.has(it.placeId)) continue;
    seen.add(it.placeId);
    out.push(it);
  }
  return out;
}

function pickPrimaryAvoidingUsed(candidates: PlaceCandidate[], used: Set<string>): PlaceCandidate | null {
  for (const c of candidates) {
    if (!used.has(c.placeId)) return c;
  }
  return candidates[0] ?? null;
}

function isSoon(now: Date, slotTime: Date): boolean {
  const diffMin = (slotTime.getTime() - now.getTime()) / 60_000;
  return diffMin >= -30 && diffMin <= 180;
}

/**
 * “Type diversity” key (prevents donut->donut->donut or coffee->coffee).
 * Places types are Google types like "cafe", "bakery", "restaurant", etc.
 */
function typeKey(p: PlaceCandidate): string {
  const t0 = Array.isArray(p.types) && p.types.length ? String(p.types[0]) : "";
  return t0.toLowerCase();
}

/**
 * Choose multiple search centers (Downtown + 1 rotated outskirts) to increase variety
 * without breaking the radius limits.
 */
function pickBiases(prefs: ItineraryPrefs, slotId: string): Bias[] {
  // If we're in public concierge mode, bias around the user's location
  if (prefs.origin) {
    const { lat, lng } = prefs.origin;

    // Keep within Places API radius limit (<= 50,000)
    const base: Bias = { key: "origin", lat, lng, radiusMeters: 50_000 };

    // Add a small “secondary” bias a bit away to increase variety (still same radius)
    const seed = hashString(
      `${slotId}|${prefs.duration}|${prefs.pace}|${prefs.budget}|${prefs.transport}|${prefs.vibes.join(",")}|${
        prefs.notes || ""
      }|${new Date().toISOString().slice(0, 13)}`
    );

    const offsets = [
      { dLat: 0.08, dLng: 0.0 },
      { dLat: -0.08, dLng: 0.0 },
      { dLat: 0.0, dLng: 0.08 },
      { dLat: 0.0, dLng: -0.08 },
    ];

    const pick = offsets[seed % offsets.length];
    const secondary: Bias = {
      key: "origin_secondary",
      lat: lat + pick.dLat,
      lng: lng + pick.dLng,
      radiusMeters: 50_000,
    };

    return [base, secondary];
  }

  // Default (property mode): multi-bias logic
  const seed = hashString(
    `${slotId}|${prefs.duration}|${prefs.pace}|${prefs.budget}|${prefs.transport}|${prefs.vibes.join(",")}|${
      prefs.notes || ""
    }|${new Date().toISOString().slice(0, 13)}`
  );

  const outskirts = BIASES.filter((b) => b.key !== "downtown");
  const rotated = rotate(outskirts, seed % outskirts.length);
  return [BIASES[0], rotated[0]];
}

/**
 * Rotate candidate list slightly so we don’t always select the same “famous top 1”
 * for generic queries.
 */
function varietyRotate(candidates: PlaceCandidate[], prefs: ItineraryPrefs, slotId: string): PlaceCandidate[] {
  const seed = hashString(
    `${slotId}|${prefs.duration}|${prefs.pace}|${prefs.budget}|${prefs.transport}|${prefs.vibes.join(",")}|${
      prefs.notes || ""
    }|${new Date().toISOString().slice(0, 13)}`
  );
  const offset = candidates.length ? seed % Math.min(candidates.length, 6) : 0;
  return rotate(candidates, offset);
}

function buildSlots(p: ItineraryPrefs): SlotTemplate[] {
  const cityQ = p.city && p.city !== "Near you" ? p.city : "near me";
  const budgetHint = budgetToHint(p.budget);
  const signals = extractSignals(p.notes, p.vibes);
  const gapMin = p.pace === "packed" ? 90 : p.pace === "chill" ? 150 : 120;

  const baseRequireOpenNow = true;
  const hour = chicagoHour(nowUtc());
  const late = hour >= 20; // 8PM+

  // RIGHT NOW / SPONTANEOUS MODE (self-contained)
  if (p.planDay === "now") {
    const t0 = nowUtc();

    const budgetHintNow = budgetToHint(p.budget);
    const signalsNow = extractSignals(p.notes, p.vibes);

    const localFlavorNow = signalsNow.kidFriendly ? "family friendly local favorite" : "local favorite";
    const hiddenGemNow = "hidden gem locals love";

    const noteBoostRawNow = [...signalsNow.areaHints, ...signalsNow.includeKeywords].slice(0, 8);
    const noteBoostNow = noteBoostRawNow.length ? `(${noteBoostRawNow.join(", ")})` : "";
    const avoidTextNow = signalsNow.avoidKeywords.length ? ` -${signalsNow.avoidKeywords.join(" -")}` : "";

    const gapMinNow = p.pace === "packed" ? 90 : p.pace === "chill" ? 150 : 120;

    const quickStartQueries = signalsNow.noCoffee
      ? [
          `best quick bite ${cityQ} open now ${budgetHintNow} ${localFlavorNow} ${noteBoostNow}${avoidTextNow}`,
          `bakery ${cityQ} open now ${hiddenGemNow} ${noteBoostNow}${avoidTextNow}`,
          `tacos ${cityQ} open now ${localFlavorNow} ${noteBoostNow}${avoidTextNow}`,
        ]
      : [
          `coffee shop ${cityQ} open now ${hiddenGemNow} ${noteBoostNow}${avoidTextNow}`,
          `best cafe ${cityQ} open now ${localFlavorNow} ${noteBoostNow}${avoidTextNow}`,
          `quick bite ${cityQ} open now ${budgetHintNow} ${localFlavorNow} ${noteBoostNow}${avoidTextNow}`,
        ];

    const doSomethingQueries = signalsNow.kidFriendly
      ? [
          `family friendly attraction ${cityQ} open now ${localFlavorNow} ${noteBoostNow}${avoidTextNow}`,
          `kids activity ${cityQ} open now ${hiddenGemNow} ${noteBoostNow}${avoidTextNow}`,
          `ice cream ${cityQ} open now ${hiddenGemNow} ${noteBoostNow}${avoidTextNow}`,
        ]
      : [
          `top attraction ${cityQ} open now ${hiddenGemNow} ${noteBoostNow}${avoidTextNow}`,
          `local gem ${cityQ} open now ${localFlavorNow} ${noteBoostNow}${avoidTextNow}`,
          `fun thing to do ${cityQ} open now ${hiddenGemNow} ${noteBoostNow}${avoidTextNow}`,
        ];

    const wrapUpQueries = signalsNow.wantsIceCream
      ? [
          `ice cream ${cityQ} open now ${hiddenGemNow} ${noteBoostNow}${avoidTextNow}`,
          `dessert ${cityQ} open now ${localFlavorNow} ${noteBoostNow}${avoidTextNow}`,
          `scenic walk ${cityQ} open now ${hiddenGemNow} ${noteBoostNow}${avoidTextNow}`,
        ]
      : [
          `dessert ${cityQ} open now ${hiddenGemNow} ${noteBoostNow}${avoidTextNow}`,
          `scenic walk ${cityQ} open now ${localFlavorNow} ${noteBoostNow}${avoidTextNow}`,
          `chill bar ${cityQ} open now ${hiddenGemNow} ${noteBoostNow}${avoidTextNow}`,
        ];

    return [
      {
        id: "now_1",
        startAt: t0,
        title: "Do this next (open now)",
        category: "attraction",
        requireOpenNow: true,
        queries: doSomethingQueries,
      },
      {
        id: "now_2",
        startAt: addMinutes(t0, gapMinNow),
        title: "Grab something nearby (open now)",
        category: "lunch",
        requireOpenNow: true,
        queries: quickStartQueries,
      },
      {
        id: "now_3",
        startAt: addMinutes(t0, gapMinNow * 2),
        title: "One last stop (if you’re feeling it)",
        category: "relax",
        requireOpenNow: true,
        queries: wrapUpQueries,
      },
    ];
  }

  // UI choice wins over notes
  const goTonight = p.planDay === "today" && late;

  // Start time based on planDay + startTime
  const start = resolveStartUtc(p);

  const localFlavor = signals.kidFriendly ? "family friendly local favorite" : "local favorite";
  const hiddenGem = "hidden gem locals love";

  const noteBoostRaw = [...signals.areaHints, ...signals.includeKeywords].slice(0, 8);
  const noteBoost = noteBoostRaw.length ? `(${noteBoostRaw.join(", ")})` : "";
  const avoidText = signals.avoidKeywords.length ? ` -${signals.avoidKeywords.join(" -")}` : "";

  // NIGHT MODE (late today)
  if (goTonight) {
    const t0 = start;
    const dessertQueries = signals.wantsIceCream
      ? [
          `ice cream ${cityQ} open late ${localFlavor} ${noteBoost}${avoidText}`,
          `gelato ${cityQ} open late ${hiddenGem} ${noteBoost}${avoidText}`,
          `late night dessert ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
        ]
      : [
          `late night dessert ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
          `late night tacos ${cityQ} ${localFlavor} ${noteBoost}${avoidText}`,
          `open late food ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
        ];

    return [
      {
        id: "night_1",
        startAt: t0,
        title: signals.wantsIceCream ? "Ice cream / dessert (open late)" : "Night bite / dessert",
        category: "relax",
        requireOpenNow: baseRequireOpenNow,
        queries: dessertQueries,
      },
      {
        id: "night_2",
        startAt: addMinutes(t0, gapMin),
        title: "Night activity (open now)",
        category: "nightlife",
        requireOpenNow: baseRequireOpenNow,
        queries: signals.kidFriendly
          ? [
              `evening walk ${cityQ} scenic ${localFlavor} ${noteBoost}${avoidText}`,
              `family friendly evening ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
            ]
          : [
              ...(signals.nightlife.length
                ? signals.nightlife
                    .slice(0, 2)
                    .map((t) => `${t} ${cityQ} open late ${hiddenGem} ${noteBoost}${avoidText}`)
                : []),
              `live music ${cityQ} tonight ${localFlavor} ${noteBoost}${avoidText}`,
              `cocktail bar ${cityQ} open late ${hiddenGem} ${noteBoost}${avoidText}`,
              `nightlife ${cityQ} popular ${localFlavor} ${noteBoost}${avoidText}`,
            ],
      },
    ];
  }

  // DAY MODE
  const t0 = start;

  const morningQueries = signals.noCoffee
    ? [
        `best breakfast ${cityQ} ${budgetHint} ${localFlavor} ${noteBoost}${avoidText}`,
        `breakfast tacos ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
        `bakery ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
      ]
    : [
        `best breakfast ${cityQ} ${budgetHint} ${localFlavor} ${noteBoost}${avoidText}`,
        `coffee and pastries ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
        `cafe ${cityQ} ${localFlavor} ${noteBoost}${avoidText}`,
      ];

  const lunchQueries = signals.wantsBbq
    ? [
        `best bbq ${cityQ} brisket ribs ${localFlavor} ${noteBoost}${avoidText}`,
        `bbq near ${cityQ} smoked meats ${hiddenGem} ${noteBoost}${avoidText}`,
      ]
    : [
        `best lunch ${cityQ} ${budgetHint} ${localFlavor} ${noteBoost}${avoidText}`,
        `local lunch ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
      ];

  const baseHalfDay: SlotTemplate[] = [
    {
      id: "morning",
      startAt: t0,
      title: signals.noCoffee ? "Breakfast / morning bite" : "Breakfast / coffee (your choice)",
      category: "breakfast",
      requireOpenNow: false,
      queries: morningQueries,
    },
    {
      id: "thing",
      startAt: addMinutes(t0, gapMin),
      title: "Top thing to do",
      category: "attraction",
      requireOpenNow: false,
      queries: [
        ...(signals.activities.length ? signals.activities.slice(0, 2).map((t) => `${t} ${cityQ} ${noteBoost}${avoidText}`) : []),
        `top attractions ${cityQ} ${localFlavor} ${noteBoost}${avoidText}`,
        `things to do ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
        `best museums ${cityQ} ${localFlavor} ${noteBoost}${avoidText}`,
      ],
    },
    {
      id: "lunch",
      startAt: addMinutes(t0, gapMin * 2),
      title: signals.wantsBbq ? "Lunch (BBQ)" : "Lunch",
      category: "lunch",
      requireOpenNow: false,
      queries: lunchQueries,
    },
  ];

  const cuisineHint = signals.cuisines.length ? signals.cuisines.slice(0, 2).join(" ") : "";

  const baseFullDay: SlotTemplate[] = [
    ...baseHalfDay,
    {
      id: "aft",
      startAt: addMinutes(t0, gapMin * 3),
      title: "Explore a neighborhood / shops",
      category: "shopping",
      requireOpenNow: false,
      queries: [
        `best neighborhoods to explore ${cityQ} ${localFlavor} ${noteBoost}${avoidText}`,
        `boutiques ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
        `${cityQ} market square local ${noteBoost}${avoidText}`,
      ],
    },
    {
      id: "dinner",
      startAt: addMinutes(t0, gapMin * 4),
      title: "Dinner",
      category: "dinner",
      requireOpenNow: false,
      queries: [
        `best ${cuisineHint ? cuisineHint + " " : ""}dinner ${cityQ} ${budgetHint} ${localFlavor} ${noteBoost}${avoidText}`,
        `local ${cuisineHint ? cuisineHint + " " : ""}dinner ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
      ],
    },
    {
      id: "eve",
      startAt: addMinutes(t0, gapMin * 5),
      title: "Evening option",
      category: "nightlife",
      requireOpenNow: false,
      queries: signals.kidFriendly
        ? [
            `evening walk ${cityQ} scenic ${localFlavor} ${noteBoost}${avoidText}`,
            `family friendly evening ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
          ]
        : [
            ...(signals.nightlife.length
              ? signals.nightlife.slice(0, 2).map((t) => `${t} ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`)
              : []),
            `cocktail bars ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
            `live music ${cityQ} ${localFlavor} ${noteBoost}${avoidText}`,
          ],
    },
  ];

  // Treat stop if kids or ice cream requested (practical)
  const includeTreat = signals.kidFriendly || signals.wantsIceCream;
  const treatSlot: SlotTemplate = {
    id: "treat",
    startAt: addMinutes(t0, gapMin * 3),
    title: signals.wantsIceCream ? "Ice cream / treat stop" : "Treat stop",
    category: "relax",
    requireOpenNow: false,
    queries: signals.wantsIceCream
      ? [
          `best ice cream ${cityQ} ${localFlavor} ${noteBoost}${avoidText}`,
          `gelato ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
        ]
      : [
          `dessert ${cityQ} ${localFlavor} ${noteBoost}${avoidText}`,
          `ice cream ${cityQ} ${hiddenGem} ${noteBoost}${avoidText}`,
        ],
  };

  if (p.duration === "half_day") {
    if (includeTreat) {
      return [...baseHalfDay, { ...treatSlot, startAt: addMinutes(t0, gapMin * 3) }];
    }
    return baseHalfDay;
  }

  if (includeTreat) {
    const out: SlotTemplate[] = [];
    for (const s of baseFullDay) {
      out.push(s);
      if (s.id === "lunch") {
        out.push({ ...treatSlot, startAt: addMinutes(t0, gapMin * 3) });
      }
    }
    return out.map((s, idx) => ({ ...s, startAt: addMinutes(t0, gapMin * idx) }));
  }

  return baseFullDay;
}

export async function buildItineraryBlocks(
  prefs: ItineraryPrefs
): Promise<Array<Pick<ItineraryBlock, "id" | "timeLabel" | "title" | "category" | "primary" | "alternates">>> {
  const slots = buildSlots(prefs);

  const usedPlaceIds = new Set<string>();
  const usedTypeKeys = new Set<string>();

  const blocks: Array<Pick<ItineraryBlock, "id" | "timeLabel" | "title" | "category" | "primary" | "alternates">> = [];

  const minRating = prefs.budget === "$$$$" ? 4.4 : 4.2;
  const now = nowUtc();

  // Distance-aware grouping: prefer the next stop to be close to the last chosen stop.
  let lastCoord: { lat: number; lng: number } | null = null;

  function preferredRadiusKm(): number {
    switch (prefs.transport) {
      case "walk":
        return 3;
      case "bike":
        return 8;
      case "drive":
        return 25;
    }
  }

  function distancePenaltyFactor(): number {
    // Score is ~45-55 for top places; make distance meaningful but not dominant.
    switch (prefs.transport) {
      case "walk":
        return 2.8;
      case "bike":
        return 1.8;
      case "drive":
        return 0.9;
    }
  }

  for (const s of slots) {
    let candidates: PlaceCandidate[] = [];

    const biases = pickBiases(prefs, s.id);

    for (const q of s.queries) {
      for (const bias of biases) {
        const found = await searchPlacesText({
          textQuery: q,
          locationBias: bias,
          minRating,
          maxResults: 16,
        });
        candidates = dedupeByPlaceId([...candidates, ...found]);
        if (candidates.length >= 12) break;
      }
      if (candidates.length >= 12) break;
    }

    candidates = varietyRotate(candidates, prefs, s.id);

    const requireOpen = s.requireOpenNow && isSoon(now, s.startAt);
    const openFiltered = requireOpen ? candidates.filter((p) => p.openNow === true) : candidates;
    let pool = openFiltered.length >= 3 ? openFiltered : candidates;

    // Type diversity
    const diverse = pool.filter((p) => {
      const k = typeKey(p);
      if (!k) return true;
      return !usedTypeKeys.has(k);
    });
    if (diverse.length >= 3) pool = diverse;

    // Distance-aware re-rank
    if (lastCoord) {
      const from = lastCoord; // capture to satisfy TS narrowing inside callback
      const prefKm = preferredRadiusKm();
      const factor = distancePenaltyFactor();

      pool = [...pool].sort((a, b) => {
        const aHas = typeof a.lat === "number" && typeof a.lng === "number";
        const bHas = typeof b.lat === "number" && typeof b.lng === "number";

        const aDist = aHas ? distanceKm(from, { lat: a.lat!, lng: a.lng! }) : prefKm;
        const bDist = bHas ? distanceKm(from, { lat: b.lat!, lng: b.lng! }) : prefKm;

        const aAdj = a.score - factor * Math.max(0, aDist - 0.5);
        const bAdj = b.score - factor * Math.max(0, bDist - 0.5);

        const aTooFar = aDist > prefKm;
        const bTooFar = bDist > prefKm;
        if (aTooFar !== bTooFar) return aTooFar ? 1 : -1;

        return bAdj - aAdj;
      });
    }

    const primary = pickPrimaryAvoidingUsed(pool, usedPlaceIds);
    if (primary) {
      usedPlaceIds.add(primary.placeId);
      const k = typeKey(primary);
      if (k) usedTypeKeys.add(k);

      if (typeof primary.lat === "number" && typeof primary.lng === "number") {
        lastCoord = { lat: primary.lat, lng: primary.lng };
      }
    }

    const alternates = pool
      .filter((p) => (primary ? p.placeId !== primary.placeId : true))
      .filter((p) => !usedPlaceIds.has(p.placeId))
      .slice(0, prefs.pace === "packed" ? 6 : 4);

    const timeLabel =
      (prefs.duration === "two_days" ? `${formatDayLabel(s.startAt)} • ` : "") + formatTimeLabel(s.startAt);

    blocks.push({
      id: s.id,
      timeLabel,
      title: s.title,
      category: s.category,
      primary,
      alternates,
    });
  }

  return blocks;
}