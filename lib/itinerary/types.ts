export type ItineraryPrefs = {
  propertySlug: string;
  city: string; // e.g., "San Antonio, TX"
  duration: "half_day" | "full_day" | "two_days";
  pace: "chill" | "balanced" | "packed";
  transport: "walk" | "drive" | "bike";
  budget: "$" | "$$" | "$$$" | "$$$$";
  vibes: string[];
  notes?: string;

  // ✅ NEW: explicitly choose the day
  planDay: "today" | "tomorrow";
};

export type PlaceCandidate = {
  placeId: string;
  name: string;
  address?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number; // 0-4 (Google)
  types?: string[];
  photoRef?: string;
  score: number; // our computed "hot+quality" score
  openNow?: boolean;
  weekdayDescriptions?: string[];
};

export type ItineraryBlock = {
  id: string; // stable for swap
  timeLabel: string; // "9:00 AM"
  title: string; // "Coffee + pastry"
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
  primary: PlaceCandidate | null;
  alternates: PlaceCandidate[];
  whyThis: string; // short concierge rationale (AI)
  tips: string[]; // 0-3 practical tips
};

export type GeneratedItinerary = {
  version: 1;
  city: string;
  generatedAt: string; // ISO
  prefs: Omit<ItineraryPrefs, "city">;
  headline: string;
  overview: string;
  blocks: ItineraryBlock[];
  generalTips: string[];
  disclaimers: string[];
};
