import Link from "next/link";
import { notFound } from "next/navigation";
import ResultClient from "./ResultClient";

type PageProps = {
  params: Promise<{ property?: string }>;
};

export default async function ItineraryResultPage({ params }: PageProps) {
  const resolved = await params;
  const property = (resolved?.property || "").toLowerCase().trim();
  if (!property) return notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10">
      <div className="mb-6">
        <Link href={`/p/${property}`} className="text-sm text-white/70 hover:text-white">
          ← Back to Guest Portal
        </Link>
      </div>

      <ResultClient />
    </main>
  );
}
