import { NextResponse } from "next/server";

type Ok = { ok: true; lat: number; lng: number; formatted: string };
type Err = { ok: false; error: string };

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();

    if (!q) return NextResponse.json<Err>({ ok: false, error: "Missing query" }, { status: 400 });

    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      return NextResponse.json<Err>({ ok: false, error: "Missing Google Maps API key" }, { status: 500 });
    }

    // Places API (New) text search – returns geometry for city/zip/address
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // Only ask for what we need
        "X-Goog-FieldMask": "places.location,places.formattedAddress,places.displayName",
      },
      body: JSON.stringify({
        textQuery: q,
        regionCode: "US",
        languageCode: "en",
        // keep it broad so ZIP works
      }),
    });

    const data = (await r.json()) as any;

    const first = data?.places?.[0];
    const loc = first?.location;

    if (!r.ok) {
      const msg =
        data?.error?.message ||
        data?.message ||
        `Places search failed (${r.status})`;
      return NextResponse.json<Err>({ ok: false, error: msg }, { status: r.status });
    }

    if (!first || !loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") {
      return NextResponse.json<Err>(
        { ok: false, error: "No results found. Try a ZIP or City, State." },
        { status: 404 }
      );
    }

    const formatted =
      String(first.formattedAddress || first.displayName?.text || q);

    return NextResponse.json<Ok>({
      ok: true,
      lat: loc.latitude,
      lng: loc.longitude,
      formatted,
    });
  } catch (e: any) {
    return NextResponse.json<Err>(
      { ok: false, error: e?.message || "Geocode failed" },
      { status: 500 }
    );
  }
}