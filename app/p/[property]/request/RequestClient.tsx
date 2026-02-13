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
  fields: any[];
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data?.error || data?.message || data?.raw || `Request failed (${res.status})`);
  return data as T;
}

function labelForUpgradeKey(upgrades: Upgrade[], key: string) {
  return upgrades.find((u) => u.upgrade_key === key)?.title ?? "Request";
}

/** Formats US phone as (210) 555-0123 while typing */
function formatPhoneUS(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 10);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 10);

  if (digits.length <= 3) return a ? `(${a}` : "";
  if (digits.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

/** Time dropdown options (every 30 minutes) */
function timeOptions30m(): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [{ value: "", label: "Select a time" }];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30] as const) {
      const hour12 = ((h + 11) % 12) + 1;
      const ampm = h < 12 ? "AM" : "PM";
      const mm = m === 0 ? "00" : "30";
      const label = `${hour12}:${mm} ${ampm}`;
      out.push({ value: label, label });
    }
  }
  return out;
}

export default function RequestClient() {
  // ✅ Hooks first — ALWAYS
  const params = useParams();
  const sp = useSearchParams();

  const propertySlug = String((params as any)?.property || "");

  // ✅ Compute cfg without returning early
  const cfg = useMemo(() => getPropertyConfig(propertySlug), [propertySlug]);
  const isUnknownProperty = !cfg;

  const rawType = sp.get("type");
  const hasType = Boolean(rawType && rawType.trim().length > 0);

  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [loadingUpgrades, setLoadingUpgrades] = useState(true);
  const [upgradesError, setUpgradesError] = useState<string | null>(null);

  const [type, setType] = useState<string>(rawType || "");

  // Guest fields (no State)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [arrivalDate, setArrivalDate] = useState(""); // yyyy-mm-dd
  const [desiredTime, setDesiredTime] = useState(""); // dropdown
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // ✅ Compute once, not inside conditional branches
  const timeOptions = useMemo(() => timeOptions30m(), []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      // If property is unknown, don't try to load upgrades
      if (!cfg?.slug) {
        setLoadingUpgrades(false);
        setUpgrades([]);
        setUpgradesError(null);
        setType(rawType || "");
        return;
      }

      setLoadingUpgrades(true);
      setUpgradesError(null);

      try {
        const data = await fetchJSON<{ upgrades: Upgrade[] }>(`/api/upgrades?property=${encodeURIComponent(cfg.slug)}`);
        const list = (data.upgrades || []).filter((u) => u.enabled);
        if (!mounted) return;

        setUpgrades(list);

        if (rawType && rawType.trim()) {
          setType(rawType.trim());
        } else {
          setType(list[0]?.upgrade_key || "");
        }
      } catch (e: any) {
        if (!mounted) return;
        setUpgradesError(e.message || "Failed to load upgrades");
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
  }, [cfg?.slug, rawType]);

  const selected = useMemo(() => upgrades.find((u) => u.upgrade_key === type) ?? null, [upgrades, type]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!name.trim()) e.push("Name is required.");
    if (!phone.trim()) e.push("Phone number is required.");
    if (phone.replace(/\D/g, "").length !== 10) e.push("Phone number must be 10 digits.");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.push("Email looks invalid.");
    if (hasType && !type) e.push("Upgrade type is required.");
    if (hasType && upgrades.length && !selected) e.push("That upgrade is not available.");
    return e;
  }, [name, phone, email, hasType, type, upgrades.length, selected]);

  async function submit() {
    if (errors.length) return;
    if (!cfg?.slug) return;

    trackEvent(cfg.slug, "upsell_request_submit", {
      type,
      title: selected?.title ?? undefined,
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim(),
      arrivalDate: arrivalDate || undefined,
      desiredTime: desiredTime || undefined,
      hasDetails: Boolean(details.trim()),
    });

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
          guest_name: name.trim(),
          guest_email: email.trim(),
          guest_phone: phone.trim(),
          arrivalDate,
          desiredTime,
          details: details.trim(),
        }),
      });
    } catch (e) {
      console.warn("Email notify failed:", e);
    }

    setSubmitted(true);
  }

  // ✅ Now it's safe to return early (hooks already ran)
  if (isUnknownProperty) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white/70">Unknown property.</div>
      </div>
    );
  }

  // At this point cfg is guaranteed
  const safeCfg = cfg!;

  // ✅ Submitted state
  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <div className="text-xs uppercase tracking-wide text-white/60">{safeCfg.city}</div>
          <h1 className="mt-1 text-2xl font-bold">Request received ✅</h1>

          <p className="mt-2 text-sm text-white/70">
            If approved, we’ll send the request directly through Airbnb so everything stays official and secure.
            <br />
            If you have any questions, email us at <span className="font-semibold">info@fieldsofcomfortstays.com</span>.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button href={`/p/${safeCfg.slug}`} className="w-full">
              Home
            </Button>
            <Button href={`/p/${safeCfg.slug}/itinerary`} className="w-full" variant="primary">
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
              <span className="text-white/60">Phone</span>
              <span className="font-semibold">{phone}</span>
            </div>
            {email ? (
              <div className="flex justify-between gap-3">
                <span className="text-white/60">Email</span>
                <span className="font-semibold">{email}</span>
              </div>
            ) : null}
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

  // ✅ HUB MODE
  if (!hasType) {
    return (
      <div className="space-y-6">
        <PropertyBadge slug={safeCfg.slug} />
        <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">{safeCfg.city}</div>
              <h1 className="mt-1 text-2xl font-bold">Upgrades</h1>
              <p className="mt-2 text-sm text-white/70">
                Optional upgrades — submit a request and we’ll confirm availability. (Request-based, no purchase required.)
              </p>
            </div>
            <Button href={`/p/${safeCfg.slug}`} className="shrink-0">
              Home
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Choose an upgrade</h2>
            {loadingUpgrades ? <span className="text-xs text-white/60">Loading…</span> : null}
          </div>

          {upgradesError ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
              <div className="font-semibold text-white/90">Couldn’t load upgrades</div>
              <div className="mt-1 text-white/70">{upgradesError}</div>
              <div className="mt-3">
                <Button href={`/p/${safeCfg.slug}`} className="w-full">
                  Back to Home
                </Button>
              </div>
            </div>
          ) : null}

          {!upgradesError ? (
            <div className="mt-4 space-y-3">
              {upgrades.map((u) => (
                <div key={u.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">
                        {u.emoji} {u.title}
                      </div>
                      <div className="mt-1 text-sm text-white/70">{u.subtitle}</div>
                      {u.price_text ? <div className="mt-2 text-xs text-white/60">Est. price: {u.price_text}</div> : null}
                    </div>

                    <Button href={`/p/${safeCfg.slug}/request?type=${encodeURIComponent(u.upgrade_key)}`} className="shrink-0">
                      Request →
                    </Button>
                  </div>
                </div>
              ))}

              {!loadingUpgrades && upgrades.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                  No upgrades are currently available.
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="mt-4 text-xs text-white/60">We’ll confirm availability through the Airbnb message thread.</p>
        </div>
      </div>
    );
  }

  // ✅ FORM MODE
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/60">{safeCfg.city}</div>
            <h1 className="mt-1 text-2xl font-bold">Request an Upgrade</h1>
            <p className="mt-2 text-sm text-white/70">Submit your request and we’ll confirm availability.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Button href={`/p/${safeCfg.slug}`} className="w-full">
              Home
            </Button>
            <Button href={`/p/${safeCfg.slug}/request`} className="w-full">
              All upgrades
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Choose an upgrade</h2>
          {loadingUpgrades ? <span className="text-xs text-white/60">Loading…</span> : null}
        </div>

        {upgradesError ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="font-semibold text-white/90">Couldn’t load upgrades</div>
            <div className="mt-1 text-white/70">{upgradesError}</div>
            <p className="mt-2 text-xs text-white/60">You can still submit the form, but the upgrade list may be unavailable.</p>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3">
          {upgrades.map((u) => {
            const active = type === u.upgrade_key;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setType(u.upgrade_key);
                  trackEvent(safeCfg.slug, "upsell_type_select", { type: u.upgrade_key, title: u.title });
                }}
                className={[
                  "w-full rounded-3xl border px-5 py-4 text-left transition-all duration-150",
                  "active:scale-[0.98]",
                  active ? "border-white/25 bg-white/15" : "border-white/10 bg-black/20 hover:bg-white/10 hover:border-white/20",
                ].join(" ")}
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
          <label className="text-sm font-semibold text-white/90">Phone number *</label>
          <input
            value={phone}
            onChange={(e) => setPhone(formatPhoneUS(e.target.value))}
            inputMode="tel"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
            placeholder="(210) 555-0123"
          />
          <p className="mt-2 text-xs text-white/60">We’ll use this to coordinate the request in Airbnb if needed.</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-white/90">Email (optional)</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
            placeholder="you@email.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-white/90">Date (optional)</label>
            <input
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-white/90">Preferred time (optional)</label>
            <select
              value={desiredTime}
              onChange={(e) => setDesiredTime(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-white/25"
            >
              {timeOptions.map((t) => (
                <option key={t.value || "__blank"} value={t.value} className="bg-black">
                  {t.label}
                </option>
              ))}
            </select>
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

        <Button onClick={submit} className={`w-full ${errors.length ? "opacity-40 pointer-events-none" : ""}`} variant="primary">
          ✅ Submit Request
        </Button>

        <p className="mt-3 text-xs text-white/60">We’ll confirm availability in the Airbnb message thread.</p>
      </div>
    </div>
  );
}
