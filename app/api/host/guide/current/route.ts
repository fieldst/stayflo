import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const property = String(searchParams.get("property") || "").trim();

    if (!property) {
      return NextResponse.json({ error: "Missing property" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("property_guides")
      .select("property_slug,file_path,file_name,uploaded_at")
      .eq("property_slug", property)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ guide: data || null }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}