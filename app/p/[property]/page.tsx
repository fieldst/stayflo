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
  const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL;

  // ✅ inKind referral URL (defaults to your link)
  const inkindUrl =
    process.env.NEXT_PUBLIC_INKIND_REFERRAL_URL || "https://app.inkind.com/refer/CPFPLC5V";

  // ✅ Welcome modal — show once ever per property
// ✅ Welcome modal — show once ever per property (stable key)
const WELCOME_POP_KEY = useMemo(
  () => `stayflo_welcome_seen_${propertySlug}`,
  [propertySlug]
);

const [showWelcome, setShowWelcome] = useState(false);

useEffect(() => {
  if (!propertySlug) return; // wait until params hydrate

  try {
    const seen = window.localStorage.getItem(WELCOME_POP_KEY);
    if (seen === "true") return;

    setShowWelcome(true);

    try {
      trackEvent(propertySlug, "welcome_modal_view", { location: "guest_home" });
    } catch {}
  } catch {
    // If localStorage is blocked, still show once per load
    setShowWelcome(true);
  }
}, [propertySlug, WELCOME_POP_KEY]);

function dismissWelcome() {
  setShowWelcome(false);

  try {
    window.localStorage.setItem(WELCOME_POP_KEY, "true");
  } catch {}

  try {
    trackEvent(propertySlug, "welcome_modal_dismiss", { location: "guest_home" });
  } catch {}
}


  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [loadingUpgrades, setLoadingUpgrades] = useState(true);
  const [showPlanMyDaySoon, setShowPlanMyDaySoon] = useState(false);

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
      {/* ✅ WELCOME VIDEO + IG FOLLOW — Option A modal */}
      {showWelcome ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 pt-10 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to Fields of Comfort Stays"
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-neutral-950 text-white shadow-2xl">

            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-white/60">
                  Welcome to Fields of Comfort Stays
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {propertyLabel} Guest Portal
                </div>
              </div>

              <button
                type="button"
                onClick={dismissWelcome}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Video */}
            <div className="px-5 pt-5">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-2">
                <div className="relative w-full max-h-[260px] overflow-hidden rounded-xl">
                  <iframe
                    className="w-full h-[260px]"
                    src="https://www.youtube.com/embed/zctDYe_3aHY?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1"
                    title="Welcome to Fields of Comfort Stays"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

              </div>

              {/* Instagram Follow Box */}
              {instagramUrl ? (
                <div className="mt-5 rounded-2xl border-2 border-purple-400/50 bg-gradient-to-br from-purple-900/35 via-black/55 to-black/60 p-4 shadow-[0_0_28px_rgba(168,85,247,0.35)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M17.5 6.5h.01"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wide text-white/60">Stay connected</div>
                      <div className="mt-1 text-sm font-semibold">Follow Fields of Comfort Stays</div>
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-white/70">
                    We share memory wall moments, behind-the-scenes creation, and the future homes we’re building —
                    all with comfort and intention.
                  </p>

                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold hover:bg-purple-500"
                    onClick={() => {
                      try {
                        trackEvent(cfg.slug, "instagram_follow_click", { location: "welcome_modal" });
                      } catch {}
                    }}
                  >
                    📷 Follow on Instagram
                  </a>

                  <div className="mt-2 text-center text-xs text-white/50">Opens in a new tab</div>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 pt-5">
              <div className="flex gap-3">
                <button
                  type="button"
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15"
                  onClick={dismissWelcome}
                >
                  Not now
                </button>

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    try {
                      trackEvent(cfg.slug, "welcome_enter_portal_click", { location: "welcome_modal" });
                    } catch {}
                    dismissWelcome();
                  }}
                >
                  Enter Guest Portal →
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ PROPERTY BADGE */}
      <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-5">
        <div className="text-xs uppercase tracking-wide text-white/60">{cfg.city}</div>
        <div className="mt-1 text-2xl font-bold">{propertyLabel}</div>
        <div className="mt-1 text-sm text-white/70">
          You’re viewing the guest hub for <span className="font-semibold">{propertyLabel}</span>.
        </div>
      </div>

      {/* ✅ LOCAL DINING PERK (inKind) — Option B */}
      <div className="relative rounded-3xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-900/35 via-black/55 to-purple-900/25 p-6 shadow-[0_0_38px_rgba(16,185,129,0.35)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
              💸 Free $25 + 20% back
            </div>
            <h2 className="mt-3 text-xl font-semibold">Free $25 for Food & Coffee</h2>
            <p className="mt-2 text-sm text-white/75">
              As a guest here, you get access to a local dining perk — $25 off your first meal and 20% back on
              future visits (restaurants and coffee shops).
            </p>
          </div>

          <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg">
            🍽️
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
          <ul className="space-y-1 text-white/75">
            <li>• $25 off your first meal</li>
            <li>• 20% back on future visits</li>
            <li>• Works at restaurants and coffee shops</li>
          </ul>
        </div>

        <div className="mt-5">
          <a
            href={inkindUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
            onClick={() => {
              try {
                trackEvent(cfg.slug, "inkind_referral_click", { location: "guest_home" });
              } catch {}
            }}
          >
            🔥 Unlock My $25 Credit
          </a>
          <div className="mt-2 text-center text-xs text-white/60">
            Free app • Takes under 60 seconds • Opens in a new tab
          </div>
        </div>
      </div>

      {/* ✅ INSTAGRAM FOLLOW (GUEST-FACING) — keep as secondary reminder on the page */}
      {instagramUrl ? (
        <div className="relative rounded-3xl border-2 border-purple-400/60 bg-gradient-to-br from-purple-900/40 via-black/50 to-black/60 p-6 shadow-[0_0_35px_rgba(168,85,247,0.45)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M17.5 6.5h.01"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">Stay connected</div>
              <h2 className="mt-1 text-lg font-semibold">Follow Fields of Comfort Stays</h2>
            </div>
          </div>

          <p className="mt-2 text-sm text-white/70">
            We’d love to stay connected. Follow us to see memory wall moments, behind-the-scenes creation,
            and the future homes we’re building — all with comfort and intention.
          </p>

          <div className="mt-4">
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15"
              onClick={() => {
                try {
                  trackEvent(cfg.slug, "instagram_follow_click", { location: "guest_home" });
                } catch {}
              }}
            >
              📷 Follow on Instagram
            </a>

            <div className="mt-2 text-center text-xs text-white/50">Opens in a new tab</div>
          </div>
        </div>
      ) : null}

      {/* HERO */}
      <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
        <h1 className="text-3xl font-bold leading-tight">Make the most of your stay</h1>
        <p className="mt-2 text-sm text-white/70">
          Your personal concierge for food, fun, and local favorites.
          <span className="ml-2 inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-200">
            💸 Free $25 dining perk inside
          </span>
        </p>

        <div className="mt-5">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              trackEvent(cfg.slug, "home_plan_day_click", { coming_soon: true });
              setShowPlanMyDaySoon(true);
            }}
          >
            🧠 Plan My Day
          </Button>
          <div className="mt-2 text-xs text-white/60 text-center">
            Coming soon: a personalized day plan built from your vibe, budget, and host favorites.
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button href={`/p/${cfg.slug}/wifi`} variant="purple" className="w-full">
            📶 Wi-Fi & Tech
          </Button>

          <Button href={`/p/${cfg.slug}/guide`} variant="purple" className="w-full">
            📘 House Guide
          </Button>
        </div>
      </div>

      {/* ✅ PLAN MY DAY — COMING SOON MODAL (NO NAVIGATION) */}
      {showPlanMyDaySoon ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Plan My Day coming soon"
          onClick={() => setShowPlanMyDaySoon(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-950 p-6 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs uppercase tracking-wide text-white/60">Coming soon</div>
            <h2 className="mt-2 text-xl font-semibold">✨ Plan My Day</h2>

            <p className="mt-3 text-sm text-white/70">
              We’re building a concierge-style feature that creates a time-blocked itinerary for your stay —
              restaurants, activities, and local favorites picked for{" "}
              <span className="font-semibold text-white">you</span>.
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              <div className="font-semibold">What it will do:</div>
              <ul className="mt-2 space-y-1 text-white/70">
                <li>• Match your vibe + budget + pace</li>
                <li>• Include ⭐ Host Favorites (with notes + tips)</li>
                <li>• Suggest morning / afternoon / evening plans</li>
                <li>• Give easy swaps if you change your mind</li>
              </ul>
            </div>

            <div className="mt-5 flex gap-3">
              <Button variant="primary" className="w-full" onClick={() => setShowPlanMyDaySoon(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ UPGRADES ON HOME (WITH BADGES) */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Enhance your stay</h2>
            <p className="mt-1 text-sm text-white/70">
              Optional upgrades — submit a request and we’ll confirm availability.
            </p>
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
                      variant="request"
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

        <p className="mt-4 text-xs text-white/60">
          We’ll confirm availability through the Airbnb message thread.
        </p>
      </div>
    </div>
  );
}
