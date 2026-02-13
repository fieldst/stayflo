import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPropertyConfig } from "@/lib/property";

const CITY_KEY = "san-antonio-tx";

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) throw new Error("Missing Supabase env vars");
  return createClient(url, anon, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const property = String(searchParams.get("property") || "").trim();

    const cfg = getPropertyConfig(property);
    if (!cfg) {
      return NextResponse.json({ upgrades: [] }, { status: 200 });
    }

    const sb = supabase();

    // 1) City-wide upgrades (San Antonio)
    const city = await sb
      .from("host_upgrades")
      .select(
        "id,scope_type,scope_key,upgrade_key,title,subtitle,emoji,enabled,price_text,lead_time_hours,sort_order,fields"
      )
      .eq("enabled", true)
      .is("deleted_at", null) // ✅ ADD THIS
      .eq("scope_type", "city")
      .eq("scope_key", CITY_KEY);

    if (city.error) throw city.error;

    // 2) Property-specific upgrades (lamar / gabriel)
    const prop = await sb
      .from("host_upgrades")
      .select(
        "id,scope_type,scope_key,upgrade_key,title,subtitle,emoji,enabled,price_text,lead_time_hours,sort_order,fields"
      )
      .eq("enabled", true)
      .is("deleted_at", null) // ✅ ADD THIS
      .eq("scope_type", "property")
      .eq("scope_key", cfg.slug);

    if (prop.error) throw prop.error;

    // 3) Merge + sort
    const upgrades = [...(city.data || []), ...(prop.data || [])].sort(
      (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );

    return NextResponse.json({ upgrades }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ upgrades: [], error: e?.message || "Failed" }, { status: 200 });
  }
}