// app/api/auth/logout/route.ts
//
// Why this exists:
// - AdminBar logs out via a normal navigation (<Link/>), which is a GET
// - /api/admin/logout is POST-only (used by programmatic logout)
// - Without this, clicking "Logout" 404s and the admin cookie never clears
//
// This route clears the admin cookie and redirects back to a safe page.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearAdminCookie } from "@/lib/adminAuth";

export const runtime = "nodejs";

function safeRedirectTarget(req: NextRequest): string {
  // Prefer explicit ?next=... if provided (must be path-only)
  const next = req.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/")) return next;

  // Otherwise try referer
  const ref = req.headers.get("referer") || "";
  try {
    const refUrl = new URL(ref);
    const path = refUrl.pathname || "/";
    if (path.startsWith("/p/")) return path + (refUrl.search || "");
    if (path.startsWith("/host")) return "/";
  } catch {
    // ignore
  }
  return "/";
}

export async function GET(req: NextRequest) {
  const target = safeRedirectTarget(req);
  const res = NextResponse.redirect(new URL(target, req.url));
  clearAdminCookie(res);
  return res;
}

export async function POST(req: NextRequest) {
  // Support programmatic logout too (optional)
  const target = safeRedirectTarget(req);
  const res = NextResponse.json({ ok: true, next: target });
  clearAdminCookie(res);
  return res;
}