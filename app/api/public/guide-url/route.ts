import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const BUCKET = "host-guides";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const property = String(searchParams.get("property") || "").trim();

    if (!property) return NextResponse.json({ error: "Missing property" }, { status: 400 });

    const { data: row, error: rowErr } = await supabaseServer
      .from("property_guides")
      .select("file_path")
      .eq("property_slug", property)
      .maybeSingle();

    if (rowErr) throw rowErr;
    if (!row?.file_path) return NextResponse.json({ error: "No guide uploaded" }, { status: 404 });

    const { data, error } = await supabaseServer.storage.from(BUCKET).createSignedUrl(row.file_path, 60 * 10);
    if (error) throw error;

    return NextResponse.json({ url: data.signedUrl }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}