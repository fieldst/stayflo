import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from("property_guides")
      .select("property_slug,file_path,file_name,uploaded_at")
      .order("uploaded_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ guides: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}