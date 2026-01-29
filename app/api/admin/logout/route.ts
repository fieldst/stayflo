import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearAdminCookie } from "@/lib/adminAuth";

export const runtime = "nodejs";

// Keep POST for programmatic logout.
// Add GET so navigations don't 404 and leave the cookie uncleared.
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("next") || "/";
  const safe = target.startsWith("/") ? target : "/";
  const res = NextResponse.redirect(new URL(safe, req.url));
  clearAdminCookie(res);
  return res;
}

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  clearAdminCookie(res);
  return res;
}