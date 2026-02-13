import fs from "fs/promises";
import path from "path";
import QRCode from "qrcode";

// IMPORTANT: pull base URL from env
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// Your property slugs (keep this in sync with your actual portal slugs)
const slugs = ["lamar", "gabriel"];

const outDir = path.join(process.cwd(), "public", "qr");

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  for (const slug of slugs) {
    const url = `${baseUrl}/p/${slug}`;
    const outPath = path.join(outDir, `portal-${slug}.png`);

    await QRCode.toFile(outPath, url, {
      width: 768,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    console.log(`✅ QR created: public/qr/portal-${slug}.png -> ${url}`);
  }

  console.log("\nDone. Use these files in print/signage:");
  console.log(`- public/qr/portal-lamar.png`);
  console.log(`- public/qr/portal-gabriel.png`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});