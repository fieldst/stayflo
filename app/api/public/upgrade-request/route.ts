import { NextResponse } from "next/server";
import { sendUpgradeRequestEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const property = String(body?.property || "");
    const propertyName = String(body?.propertyName || "");
    const city = String(body?.city || "");

    const upgradeKey = String(body?.upgrade_key || "");
    const upgradeTitle = String(body?.upgrade_title || "");

    const guestName = String(body?.guest_name || "");
    const guestEmail = String(body?.guest_email || "");
    const guestPhone = String(body?.guest_phone || "");

    // Backward-compatible: old clients sent "contact"
    const contactRaw = String(body?.contact || "");
    const contact =
      contactRaw ||
      [guestEmail, guestPhone].map((s) => String(s || "").trim()).filter(Boolean).join(" / ");

    const arrivalDate = String(body?.arrivalDate || "");
    const desiredTime = String(body?.desiredTime || "");
    const details = String(body?.details || "");

    if (!property || !upgradeKey) {
      return NextResponse.json({ ok: false, error: "Missing property or upgrade_key" }, { status: 400 });
    }

    const result = await sendUpgradeRequestEmail({
      property,
      propertyName,
      city,
      upgradeKey,
      upgradeTitle,
      guestName,
      guestEmail,
      guestPhone,
      contact,
      arrivalDate,
      desiredTime,
      details,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
