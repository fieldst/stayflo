import { Suspense } from "react";
import { PublicShell } from "@/components/PublicShell";
import NearbyWizard from "./nearbyClient";

export const dynamic = "force-dynamic";

export default function NearbyPage() {
  return (
    <PublicShell>
      <Suspense
        fallback={
          <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-10">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h1 className="text-xl font-semibold">Loading…</h1>
              <p className="mt-2 text-sm text-white/70">Getting things ready…</p>
            </div>
          </main>
        }
      >
        <NearbyWizard />
      </Suspense>
    </PublicShell>
  );
}