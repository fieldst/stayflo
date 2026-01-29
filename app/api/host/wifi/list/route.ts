import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function deny() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return deny();

  const { data, error } = await supabaseServer
    .from("host_wifi")
    .select("*")
    .is("deleted_at", null)
    .order("scope_key", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ wifi: data ?? [] }, { status: 200 });
}