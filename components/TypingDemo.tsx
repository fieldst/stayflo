"use client";

import { useEffect, useMemo, useState } from "react";

const EXAMPLES = [
  `Romantic night — no coffee. Want a scenic walk + dessert.`,
  `Kids with me. Need something fun + ice cream + not too crowded.`,
  `Foodie day. BBQ + tacos. Avoid tourist traps.`,
  `Outdoors + chill. Parks, views, and a great brunch.`,
  `Right now — open now. Something fun within 15 minutes.`,
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function TypingDemo() {
  const examples = useMemo(() => EXAMPLES, []);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState("");
  const [mode, setMode] = useState<"typing" | "pause" | "deleting">("typing");

  useEffect(() => {
    const full = examples[idx];
    const speedType = 60;
    const speedDelete = 40;

    const t = setTimeout(() => {
      if (mode === "typing") {
        const nextLen = clamp(shown.length + 1, 0, full.length);
        const next = full.slice(0, nextLen);
        setShown(next);
        if (nextLen >= full.length) setMode("pause");
      } else if (mode === "pause") {
  // Hold the completed sentence longer (premium feel)
  const hold = setTimeout(() => setMode("deleting"), 2200);
  return () => clearTimeout(hold);
} else {
        const nextLen = clamp(shown.length - 1, 0, full.length);
        const next = full.slice(0, nextLen);
        setShown(next);
        if (nextLen <= 0) {
          setIdx((i) => (i + 1) % examples.length);
          setMode("typing");
        }
      }
    }, mode === "deleting" ? speedDelete : speedType);

    return () => clearTimeout(t);
  }, [examples, idx, mode, shown]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
  <div className="text-xs uppercase tracking-wide text-white/60">Try typing something like</div>
  <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
    Demo
  </div>
</div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-4 pointer-events-none select-none">
        <div className="flex items-center gap-2 text-sm text-white/80">
          <span className="text-white/60">“</span>
          <span className="font-medium">
            {shown}
            <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-white/70 align-middle" />
          </span>
          <span className="text-white/60">”</span>
        </div>
      </div>

      <div className="mt-3 text-xs text-white/60">
        Step 1: tap “Use my location” above. Then you’ll be able to enter notes like this and generate your plan.
      </div>
    </div>
  );
}