import type { ItineraryPrefs, ItineraryBlock, PlaceCandidate } from "./types";
import { searchPlacesText } from "./places";

const TZ = "America/Chicago";

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
  { key: "stone_oak", lat: 29.6499, lng: -98.4730, radiusMeters: 35_000 },
  { key: "boerne", lat: 29.7947, lng: -98.7319, radiusMeters: 35_000 },
  { key: "new_braunfels", lat: 29.7030, lng: -98.1245, radiusMeters: 35_000 },
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

function chicagoDateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "2000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
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

function wantsTonight(notes: string | undefined): boolean {
  const n = normalize(notes || "");
  return /\b(tonight|right now|now|late night|this evening)\b/.test(n);
}

type NoteSignals = {
  noCoffee: boolean;
  wantsBbq: boolean;
  wantsIceCream: boolean;
  kidFriendly: boolean;
  includeKeywords: string[];
};

function extractSignals(notesRaw: string | undefined, vibes: string[]): NoteSignals {
  const notes = normalize(notesRaw || "");
  const vibeText = normalize(vibes.join(" "));

  const noCoffee =
    /\b(no coffee|dont like coffee|don't like coffee|hate coffee|avoid coffee|no caffeine)\b/.test(
      notes
    );

  const wantsBbq =
    /\b(bbq|barbecue|brisket|ribs|smoked)\b/.test(notes) || /\bbbq\b/.test(vibeText);

  const wantsIceCream = /\b(ice cream|gelato|frozen custard|milkshake)\b/.test(notes);

  const kidFriendly =
    /\b(kids|kid|children|family|toddler|stroller)\b/.test(notes) || /\bfamily\b/.test(vibeText);

  // Pull a few useful keywords from notes to steer search (no junk words)
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
  ]);

  const includeKeywords = Array.from(
    new Set(
      notes
        .split(" ")
        .filter(Boolean)
        .filter((w) => w.length >= 4 && w.length <= 18)
        .filter((w) => !stop.has(w))
    )
  ).slice(0, 6);

  return { noCoffee, wantsBbq, wantsIceCream, kidFriendly, includeKeywords };
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
  const seed = hashString(
    `${slotId}|${prefs.duration}|${prefs.pace}|${prefs.budget}|${prefs.transport}|${prefs.vibes.join(
      ","
    )}|${prefs.notes || ""}|${new Date().toISOString().slice(0, 13)}`
  );

  const outskirts = BIASES.filter((b) => b.key !== "downtown");
  const rotated = rotate(outskirts, seed % outskirts.length);
  return [BIASES[0], rotated[0]]; // downtown + 1 outskirts (keeps costs reasonable)
}

/**
 * Rotate candidate list slightly so we don’t always select the same “famous top 1”
 * for generic queries.
 */
function varietyRotate(candidates: PlaceCandidate[], prefs: ItineraryPrefs, slotId: string): PlaceCandidate[] {
  const seed = hashString(
    `${slotId}|${prefs.duration}|${prefs.pace}|${prefs.budget}|${prefs.transport}|${prefs.vibes.join(
      ","
    )}|${prefs.notes || ""}|${new Date().toISOString().slice(0, 13)}`
  );
  const offset = candidates.length ? seed % Math.min(candidates.length, 6) : 0;
  return rotate(candidates, offset);
}

