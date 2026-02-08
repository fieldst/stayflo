import nodemailer, { type Transporter } from 'nodemailer';

type SendEmailParams = {
  subject: string;
  text: string;
  html?: string;
};

type EmailConfig = {
  to: string;
  from: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
};

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

function getEmailConfig(): EmailConfig | null {
  const to = readEnv('STAYFLO_HOST_EMAIL_TO');
  const from = readEnv('STAYFLO_EMAIL_FROM');
  const smtpHost = readEnv('SMTP_HOST');
  const smtpPortRaw = readEnv('SMTP_PORT');
  const smtpUser = readEnv('SMTP_USER');
  const smtpPass = readEnv('SMTP_PASS');
  const smtpSecureRaw = readEnv('SMTP_SECURE');

  const missing: string[] = [];
if (!to) missing.push('STAYFLO_HOST_EMAIL_TO');
if (!from) missing.push('STAYFLO_EMAIL_FROM');
if (!smtpHost) missing.push('SMTP_HOST');
if (!smtpPortRaw) missing.push('SMTP_PORT');
if (!smtpUser) missing.push('SMTP_USER');
if (!smtpPass) missing.push('SMTP_PASS');

if (missing.length) {
  // eslint-disable-next-line no-console
  console.warn('[email] missing env:', missing);
  return null;
}


  const smtpPort = Number(smtpPortRaw);
  if (!Number.isFinite(smtpPort) || smtpPort <= 0) return null;

  const smtpSecure = (smtpSecureRaw ?? '').toLowerCase() === 'true' || smtpPort === 465;

  return { to, from, smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure };
}

let cachedTransporter: Transporter | null = null;

function getTransporter(cfg: EmailConfig): Transporter {
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
  });

  return cachedTransporter;
}

export async function sendHostEmail(
  params: SendEmailParams
): Promise<{ sent: boolean; error?: string }> {
  const cfg = getEmailConfig();
  if (!cfg) return { sent: false, error: 'Email not configured (missing env vars) — check Vercel Production env + redeploy' };


  try {
    const transporter = getTransporter(cfg);
    await transporter.sendMail({
      to: cfg.to,
      from: cfg.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return { sent: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown email send error';
    return { sent: false, error: msg };
  }
}
