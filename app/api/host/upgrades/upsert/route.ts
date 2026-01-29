import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type UpgradePayload = {
  id?: string;
  scope_type: string;
  scope_key: string;
  upgrade_key: string;
  title: string;
  subtitle?: string | null;
  emoji?: string | null;
  enabled?: boolean;
  is_active?: boolean;
  price_text?: string | null;
  lead_time_hours?: number | null;
  sort_order?: number | null;
  fields?: any;
};

function toBool(v: any, fallback: boolean) {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UpgradePayload;

    const scope_type = String(body.scope_type || "").trim();
    const scope_key = String(body.scope_key || "").trim();
    const upgrade_key = String(body.upgrade_key || "").trim();
    const title = String(body.title || "").trim();

    if (!scope_type) return NextResponse.json({ error: "Missing scope_type" }, { status: 400 });
    if (!scope_key) return NextResponse.json({ error: "Missing scope_key" }, { status: 400 });
    if (!upgrade_key) return NextResponse.json({ error: "Missing upgrade_key" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

    const nowIso = new Date().toISOString();

    const row: any = {
      scope_type,
      scope_key,
      upgrade_key,
      title,
      subtitle: body.subtitle ?? null,
      emoji: body.emoji ?? null,
      enabled: toBool(body.enabled, true),
      is_active: toBool(body.is_active, true),
      price_text: body.price_text ?? null,
      lead_time_hours: body.lead_time_hours ?? null,
      sort_order: body.sort_order ?? 0,
      fields: body.fields ?? {},
      updated_at: nowIso,
    };

    // True UPSERT behavior:
    // - If `id` is provided and does not exist yet, INSERT it.
    // - If `id` exists, UPDATE it.
    // This fixes the "Add Upgrade" flow where the client generates an id.
    const id = body.id ? String(body.id).trim() : "";

    if (id) {
      const upsertRow = {
        id,
        ...row,
        // created_at is usually defaulted in DB, but if you ever removed the default
        // this keeps inserts consistent.
        created_at: nowIso,
      } as any;

      const { data: upserted, error: upsertError } = await supabaseServer
        .from("host_upgrades")
        .upsert(upsertRow, { onConflict: "id" })
        .select("id");

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 400 });
      }

      const resolvedId = upserted?.[0]?.id || id;

      const { data, error: selectError } = await supabaseServer
        .from("host_upgrades")
        .select("*")
        .eq("id", resolvedId)
        .single();

      if (selectError) {
        return NextResponse.json({ error: selectError.message }, { status: 400 });
      }

      return NextResponse.json({ upgrade: data }, { status: 200 });
    }

    // Insert when no id is provided
    const { data: inserted, error: insertError } = await supabaseServer
      .from("host_upgrades")
      .insert({ ...row, created_at: nowIso })
      .select("id");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    const newId = inserted?.[0]?.id;
    if (!newId) {
      return NextResponse.json({ error: "Insert succeeded but no id returned" }, { status: 500 });
    }

    const { data, error: selectError } = await supabaseServer
      .from("host_upgrades")
      .select("*")
      .eq("id", newId)
      .single();

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 400 });
    }

    return NextResponse.json({ upgrade: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}