function buildSlots(p: ItineraryPrefs): SlotTemplate[] {
  const budgetHint = budgetToHint(p.budget);
    const signals = extractSignals(p.notes, p.vibes);
  const gapMin = p.pace === "packed" ? 90 : p.pace === "chill" ? 150 : 120;

  
  const baseRequireOpenNow = true;
  const hour = chicagoHour(nowUtc());
const late = hour >= 20; // 8PM+

// ✅ UI choice wins over notes
const goTonight = p.planDay === "today" && late;

// ✅ If user chose tomorrow, always start tomorrow morning
const start = p.planDay === "tomorrow" ? tomorrowAt9amUtc(nowUtc()) : nowUtc();

  const localFlavor = signals.kidFriendly ? "family friendly local favorite" : "local favorite";
  const hiddenGem = "hidden gem locals love";
  const noteBoost = signals.includeKeywords.length ? `(${signals.includeKeywords.join(", ")})` : "";

  // NIGHT MODE
  if (goTonight) {

    const t0 = start;
    const dessertQueries = signals.wantsIceCream
      ? [
          `ice cream San Antonio open late ${localFlavor} ${noteBoost}`,
          `gelato San Antonio open late ${hiddenGem} ${noteBoost}`,
          `late night dessert San Antonio ${hiddenGem} ${noteBoost}`,
        ]
      : [
          `late night dessert San Antonio ${hiddenGem} ${noteBoost}`,
          `late night tacos San Antonio ${localFlavor} ${noteBoost}`,
          `open late food San Antonio ${hiddenGem} ${noteBoost}`,
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
              `evening walk San Antonio scenic ${localFlavor} ${noteBoost}`,
              `family friendly evening San Antonio ${hiddenGem} ${noteBoost}`,
            ]
          : [
              `live music San Antonio tonight ${localFlavor} ${noteBoost}`,
              `cocktail bar San Antonio open late ${hiddenGem} ${noteBoost}`,
              `nightlife San Antonio popular ${localFlavor} ${noteBoost}`,
            ],
      },
    ];
  }

  // DAY MODE
  const t0 = start;

  const morningQueries = signals.noCoffee
    ? [
        `best breakfast San Antonio ${budgetHint} ${localFlavor} ${noteBoost}`,
        `breakfast tacos San Antonio ${hiddenGem} ${noteBoost}`,
        `bakery San Antonio ${hiddenGem} ${noteBoost}`,
      ]
    : [
        `best breakfast San Antonio ${budgetHint} ${localFlavor} ${noteBoost}`,
        `coffee and pastries San Antonio ${hiddenGem} ${noteBoost}`,
        `cafe San Antonio ${localFlavor} ${noteBoost}`,
      ];

  const lunchQueries = signals.wantsBbq
    ? [
        `best bbq San Antonio brisket ribs ${localFlavor} ${noteBoost}`,
        `bbq near San Antonio smoked meats ${hiddenGem} ${noteBoost}`,
      ]
    : [
        `best lunch San Antonio ${budgetHint} ${localFlavor} ${noteBoost}`,
        `local lunch San Antonio ${hiddenGem} ${noteBoost}`,
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
        `top attractions San Antonio ${localFlavor} ${noteBoost}`,
        `things to do San Antonio ${hiddenGem} ${noteBoost}`,
        `best museums San Antonio ${localFlavor} ${noteBoost}`,
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

  const baseFullDay: SlotTemplate[] = [
    ...baseHalfDay,
    {
      id: "aft",
      startAt: addMinutes(t0, gapMin * 3),
      title: "Explore a neighborhood / shops",
      category: "shopping",
      requireOpenNow: false,
      queries: [
        `best neighborhoods to explore San Antonio ${localFlavor} ${noteBoost}`,
        `boutiques San Antonio ${hiddenGem} ${noteBoost}`,
        `San Antonio market square local ${noteBoost}`,
      ],
    },
    {
      id: "dinner",
      startAt: addMinutes(t0, gapMin * 4),
      title: "Dinner",
      category: "dinner",
      requireOpenNow: false,
      queries: [
        `best dinner San Antonio ${budgetHint} ${localFlavor} ${noteBoost}`,
        `local dinner San Antonio ${hiddenGem} ${noteBoost}`,
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
            `evening walk San Antonio scenic ${localFlavor} ${noteBoost}`,
            `family friendly evening San Antonio ${hiddenGem} ${noteBoost}`,
          ]
        : [
            `cocktail bars San Antonio ${hiddenGem} ${noteBoost}`,
            `live music San Antonio ${localFlavor} ${noteBoost}`,
          ],
    },
  ];

  // Treat stop if kids or ice cream requested (practical)
  const includeTreat = signals.kidFriendly || signals.wantsIceCream;
  const treatSlot: SlotTemplate = {
    id: "treat",
    startAt: addMinutes(t0, gapMin * 3), // inserted after lunch in half-day; after lunch in full-day we’ll adjust order below
    title: signals.wantsIceCream ? "Ice cream / treat stop" : "Treat stop",
    category: "relax",
    requireOpenNow: false,
    queries: signals.wantsIceCream
      ? [
          `best ice cream San Antonio ${localFlavor} ${noteBoost}`,
          `gelato San Antonio ${hiddenGem} ${noteBoost}`,
        ]
      : [
          `dessert San Antonio ${localFlavor} ${noteBoost}`,
          `ice cream San Antonio ${hiddenGem} ${noteBoost}`,
        ],
  };

  if (p.duration === "half_day") {
    if (includeTreat) {
      // Insert treat after lunch (end)
      return [...baseHalfDay, { ...treatSlot, startAt: addMinutes(t0, gapMin * 3) }];
    }
    return baseHalfDay;
  }

  // full_day
  if (includeTreat) {
    // Insert treat right after lunch, then push other blocks down by one slot gap
    const out: SlotTemplate[] = [];
    for (const s of baseFullDay) {
      out.push(s);
      if (s.id === "lunch") {
        out.push({ ...treatSlot, startAt: addMinutes(t0, gapMin * 3) });
      }
    }
    // re-time after insertion so order flows
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

  const blocks: Array<
    Pick<ItineraryBlock, "id" | "timeLabel" | "title" | "category" | "primary" | "alternates">
  > = [];

  // Keep quality high, but not “only mega famous”
  const minRating = prefs.budget === "$$$$" ? 4.4 : 4.2;
  const now = nowUtc();

  for (const s of slots) {
    let candidates: PlaceCandidate[] = [];

    // Search across downtown + one outskirts center to increase variety
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

    // If near-term, prefer open places.
    const requireOpen = s.requireOpenNow && isSoon(now, s.startAt);
    const openFiltered = requireOpen ? candidates.filter((p) => p.openNow === true) : candidates;
    let pool = openFiltered.length >= 3 ? openFiltered : candidates;

    // Type diversity: avoid repeating same primary type across blocks
    const diverse = pool.filter((p) => {
      const k = typeKey(p);
      if (!k) return true;
      return !usedTypeKeys.has(k);
    });
    if (diverse.length >= 3) pool = diverse;

    // Choose primary avoiding already-used placeIds
    const primary = pickPrimaryAvoidingUsed(pool, usedPlaceIds);
    if (primary) {
      usedPlaceIds.add(primary.placeId);
      const k = typeKey(primary);
      if (k) usedTypeKeys.add(k);
    }

    // Alternates: prefer unused + also avoid repeats if possible
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
