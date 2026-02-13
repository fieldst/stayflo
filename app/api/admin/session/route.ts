// app/api/admin/session/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return NextResponse.json({ authed: isAdminAuthed(req) });
}
