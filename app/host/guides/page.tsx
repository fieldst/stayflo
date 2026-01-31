import React, { Suspense } from "react";
import GuidesClient from "./GuidesClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          Loading guides…
        </div>
      }
    >
      <GuidesClient />
    </Suspense>
  );
}
