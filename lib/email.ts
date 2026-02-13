import nodemailer from "nodemailer";

function env(name: string) {
  return (process.env[name] || "").trim();
}

export type UpgradeRequestEmailPayload = {
  property: string;
  propertyName?: string;
  city?: string;

  upgradeKey: string;
  upgradeTitle?: string;

  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;

  // Backward-compatible
  contact?: string;

  arrivalDate?: string;
  desiredTime?: string;
  details?: string;
};

export type SendEmailResult =
  | { sent: true; messageId: string | null }
  | {
      sent: false;
      reason: string;
      missing?: Record<string, boolean>;
    };

function buildUpgradeEmail(payload: UpgradeRequestEmailPayload) {
  const subjectParts = ["Stayflo – Upgrade Request", payload.propertyName || payload.property].filter(Boolean);

  const lines: string[] = [];
  lines.push("NEW STAYFLO UPGRADE REQUEST");
  lines.push("--------------------------------");
  lines.push(`Property: ${payload.propertyName ? `${payload.propertyName} (${payload.property})` : payload.property}`);
  if (payload.city) lines.push(`City: ${payload.city}`);
  lines.push(`Type: ${payload.upgradeTitle || payload.upgradeKey}`);
  if (payload.arrivalDate) lines.push(`Date: ${payload.arrivalDate}`);
  if (payload.desiredTime) lines.push(`Preferred time: ${payload.desiredTime}`);

  lines.push("");
  lines.push("GUEST DETAILS");
  lines.push(`Name: ${payload.guestName || "N/A"}`);
  if (payload.guestPhone) lines.push(`Phone: ${payload.guestPhone}`);
  if (payload.guestEmail) lines.push(`Email: ${payload.guestEmail}`);

  // If new fields weren't provided, fall back to "contact"
  if (!payload.guestEmail && !payload.guestPhone) {
    lines.push(`Contact: ${payload.contact || "N/A"}`);
  }

  if (payload.details) {
    lines.push("");
    lines.push("Guest message:");
    lines.push(payload.details.slice(0, 4000));
  }

  lines.push("");
  lines.push("NEXT STEP");
  lines.push("Reply to the guest in Airbnb.");
  lines.push("If approved, send the request through Airbnb so everything stays official and secure.");

  return {
    subject: subjectParts.join(" – "),
    text: lines.join("\n"),
  };
}

function createTransport() {
  const host = env("SMTP_HOST");
  const portRaw = env("SMTP_PORT");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  const secureRaw = env("SMTP_SECURE");

  const port = portRaw ? Number(portRaw) : 587;
  const secure = secureRaw ? secureRaw === "true" : port === 465;

  const auth = user && pass ? { user, pass } : undefined;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
  });
}

export async function sendUpgradeRequestEmail(payload: UpgradeRequestEmailPayload): Promise<SendEmailResult> {
  const to = env("STAYFLO_HOST_EMAIL_TO");
  const from = env("STAYFLO_EMAIL_FROM");
  const smtpHost = env("SMTP_HOST");

  const missing = {
    SMTP_HOST: !smtpHost,
    STAYFLO_HOST_EMAIL_TO: !to,
    STAYFLO_EMAIL_FROM: !from,
  };

  if (missing.SMTP_HOST || missing.STAYFLO_HOST_EMAIL_TO || missing.STAYFLO_EMAIL_FROM) {
    return { sent: false, reason: "Email not configured", missing };
  }

  const { subject, text } = buildUpgradeEmail(payload);
  const transporter = createTransport();

  const info = await transporter.sendMail({ to, from, subject, text });
  return { sent: true, messageId: (info as any)?.messageId || null };
}
