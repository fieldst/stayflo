"use client";

import Link from "next/link";
import { useMemo, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import AdminMoreMenu from "@/components/AdminMoreMenu";

type PropertyOption = { slug: string; label: string };

const PROPERTIES: PropertyOption[] = [
  { slug: "gabriel", label: "Gabriel" },
  { slug: "lamar", label: "Lamar" },
];

function firstPathSegment(pathname: string): string {
  return pathname.split("/").filter(Boolean)[0] || "";
}
function secondPathSegment(pathname: string): string {
  return pathname.split("/").filter(Boolean)[1] || "";
}
function withUpdatedQuery(current: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(current.toString());
  next.set(key, value);
  return next.toString();
}

export default function AdminBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const section = useMemo(() => firstPathSegment(pathname), [pathname]);
  const propertyFromGuestRoute = useMemo(
    () => (section === "p" ? secondPathSegment(pathname) : ""),
    [pathname, section]
  );
  const propertyFromQuery = searchParams.get("property") || "";

  const activeProperty = useMemo(() => {
    const candidate = propertyFromGuestRoute || propertyFromQuery || "lamar";
    return PROPERTIES.some((p) => p.slug === candidate) ? candidate : "lamar";
  }, [propertyFromGuestRoute, propertyFromQuery]);

  const isOnAdmin = section === "host";

  const guestHubHref = useMemo(() => `/p/${activeProperty}`, [activeProperty]);

  const hostHomeHref = useMemo(() => {
    const qs = withUpdatedQuery(searchParams, "property", activeProperty);
    return `/host${qs ? `?${qs}` : ""}`;
  }, [searchParams, activeProperty]);

  const upgradesHref = useMemo(() => {
    const qs = withUpdatedQuery(searchParams, "property", activeProperty);
    return `/host/upgrades${qs ? `?${qs}` : ""}`;
  }, [searchParams, activeProperty]);

  const propertySwitcherLinks = useMemo(() => {
    return PROPERTIES.map((p) => {
      if (isOnAdmin) {
        const qs = withUpdatedQuery(searchParams, "property", p.slug);
        return { ...p, href: `${pathname}${qs ? `?${qs}` : ""}` };
      }
      return { ...p, href: `/p/${p.slug}` };
    });
  }, [isOnAdmin, pathname, searchParams]);

  const pillBase =
    "whitespace-nowrap rounded-full border border-white/10 bg-white/5 text-white/80 " +
    "transition hover:bg-white/10 hover:text-white";
  const pillCompact = "px-2.5 py-1 text-[11px] leading-none";
  const pillClass = `${pillBase} ${pillCompact}`;

  // ✅ HARD logout: clear cookie, then force full refresh to guest hub
  const onLogout = useCallback(async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // Even if fetch fails, still force guest redirect to break out of admin UI
    }
    window.location.href = guestHubHref;
  }, [guestHubHref]);

  return (
    <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-2.5 py-2">
        <div className="flex items-center gap-2">
          {/* Property switcher */}
          <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-0.5 shrink-0">
            {propertySwitcherLinks.map((p) => {
              const active = p.slug === activeProperty;
              return (
                <Link
                  key={p.slug}
                  href={p.href}
                  className={[
                    "rounded-full px-2.5 py-1 text-[11px] leading-none transition whitespace-nowrap",
                    active
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Right nav */}
          <div className="shrink-0">
            {/* MOBILE */}
            <div className="flex items-center gap-1.5 sm:hidden">
              <Link href={guestHubHref} className={pillClass} title="Back to Guest Hub">
                Guest
              </Link>
              <Link href={hostHomeHref} className={pillClass} title="Host Home">
                Host
              </Link>

              <AdminMoreMenu
                pillClass={pillClass}
                items={[
                  { href: "/host/guides", label: "Guides", title: "Manage Guide PDFs" },
                  { href: upgradesHref, label: "Upgrades", title: "Manage Upgrades" },
                  { href: "/host/wifi", label: "Wi-Fi", title: "Manage Wi-Fi & Tech" },
                  { label: "Logout", title: "Logout", onClick: onLogout },
                ]}
              />
            </div>

            {/* DESKTOP */}
            <div className="hidden sm:flex items-center gap-1.5">
              <Link href={guestHubHref} className={pillClass} title="Back to Guest Hub">
                Guest
              </Link>
              <Link href={hostHomeHref} className={pillClass} title="Host Home">
                Host
              </Link>
              <Link href="/host/guides" className={pillClass} title="Manage Guide PDFs">
                Guides
              </Link>
              <Link href={upgradesHref} className={pillClass} title="Manage Upgrades">
                Upgrades
              </Link>
              <Link href="/host/wifi" className={pillClass} title="Manage Wi-Fi & Tech">
                Wi-Fi
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className={pillClass}
                title="Logout"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}