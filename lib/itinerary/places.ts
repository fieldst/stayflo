import type { PlaceCandidate } from "./types";

const DEFAULT_TIMEOUT_MS = 12_000;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type PlacesSearchTextResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    googleMapsUri?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string; // PRICE_LEVEL_*
    types?: string[];
    photos?: Array<{ name?: string }>;
    currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
    regularOpeningHours?: { weekdayDescriptions?: string[] };
  }>;
};

function priceLevelToNumber(level?: string): number | undefined {
  switch (level) {
    case "PRICE_LEVEL_FREE":
      return 0;
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return undefined;
  }
}

function scorePlace(rating?: number, userRatingsTotal?: number): number {
  const r = typeof rating === "number" ? rating : 0;
  const n = typeof userRatingsTotal === "number" ? userRatingsTotal : 0;
  const volumeBoost = Math.log10(n + 1);
  return Number((r * 10 + volumeBoost * 5).toFixed(3));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export type SearchTextParams = {
  textQuery: string;
  locationBias?: { lat: number; lng: number; radiusMeters: number };
  minRating?: number;
  maxResults?: number;
};

export async function searchPlacesText(
  params: SearchTextParams
): Promise<PlaceCandidate[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Missing GOOGLE_MAPS_API_KEY");

  const maxResults = Math.min(Math.max(params.maxResults ?? 10, 1), 20);

  const body: Record<string, unknown> = {
    textQuery: params.textQuery,
    maxResultCount: maxResults,
  };

  if (params.locationBias) {
    const radius = clamp(params.locationBias.radiusMeters, 0, 50_000);
    body.locationBias = {
      circle: {
        center: {
          latitude: params.locationBias.lat,
          longitude: params.locationBias.lng,
        },
        radius,
      },
    };
  }

  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.googleMapsUri",
    "places.location",
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
    "places.types",
    "places.photos",
    "places.currentOpeningHours",
    "places.regularOpeningHours",
  ].join(",");

  const res = await fetchWithTimeout(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `Places searchText failed: ${res.status} ${res.statusText} ${txt}`.slice(
        0,
        500
      )
    );
  }

  const json = (await res.json()) as PlacesSearchTextResponse;
  const raw = Array.isArray(json.places) ? json.places : [];

  const out = raw
    .map((p): PlaceCandidate | null => {
      const placeId = String(p.id || "");
      const name = p.displayName?.text ? String(p.displayName.text) : "";
      if (!placeId || !name) return null;

      const rating = typeof p.rating === "number" ? p.rating : undefined;
      const userRatingsTotal =
        typeof p.userRatingCount === "number" ? p.userRatingCount : undefined;
      const score = scorePlace(rating, userRatingsTotal);

      const photoRef = p.photos?.[0]?.name ? String(p.photos[0].name) : undefined;

      const openNow =
        typeof p.currentOpeningHours?.openNow === "boolean"
          ? p.currentOpeningHours.openNow
          : undefined;

      const weekdayDescriptions =
        Array.isArray(p.currentOpeningHours?.weekdayDescriptions)
          ? p.currentOpeningHours.weekdayDescriptions.map(String)
          : Array.isArray(p.regularOpeningHours?.weekdayDescriptions)
            ? p.regularOpeningHours.weekdayDescriptions.map(String)
            : undefined;

      return {
        placeId,
        name,
        address: p.formattedAddress ? String(p.formattedAddress) : undefined,
        googleMapsUri: p.googleMapsUri ? String(p.googleMapsUri) : undefined,
        lat:
          typeof p.location?.latitude === "number" ? p.location.latitude : undefined,
        lng:
          typeof p.location?.longitude === "number" ? p.location.longitude : undefined,
        rating,
        userRatingsTotal,
        priceLevel: priceLevelToNumber(p.priceLevel),
        types: Array.isArray(p.types) ? p.types.map(String) : undefined,
        photoRef,
        score,
        openNow,
        weekdayDescriptions,
      };
    })
    .filter((x): x is PlaceCandidate => x !== null);

  const minRating = typeof params.minRating === "number" ? params.minRating : 0;

  return out
    .filter((p) => (typeof p.rating === "number" ? p.rating >= minRating : false))
    .sort((a, b) => b.score - a.score);
}