import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const property = (url.searchParams.get("property") || "").toLowerCase().trim();

  if (!property) {
    return NextResponse.json({ error: "Missing property" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("host_wifi")
    .select("scope_key, ssid, password, notes, enabled")
    .eq("scope_type", "property")
    .eq("scope_key", property)
    .is("deleted_at", null)
    .eq("enabled", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ wifi: data ?? null }, { status: 200 });
}