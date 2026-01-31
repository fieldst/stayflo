import Link from "next/link";
import { notFound } from "next/navigation";
import WifiClient from "./wifi-client";

type PageProps = {
  params: Promise<{ property?: string }>;
};

export default async function WifiPage({ params }: PageProps) {
  const resolved = await params;
  const property = (resolved?.property || "").toLowerCase().trim();

  if (!property) return notFound();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/public/wifi?property=${property}`,
    { cache: "no-store" }
  );

  const json = await res.json().catch(() => ({ wifi: null }));
  const wifi = json?.wifi ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10">
      <div className="mb-6">
        <Link href={`/p/${property}`} className="text-sm text-white/70 hover:text-white">
          ← Back to Guest Portal
        </Link>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-white">Wi-Fi & Tech Help</h1>
      <p className="mt-2 text-white/70">Internet and tech info for your stay.</p>

      <WifiClient wifi={wifi} />
    </main>
  );
}
