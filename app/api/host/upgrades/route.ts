import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function deny() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function slugKey(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 40);
}

async function existsKey(scope_type: string, scope_key: string, upgrade_key: string) {
  const { data, error } = await supabaseServer
    .from("host_upgrades")
    .select("id")
    .eq("scope_type", scope_type)
    .eq("scope_key", scope_key)
    .eq("upgrade_key", upgrade_key)
    .is("deleted_at", null) // <-- IMPORTANT: ignore soft-deleted rows
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

async function ensureUniqueKey(scope_type: string, scope_key: string, baseKey: string) {
  let key = baseKey || "upgrade";
  if (!(await existsKey(scope_type, scope_key, key))) return key;

  for (let i = 2; i <= 50; i++) {
    const candidate = `${key}_${i}`;
    if (!(await existsKey(scope_type, scope_key, candidate))) return candidate;
  }
  throw new Error("Unable to generate unique upgrade key");
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return deny();

  const { data, error } = await supabaseServer
    .from("host_upgrades")
    .select("*")
    .is("deleted_at", null)
    .order("scope_type", { ascending: true })
    .order("scope_key", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ upgrades: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return deny();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const scope_type = (body.scope_type ?? "city") as string;
  const scope_key = (body.scope_key ?? "san-antonio-tx") as string;

  const title = String(body.title ?? "").trim();
  const subtitle = String(body.subtitle ?? "").trim();

  if (!title || !subtitle) {
    return NextResponse.json({ error: "title and subtitle are required" }, { status: 400 });
  }

  // If user supplies upgrade_key (advanced), respect it; otherwise derive from title
  const suppliedKey = String(body.upgrade_key ?? "").trim();
  const baseKey = suppliedKey || slugKey(title);

  let upgrade_key: string;
  try {
    upgrade_key = await ensureUniqueKey(scope_type, scope_key, baseKey);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to generate key" }, { status: 500 });
  }

  const payload = {
    scope_type,
    scope_key,
    upgrade_key,
    title,
    subtitle,
    emoji: String(body.emoji ?? "✨"),
    enabled: Boolean(body.enabled ?? true),
    price_text: body.price_text ?? null,
    lead_time_hours: body.lead_time_hours ?? null,
    sort_order: Number(body.sort_order ?? 0),
    fields: body.fields ?? [],
  };

  const { data: inserted, error: insertError } = await supabaseServer
    .from("host_upgrades")
    .insert(payload)
    .select("id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
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
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  return NextResponse.json({ upgrade: data });
}