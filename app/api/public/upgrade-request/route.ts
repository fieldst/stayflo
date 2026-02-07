import { NextResponse } from 'next/server';
import { sendHostEmail } from '@/lib/email';

export const runtime = 'nodejs';

function safeString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const b =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};

    const property = safeString(b.property);
    const propertyName = safeString(b.propertyName);
    const city = safeString(b.city);

    // Contract from RequestClient
    const upgradeKey = safeString(b.upgrade_key);
    const upgradeTitle = safeString(b.upgrade_title);

    const guestName = safeString(b.guest_name);
    const guestEmail = safeString(b.guest_email);
    const guestPhone = safeString(b.guest_phone);

    // Optional extras
    const arrivalDate = safeString(b.arrivalDate);
    const desiredTime = safeString(b.desiredTime);
    const details = safeString(b.details);

    if (!property || !upgradeKey) {
      return NextResponse.json(
        { ok: false, error: 'Missing property or upgrade_key' },
        { status: 400 }
      );
    }

    const subject = `Stayflo Upgrade Request – ${
      propertyName ? `${propertyName} (${property})` : property
    }`;

    const lines: string[] = [];
    lines.push('NEW STAYFLO UPGRADE REQUEST');
    lines.push('--------------------------------');
    lines.push(
      `Property: ${propertyName ? `${propertyName} (${property})` : property}`
    );
    if (city) lines.push(`City: ${city}`);
    lines.push(`Type: ${upgradeTitle || upgradeKey}`);
    if (arrivalDate) lines.push(`Date: ${arrivalDate}`);
    if (desiredTime) lines.push(`Preferred time: ${desiredTime}`);
    lines.push('');
    lines.push('GUEST DETAILS');
    lines.push(`Name: ${guestName || 'Unknown'}`);
    lines.push(`Email: ${guestEmail || 'Unknown'}`);
    lines.push(`Phone: ${guestPhone || 'Unknown'}`);
    if (details) {
      lines.push('');
      lines.push('Guest message:');
      lines.push(details);
    }
    lines.push('');
    lines.push('NEXT STEP');
    lines.push('Reply to the guest in Airbnb.');
    lines.push(
      'If approved, send the request through Airbnb so everything stays official and secure.'
    );

    const emailRes = await sendHostEmail({
      subject,
      text: lines.join('\n'),
    });

    // Never break guest flow if email fails
    if (!emailRes.sent) {
      console.warn('[upgrade-request] email not sent:', emailRes.error);
    }

    return NextResponse.json({
      ok: true,
      emailed: emailRes.sent,
      emailError: emailRes.sent ? undefined : emailRes.error,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
