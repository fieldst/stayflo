import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "stayflo_admin";

/**
 * Protect the Host Portal:
 * - Allow /host (login gate page) for everyone
 * - Block everything else under /host/* unless admin cookie is present
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Only guard /host routes
  if (!pathname.startsWith("/host")) return NextResponse.next();

  // Always allow the host login gate page itself
  if (pathname === "/host" || pathname === "/host/") return NextResponse.next();

  // If not authed, redirect to /host (login page), preserving where they tried to go
  const authed = req.cookies.get(COOKIE)?.value === "1" || req.cookies.get(COOKIE)?.value === "true";
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/host";
    url.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/host/:path*"],
};
