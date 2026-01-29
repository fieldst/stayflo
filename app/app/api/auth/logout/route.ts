// app/api/auth/logout/route.ts
//
// Why this exists:
// - AdminBar links to a GET route (via <Link/>)
// - The existing /api/admin/logout endpoint is POST-only
// - Without this file, clicking "Logout" causes a 404 and the admin cookie never clears
//
// This route clears the admin cookie and redirects the user back to a safe page.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearAdminCookie } from "@/lib/adminAuth";

export const runtime = "nodejs";

function safeRedirectTarget(req: NextRequest): string {
  // Prefer explicit ?next=... if provided (must be same-origin + path-only)
  const next = req.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/")) return next;

  // Otherwise, try to send them back to where they came from.
  // If they were in the host portal, bounce them to the guest hub root.
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
  // Support programmatic logout as well.
  const target = safeRedirectTarget(req);
  const res = NextResponse.json({ ok: true, next: target });
  clearAdminCookie(res);
  return res;
}
