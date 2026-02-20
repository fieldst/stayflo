import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Analytics must NEVER break UX. This endpoint should always succeed.
  try {
    const body = await req.json().catch(() => ({} as any));
    const propertySlug = String((body as any)?.propertySlug || "");
    const eventName = String((body as any)?.eventName || "");
    const metadata = (body as any)?.metadata ?? {};

    // If payload is malformed, just no-op successfully.
    if (!propertySlug || !eventName) {
      return NextResponse.json({ ok: true, stored: false }, { status: 200 });
    }

    const supabase = getSupabase();

    // If env isn't configured, safely no-op.
    if (!supabase) {
      return NextResponse.json({ ok: true, stored: false }, { status: 200 });
    }

    // Best-effort insert; swallow any failures (missing table, RLS, etc.)
    const { error } = await supabase.from("events").insert({
      event_name: eventName,
      metadata: { propertySlug, ...metadata },
    });

    if (error) {
      // Do NOT return 500. Telemetry is optional.
      return NextResponse.json({ ok: true, stored: false }, { status: 200 });
    }

    return NextResponse.json({ ok: true, stored: true }, { status: 200 });
  } catch {
    // Do NOT return 500. Telemetry is optional.
    return NextResponse.json({ ok: true, stored: false }, { status: 200 });
  }
}