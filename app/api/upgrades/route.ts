import { NextResponse } from "next/server";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const property = searchParams.get("property"); // optional

  const cityKey = "san-antonio-tx";

  const cityQuery = supabaseBrowser
    .from("host_upgrades")
    .select("*")
    .eq("scope_type", "city")
    .eq("scope_key", cityKey)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });

  const propQuery = property
    ? supabaseBrowser
        .from("host_upgrades")
        .select("*")
        .eq("scope_type", "property")
        .eq("scope_key", property)
        .eq("enabled", true)
        .order("sort_order", { ascending: true })
    : null;

  const [cityRes, propRes] = await Promise.all([cityQuery, propQuery]);

  if (cityRes.error) return NextResponse.json({ error: cityRes.error.message }, { status: 500 });
  if (propRes && propRes.error) return NextResponse.json({ error: propRes.error.message }, { status: 500 });

  const city = cityRes.data ?? [];
  const prop = propRes?.data ?? [];

  // merge by upgrade_key (property overrides city if present)
  const map = new Map<string, any>();
  for (const u of city) map.set(u.upgrade_key, u);
  for (const u of prop) map.set(u.upgrade_key, u);

  return NextResponse.json({ upgrades: Array.from(map.values()) });
}
