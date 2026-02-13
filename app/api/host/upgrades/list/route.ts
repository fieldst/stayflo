import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeDisabled = searchParams.get("all") === "1";

    let q = supabaseServer
      .from("host_upgrades")
      .select(
        "id,scope_type,scope_key,upgrade_key,title,subtitle,emoji,enabled,price_text,lead_time_hours,sort_order,fields,created_at,updated_at,is_active"
      )
      .order("scope_type", { ascending: true })
      .order("scope_key", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!includeDisabled) {
      q = q.eq("is_active", true);
    }

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ upgrades: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}