// app/p/[property]/layout.tsx

import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { getPropertyConfig } from "@/lib/property";
import AdminBarGate from "@/components/AdminBarGate";

type LayoutProps = {
  children: React.ReactNode;
  params: any;
};

const ADMIN_COOKIE = "stayflo_admin";

export default async function PropertyLayout({ children, params }: LayoutProps) {
  const resolvedParams = await Promise.resolve(params);
  const slug = String(resolvedParams?.property || "");

  const cfg = getPropertyConfig(slug);
  const logoUrl = cfg?.brand?.logoUrl;

  const homeHref = slug ? `/p/${slug}` : "/p/lamar";

  // ✅ If logged in, do NOT show Host Login button
  const jar = await cookies();
  const val = jar.get(ADMIN_COOKIE)?.value;
  const isAuthed = val === "1" || val === "true";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 🔐 Admin-only top bar */}
      <AdminBarGate />

      {/* Sticky global header */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto w-full max-w-lg px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            {logoUrl ? (
              <div className="relative h-28 w-[30rem] sm:h-32 sm:w-[36rem]">
                <Image
                  src={logoUrl}
                  alt="Fields of Comfort Stays"
                  fill
                  priority
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="text-sm font-semibold tracking-wide">
                Fields of Comfort Stays
              </div>
            )}

  <div className="shrink-0 flex items-center gap-3">
  {/* Home — primary */}
  <Link
    href={homeHref}
    className="
      inline-flex items-center justify-center
      rounded-full
      bg-white text-black
      px-4 py-2
      text-xs font-semibold
      shadow-md
      transition
      hover:opacity-90
      active:scale-[0.98]
    "
  >
    Home
  </Link>

  {/* Host Login — secondary */}
  {!isAuthed ? (
    <Link
      href="/host"
      className="
        inline-flex items-center justify-center
        rounded-full
        border border-white/30
        bg-black/60
        px-4 py-2
        text-xs font-semibold text-white
        shadow-[0_0_0_1px_rgba(255,255,255,0.05)]
        transition
        hover:bg-white hover:text-black
        active:scale-[0.98]
      "
    >
      Host Login
    </Link>
  ) : null}
</div>
          </div>
        </div>
      </div>

      <main>{children}</main>
    </div>
  );
}