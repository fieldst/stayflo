import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const propertySlug = String(body?.propertySlug || "");
    const eventName = String(body?.eventName || "");
    const metadata = body?.metadata ?? {};

    if (!propertySlug || !eventName) {
      return NextResponse.json({ ok: false, error: "Missing propertySlug or eventName" }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      // No env configured yet — safely no-op.
      return NextResponse.json({ ok: true, stored: false });
    }

    // NOTE: We'll wire property_id once your properties table is created.
    // For now, store slug in metadata to keep it simple.
    const { error } = await supabase.from("events").insert({
      event_name: eventName,
      metadata: { propertySlug, ...metadata },
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, stored: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
