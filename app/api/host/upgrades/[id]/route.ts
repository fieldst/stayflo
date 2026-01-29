import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function deny() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function pickAllowedPatch(body: any) {
  // Only allow fields your UI edits. Prevent breaking scope/key accidentally.
  const allowed: any = {};

  if (typeof body.title === "string") allowed.title = body.title;
  if (typeof body.subtitle === "string") allowed.subtitle = body.subtitle;
  if (typeof body.emoji === "string") allowed.emoji = body.emoji;

  if (body.price_text === null || typeof body.price_text === "string") allowed.price_text = body.price_text;

  if (body.lead_time_hours === null || typeof body.lead_time_hours === "number")
    allowed.lead_time_hours = body.lead_time_hours;

  if (typeof body.sort_order === "number") allowed.sort_order = body.sort_order;

  if (typeof body.enabled === "boolean") allowed.enabled = body.enabled;

  if (Array.isArray(body.fields)) allowed.fields = body.fields;

  return allowed;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdminAuthed(req)) return deny();

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const patch = pickAllowedPatch(body);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("host_upgrades")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ upgrade: data });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdminAuthed(req)) return deny();

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // ✅ Soft delete so it disappears everywhere, but you keep history
  const { error } = await supabaseServer
    .from("host_upgrades")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}