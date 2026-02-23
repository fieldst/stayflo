import Link from "next/link";
import { Suspense } from "react";
import { PublicShell } from "@/components/PublicShell";
import NearbyResultClient from "./resultClient";

export const dynamic = "force-dynamic";

export default function NearbyResultPage() {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-10">
        <div className="mb-6">
          <Link href="/nearby" className="text-sm text-white/70 hover:text-white">
            ← Back
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h1 className="text-xl font-semibold">Loading…</h1>
              <p className="mt-2 text-sm text-white/70">Preparing your plan…</p>
            </div>
          }
        >
          <NearbyResultClient />
        </Suspense>
      </main>
    </PublicShell>
  );
}