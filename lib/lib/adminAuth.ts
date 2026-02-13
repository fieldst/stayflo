// lib/adminAuth.ts
import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE = "stayflo_admin";
const ONE_WEEK = 60 * 60 * 24 * 7;

export function isAdminAuthed(req: NextRequest): boolean {
  return req.cookies.get(COOKIE)?.value === "1";
}

export function setAdminCookie(res: NextResponse) {
  res.cookies.set({
    name: COOKIE,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK,
    path: "/",
  });
}

export function clearAdminCookie(res: NextResponse) {
  res.cookies.set({
    name: COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}
