import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function deny() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

type Payload = {
  scope_type?: string; // property
  scope_key?: string;  // lamar / gabriel
  ssid?: string;
  password?: string;
  notes?: any;         // array of strings
  enabled?: boolean;
};

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return deny();

  const body = (await req.json().catch(() => null)) as Payload | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const scope_type = String(body.scope_type || "property").trim();
  const scope_key = String(body.scope_key || "").trim();
  const ssid = String(body.ssid || "").trim();
  const password = String(body.password || "").trim();
  const enabled = Boolean(body.enabled ?? true);

  const notes = Array.isArray(body.notes)
    ? body.notes.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim())
    : [];

  if (!scope_key) return NextResponse.json({ error: "Missing scope_key" }, { status: 400 });
  if (!ssid) return NextResponse.json({ error: "SSID is required" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "Password is required" }, { status: 400 });

  // 1) does a row already exist for this property?
  const { data: existing, error: findErr } = await supabaseServer
    .from("host_wifi")
    .select("id")
    .eq("scope_type", scope_type)
    .eq("scope_key", scope_key)
    .is("deleted_at", null)
    .maybeSingle();

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });

  const nowIso = new Date().toISOString();

  if (existing?.id) {
    // update
    const { data, error } = await supabaseServer
      .from("host_wifi")
      .update({
        ssid,
        password,
        notes,
        enabled,
        updated_at: nowIso,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ wifi: data }, { status: 200 });
  }

  // insert
  const { data, error } = await supabaseServer
    .from("host_wifi")
    .insert({
      scope_type,
      scope_key,
      ssid,
      password,
      notes,
      enabled,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ wifi: data }, { status: 200 });
}