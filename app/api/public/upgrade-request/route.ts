import { NextResponse } from "next/server";

export const runtime = "nodejs";

function env(name: string) {
  return (process.env[name] || "").trim();
}

function maskPhone(p: string) {
  if (!p) return "";
  const s = p.replace(/\D/g, "");
  if (s.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const property = String(body?.property || "");
    const propertyName = String(body?.propertyName || "");
    const city = String(body?.city || "");
    const upgradeKey = String(body?.upgrade_key || "");
    const upgradeTitle = String(body?.upgrade_title || "");
    const guestName = String(body?.guest_name || "");
    const contact = String(body?.contact || "");
    const arrivalDate = String(body?.arrivalDate || "");
    const desiredTime = String(body?.desiredTime || "");
    const details = String(body?.details || "");

    if (!property || !upgradeKey) {
      return NextResponse.json(
        { ok: false, error: "Missing property or upgrade_key" },
        { status: 400 }
      );
    }

    // Twilio env (set these in Vercel + local .env.local)
    const SID = env("TWILIO_ACCOUNT_SID");
    const TOKEN = env("TWILIO_AUTH_TOKEN");
    const FROM = env("TWILIO_FROM_NUMBER");
    const TO = env("STAYFLO_HOST_SMS_TO");

    // If not configured yet, don’t break UX — just no-op safely
    if (!SID || !TOKEN || !FROM || !TO) {
      return NextResponse.json({
        ok: true,
        sent: false,
        reason: "Twilio not configured",
        missing: {
          TWILIO_ACCOUNT_SID: !SID,
          TWILIO_AUTH_TOKEN: !TOKEN,
          TWILIO_FROM_NUMBER: !FROM,
          STAYFLO_HOST_SMS_TO: !TO,
        },
      });
    }

    const lines: string[] = [];
    lines.push("📣 Stayflo – Upgrade Request");
    lines.push(`Property: ${propertyName ? `${propertyName} (${property})` : property}`);
    if (city) lines.push(`City: ${city}`);
    lines.push(`Upgrade: ${upgradeTitle || upgradeKey}`);
    if (arrivalDate) lines.push(`Date: ${arrivalDate}`);
    if (desiredTime) lines.push(`Time: ${desiredTime}`);
    lines.push(`Guest: ${guestName || "N/A"}`);
    lines.push(`Contact: ${contact ? contact : "N/A"}`);
    if (details) lines.push(`Notes: ${details.slice(0, 240)}`);

    // Keep under typical SMS limits by trimming
    let message = lines.join("\n");
    if (message.length > 1450) message = message.slice(0, 1450) + "…";

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      SID
    )}/Messages.json`;

    const form = new URLSearchParams();
    form.set("From", FROM);
    form.set("To", TO);
    form.set("Body", message);

    const auth = Buffer.from(`${SID}:${TOKEN}`).toString("base64");

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const text = await resp.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.message || data?.raw || `Twilio error (${resp.status})`,
          debug: {
            to: maskPhone(TO),
            from: maskPhone(FROM),
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, sent: true, sid: data?.sid || null });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}