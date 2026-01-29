"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getPropertyConfig } from "@/lib/property";
import { trackEvent } from "@/lib/events";
import { Button } from "@/components/ui/Button";

function getBadges(upgrade: any, index: number) {
  const badges: string[] = [];

  if (index === 0) {
    badges.push("Most requested");
  }

  if (["early_checkin", "late_checkout", "grocery_prestock"].includes(upgrade.upgrade_key)) {
    badges.push("Popular");
  }

  if (upgrade.scope_type === "property") {
    badges.push("This home");
  }

  if (upgrade.lead_time_hours && upgrade.lead_time_hours <= 24) {
    badges.push("Limited availability");
  }

  return badges;
}

type Upgrade = {
  id: string;
  scope_type: "city" | "property";
  scope_key: string;
  upgrade_key: string;
  title: string;
  subtitle: string;
  emoji: string;
  enabled: boolean;
  price_text: string | null;
  lead_time_hours: number | null;
  sort_order: number;
  fields: any[];
};

function displayPropertyName(slug: string) {
  if (slug === "lamar") return "Lamar Street";
  if (slug === "gabriel") return "Gabriel Street";
  return slug;
}

export default function PropertyHomePage() {
  const params = useParams();
  const propertySlug = String(params.property || "");
  const cfg = getPropertyConfig(propertySlug);

  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [loadingUpgrades, setLoadingUpgrades] = useState(true);

  useEffect(() => {
    if (!cfg) return;

    setLoadingUpgrades(true);
    fetch(`/api/public/upgrades?property=${encodeURIComponent(cfg.slug)}`)
      .then((r) => r.json())
      .then((data) => {
        setUpgrades(Array.isArray(data?.upgrades) ? data.upgrades : []);
      })
      .catch(() => setUpgrades([]))
      .finally(() => setLoadingUpgrades(false));
  }, [cfg?.slug]);

  const propertyLabel = useMemo(
    () => displayPropertyName(cfg?.slug || propertySlug),
    [cfg?.slug, propertySlug]
  );

  if (!cfg) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
        <h1 className="text-xl font-semibold">Property not found</h1>
        <p className="mt-2 text-sm text-white/70">Go back and try a valid property.</p>
        <div className="mt-4">
          <Button href="/p/lamar">Go to Lamar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      {/* ✅ PROPERTY BADGE */}
      <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-5">
        <div className="text-xs uppercase tracking-wide text-white/60">{cfg.city}</div>
        <div className="mt-1 text-2xl font-bold">{propertyLabel}</div>
        <div className="mt-1 text-sm text-white/70">
          You’re viewing the guest hub for <span className="font-semibold">{propertyLabel}</span>.
        </div>
      </div>

      {/* HERO */}
      <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
        <h1 className="text-3xl font-bold leading-tight">Make the most of your stay</h1>
        <p className="mt-2 text-sm text-white/70">Your personal concierge for food, fun, and local favorites.</p>

        <div className="mt-5">
          <Button
            href={`/p/${cfg.slug}/itinerary`}
            variant="primary"
            className="w-full"
            onClick={() => trackEvent(cfg.slug, "home_plan_day_click", {})}
          >
            🧠 Plan My Day
          </Button>
          <div className="mt-2 text-xs text-white/60 text-center">Takes ~30 seconds • Host favorites included</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button href={`/p/${cfg.slug}/wifi`} className="w-full">
            📶 Wi-Fi & Tech
          </Button>
          <Button href={`/p/${cfg.slug}/guide`} className="w-full">
            📘 House Guide
          </Button>
        </div>
      </div>

      {/* ✅ UPGRADES ON HOME (WITH BADGES) */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Enhance your stay</h2>
            <p className="mt-1 text-sm text-white/70">
              Optional upgrades — submit a request and we’ll confirm availability.
            </p>
          </div>

          {/* This is just a section label — per-upgrade badges show on each card below */}
          <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
            Most requested
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {loadingUpgrades ? (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
              Loading upgrades…
            </div>
          ) : upgrades.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
              No upgrades available right now.
            </div>
          ) : (
            upgrades.map((u, i) => {
              const badges = getBadges(u, i);

              return (
                <div key={u.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {/* ✅ BADGES */}
                      {badges.length > 0 ? (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {badges.map((b) => (
                            <span
                              key={b}
                              className={[
                                "rounded-full px-3 py-1 text-xs font-medium",
                                "border backdrop-blur-sm",
                                b === "Most requested"
                                  ? "bg-purple-500/20 border-purple-400/40 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.35)]"
                                  : b === "Popular"
                                  ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                                  : b === "Limited availability"
                                  ? "bg-amber-500/20 border-amber-400/40 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.35)]"
                                  : b === "This home"
                                  ? "bg-sky-500/20 border-sky-400/40 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                                  : "bg-white/10 border-white/20 text-white/80",
                              ].join(" ")}
                            >
                              {b}
                            </span>
                          ))}

                          {/* Optional: show price as a badge too (looks clean) */}
                          {u.price_text ? (
                            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
                              {u.price_text}
                            </span>
                          ) : null}
                        </div>
                      ) : u.price_text ? (
                        <div className="mb-2">
                          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
                            {u.price_text}
                          </span>
                        </div>
                      ) : null}

                      <div className="font-semibold">
                        {u.emoji || "✨"} {u.title}
                      </div>
                      <div className="mt-1 text-sm text-white/70">{u.subtitle}</div>
                    </div>

                    <Button
                      href={`/p/${cfg.slug}/request?type=${encodeURIComponent(u.upgrade_key)}`}
                      className="shrink-0"
                      onClick={() =>
                        trackEvent(cfg.slug, "upgrade_request_click", {
                          upgrade_key: u.upgrade_key,
                          title: u.title,
                          scope_type: u.scope_type,
                          scope_key: u.scope_key,
                        })
                      }
                    >
                      Request →
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p className="mt-4 text-xs text-white/60">We’ll confirm availability through the Airbnb message thread.</p>
      </div>
    </div>
  );
}