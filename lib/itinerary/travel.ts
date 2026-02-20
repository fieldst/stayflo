const DEFAULT_TIMEOUT_MS = 10_000;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Haversine distance (km) — cheap local estimate for “don’t zig-zag across town”.
 */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371; // km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return R * c;
}

export type TravelEstimate = {
  durationMinutes: number;
  durationText: string;
  distanceMeters: number;
  distanceText: string;
};

/**
 * Real travel time using Google Distance Matrix.
 * Requires Distance Matrix API enabled for your Google project.
 */
export async function estimateTravelBetweenPlaceIds(opts: {
  originPlaceId: string;
  destPlaceId: string;
  mode: "driving" | "walking" | "bicycling";
}): Promise<TravelEstimate | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const origin = `place_id:${opts.originPlaceId}`;
  const dest = `place_id:${opts.destPlaceId}`;

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", dest);
  url.searchParams.set("mode", opts.mode);
  url.searchParams.set("key", key);

  const res = await fetchWithTimeout(url.toString(), { method: "GET" });
  if (!res.ok) return null;

  const json = (await res.json()) as any;
  const element = json?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") return null;

  const durationSeconds = Number(element?.duration?.value);
  const distanceMeters = Number(element?.distance?.value);
  if (!Number.isFinite(durationSeconds) || !Number.isFinite(distanceMeters)) return null;

  const durationMinutes = clamp(Math.round(durationSeconds / 60), 1, 999);
  const durationText = String(element?.duration?.text || `${durationMinutes} mins`);
  const distanceText = String(element?.distance?.text || "");

  return {
    durationMinutes,
    durationText,
    distanceMeters,
    distanceText,
  };
}