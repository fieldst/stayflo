import Link from "next/link";
import { cookies } from "next/headers";
import HostLoginForm from "@/components/HostLoginForm";

export const runtime = "nodejs";

const COOKIE = "stayflo_admin";

function normalizeProperty(p: unknown) {
  const s = typeof p === "string" ? p : "";
  return s === "lamar" || s === "gabriel" ? s : "lamar";
}

export default async function HostHome({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const jar = await cookies();
  const val = jar.get(COOKIE)?.value;
  const isAuthed = val === "1" || val === "true";

  const activeProperty = normalizeProperty(searchParams?.property);
  const next = typeof searchParams?.next === "string" && searchParams.next.startsWith("/")
    ? searchParams.next
    : `/host?property=${encodeURIComponent(activeProperty)}`;

  if (!isAuthed) {
    return <HostLoginForm propertySlug={activeProperty} nextUrl={next} />;
  }

  // Logged-in Host Portal home
  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest text-white/60">HOST</div>
            <h1 className="mt-1 text-2xl font-semibold">Host Portal</h1>
            <p className="mt-2 text-white/70">Manage upgrades and future host tools.</p>
          </div>

          <Link
            href={`/p/${activeProperty}`}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
            title="Back to Guest Portal"
          >
            Guest Portal
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          <Link
            href={`/host/upgrades?property=${encodeURIComponent(activeProperty)}`}
            className="block w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black transition hover:opacity-90"
          >
            ⚡ Manage Upgrades
          </Link>

          <Link
            href={`/host/guides?property=${encodeURIComponent(activeProperty)}`}
            className="block w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black transition hover:opacity-90"
          >
            📘 Manage Guides
          </Link>

          <Link
            href={`/host/wifi?property=${encodeURIComponent(activeProperty)}`}
            className="block w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black transition hover:opacity-90"
          >
            📶 Manage Wi-Fi & Tech
          </Link>
        </div>

        <div className="mt-4 text-xs text-white/50">Bookmark /host for quick access.</div>
      </div>
    </div>
  );
}