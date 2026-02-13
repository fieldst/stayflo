import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const COOKIE = "stayflo_admin";
const ENV_KEY = "HOST_ADMIN_PASSCODE";

export async function POST(req: NextRequest) {
  try {
    const expected = (process.env[ENV_KEY] || "").trim();

    if (!expected) {
      return NextResponse.json(
        {
          error: `Admin passcode not configured (set ${ENV_KEY} in .env.local and restart the server).`,
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const passcode = String(body?.passcode || "").trim();

    if (!passcode || passcode !== expected) {
      return NextResponse.json(
        { error: "Invalid passcode" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set({
      name: COOKIE,
      value: "1",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Login failed" },
      { status: 500 }
    );
  }
}