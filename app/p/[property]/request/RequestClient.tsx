"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getPropertyConfig } from "@/lib/property";
import { trackEvent } from "@/lib/events";
import { Button } from "@/components/ui/Button";
import { PropertyBadge } from "@/components/PropertyBadge";

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
  fields: unknown[];
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const d = data as Record<string, unknown>;
    const msg =
      (typeof d?.error === "string" && d.error) ||
      (typeof d?.message === "string" && d.message) ||
      (typeof d?.raw === "string" && d.raw) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

function labelForUpgradeKey(upgrades: Upgrade[], key: string) {
  return upgrades.find((u) => u.upgrade_key === key)?.title ?? "Request";
}

export default function RequestClient() {
  const params = useParams();
  const sp = useSearchParams();

  const propertySlug = String(params.property || "");
  const cfgMaybe = getPropertyConfig(propertySlug);

  if (!cfgMaybe) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white/70">Unknown property.</div>
      </div>
    );
  }

  const cfg = cfgMaybe;

  // `type` is dynamic: it equals `upgrade_key`
  const rawType = sp.get("type");
  const hasType = Boolean(rawType && rawType.trim().length > 0);

  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [loadingUpgrades, setLoadingUpgrades] = useState(true);
  const [upgradesError, setUpgradesError] = useState<string | null>(null);

  // selected upgrade_key
  const [type, setType] = useState<string>(rawType || "");

  // Guest info
  const [name, setName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [arrivalDate, setArrivalDate] = useState("");
  const [desiredTime, setDesiredTime] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Load upgrades (city + property rules handled server-side)
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoadingUpgrades(true);
      setUpgradesError(null);
      try {
        const data = await fetchJSON<{ upgrades: Upgrade[] }>(
          `/api/upgrades?property=${encodeURIComponent(cfg.slug)}`
        );
        const list = (data.upgrades || []).filter((u) => u.enabled);
        if (!mounted) return;
        setUpgrades(list);

        if (rawType && rawType.trim()) {
          setType(rawType.trim());
        } else {
          setType(list[0]?.upgrade_key || "");
        }
      } catch (e: unknown) {
        if (!mounted) return;
        const msg = e instanceof Error ? e.message : "Failed to load upgrades";
        setUpgradesError(msg);
        setUpgrades([]);
        setType(rawType || "");
      } finally {
        if (mounted) setLoadingUpgrades(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.slug, rawType]);

  const selected = useMemo(
    () => upgrades.find((u) => u.upgrade_key === type) ?? null,
    [upgrades, type]
  );

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!name.trim()) e.push("Name is required.");
    if (!guestEmail.trim()) e.push("Email is required.");
    if (!guestPhone.trim()) e.push("Phone number is required.");
    if (hasType && !type) e.push("Upgrade type is required.");
    if (hasType && upgrades.length && !selected) e.push("That upgrade is not available.");
    return e;
  }, [name, guestEmail, guestPhone, hasType, type, upgrades.length, selected]);

  async function submit() {
    if (errors.length) return;

    trackEvent(cfg.slug, "upsell_request_submit", {
      type, // upgrade_key
      title: selected?.title ?? undefined,
      name: name.trim(),
      guestEmail: guestEmail.trim(),
      guestPhone: guestPhone.trim(),
      arrivalDate,
      desiredTime,
      hasDetails: Boolean(details.trim()),
    });

    // Notify host (email route). Do not block guest success if notify fails.
    try {
      await fetch("/api/public/upgrade-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property: cfg.slug,
          propertyName: cfg.name || "",
          city: cfg.city || "",
          upgrade_key: type,
          upgrade_title: selected?.title || "",

          // IMPORTANT: send these fields (backend will use them)
          guest_name: name.trim(),
          guest_email: guestEmail.trim(),
          guest_phone: guestPhone.trim(),

          // keep legacy field for backward compatibility
          contact: guestEmail.trim() || guestPhone.trim(),

          arrivalDate,
          desiredTime,
          details: details.trim(),
        }),
      });
    } catch (e) {
      console.warn("Host notify failed:", e);
    }

    setSubmitted(true);
  }

  // Submitted state (updated copy)
  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <div className="text-xs uppercase tracking-wide text-white/60">{cfg.city}</div>
          <h1 className="mt-1 text-2xl font-bold">Request received ✅</h1>

          <p className="mt-2 text-sm text-white/70">
            Thanks! If approved, we’ll send the request directly through Airbnb so everything stays official and secure.
          </p>

          <p className="mt-2 text-sm text-white/70">
            If you have any questions, email us at{" "}
            <a className="underline" href="mailto:info@fieldsofcomfortstays.com">
              info@fieldsofcomfortstays.com
            </a>
            .
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button href={`/p/${cfg.slug}`} className="w-full">
              Home
            </Button>
            <Button href={`/p/${cfg.slug}/itinerary`} className="w-full" variant="primary">
              Plan My Day
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-white/60">Request</span>
              <span className="font-semibold">{labelForUpgradeKey(upgrades, type)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/60">Name</span>
              <span className="font-semibold">{name}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/60">Email</span>
              <span className="font-semibold">{guestEmail}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/60">Phone</span>
              <span className="font-semibold">{guestPhone}</span>
            </div>
            {arrivalDate ? (
              <div className="flex justify-between gap-3">
                <span className="text-white/60">Date</span>
                <span className="font-semibold">{arrivalDate}</span>
              </div>
            ) : null}
            {desiredTime ? (
              <div className="flex justify-between gap-3">
                <span className="text-white/60">Preferred time</span>
                <span className="font-semibold">{desiredTime}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // HUB MODE: /request (no type)
  if (!hasType) {
    return (
      <div className="space-y-6">
        <PropertyBadge slug={cfg.slug} />
        <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">{cfg.city}</div>
              <h1 className="mt-1 text-2xl font-bold">Upgrades</h1>
              <p className="mt-2 text-sm text-white/70">
                Optional upgrades — submit a request and we’ll confirm availability. (Request-based, no purchase required.)
              </p>
            </div>
            <Button href={`/p/${cfg.slug}`} variant="secondary">
              Back
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          {loadingUpgrades ? (
            <div className="text-sm text-white/70">Loading upgrades…</div>
          ) : upgradesError ? (
            <div className="text-sm text-red-300">{upgradesError}</div>
          ) : upgrades.length ? (
            <div className="space-y-3">
              {upgrades.map((u) => (
                <Button
                  key={u.id}
                  href={`/p/${cfg.slug}/request?type=${encodeURIComponent(u.upgrade_key)}`}
                  className="w-full justify-between"
                  variant="secondary"
                >
                  <span>
                    {u.emoji} {u.title}
                  </span>
                  <span className="text-white/60">Request</span>
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/70">No upgrades available right now.</div>
          )}
        </div>
      </div>
    );
  }

  // FORM MODE: /request?type=upgrade_key
  return (
    <div className="space-y-6">
      <PropertyBadge slug={cfg.slug} />

      <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/60">{cfg.city}</div>
            <h1 className="mt-1 text-2xl font-bold">Request an upgrade</h1>
            <p className="mt-2 text-sm text-white/70">
              Submit a request — we’ll confirm availability in Airbnb.
            </p>
          </div>
          <Button href={`/p/${cfg.slug}`} variant="secondary">
            Home
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Choose an upgrade</h2>

        {loadingUpgrades ? (
          <div className="mt-3 text-sm text-white/70">Loading upgrades…</div>
        ) : upgradesError ? (
          <div className="mt-3 text-sm text-red-300">{upgradesError}</div>
        ) : null}

        <div className="mt-4 grid gap-3">
          {upgrades.map((u) => {
            const active = u.upgrade_key === type;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setType(u.upgrade_key)}
                className={`w-full text-left rounded-3xl border p-5 transition ${
                  active ? "border-white/20 bg-white/10" : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">
                      {u.emoji} {u.title}
                    </div>
                    <div className={`mt-1 text-sm ${active ? "text-white/80" : "text-white/70"}`}>{u.subtitle}</div>
                    {u.price_text ? <div className="mt-2 text-xs text-white/60">Est. price: {u.price_text}</div> : null}
                  </div>

                  <span className={`text-xs ${active ? "text-white/80" : "text-white/60"}`}>Selected</span>
                </div>
              </button>
            );
          })}
        </div>

        {selected ? (
          <p className="mt-3 text-xs text-white/60">
            You selected: <span className="font-semibold text-white/80">{selected.title}</span>
          </p>
        ) : type ? (
          <p className="mt-3 text-xs text-red-300">
            That upgrade isn’t available for this property. Please choose another.
          </p>
        ) : null}
      </div>

      {/* Form */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-5">
        <div>
          <label className="text-sm font-semibold text-white/90">Your name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
            placeholder="First + last name"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-white/90">Email *</label>
          <input
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
            placeholder="you@email.com"
            inputMode="email"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-white/90">Phone *</label>
          <input
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
            placeholder="(210) 555-0123"
            inputMode="tel"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-white/90">Date (optional)</label>
            <input
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
              placeholder="2026-01-25"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-white/90">Preferred time (optional)</label>
            <input
              value={desiredTime}
              onChange={(e) => setDesiredTime(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
              placeholder="Example: 1:00 PM"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-white/90">Details (optional)</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
            rows={3}
            placeholder='Example: "We’re arriving early with a toddler"'
          />
        </div>
      </div>

      {/* Submit */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        {errors.length ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="font-semibold text-white/90">Please fix:</div>
            <ul className="mt-2 list-disc pl-5 text-white/70">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Button
          onClick={submit}
          className={`w-full ${errors.length ? "opacity-40 pointer-events-none" : ""}`}
          variant="primary"
        >
          ✅ Submit Request
        </Button>

        <p className="mt-3 text-xs text-white/60">
          If approved, we’ll send the request via Airbnb. Questions? Email{" "}
          <a className="underline" href="mailto:info@fieldsofcomfortstays.com">
            info@fieldsofcomfortstays.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
