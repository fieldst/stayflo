// app/api/admin/login/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { setAdminCookie } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };

  const expected = process.env.HOST_ADMIN_PASSCODE || "";
  if (!expected) return NextResponse.json({ error: "Missing HOST_ADMIN_PASSCODE" }, { status: 500 });

  if (!passcode || passcode !== expected) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setAdminCookie(res);
  return res;
}
