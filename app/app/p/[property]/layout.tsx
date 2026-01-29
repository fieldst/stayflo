// stayflo/app/p/[property]/layout.tsx

import Image from "next/image";
import Link from "next/link";
import { getPropertyConfig } from "@/lib/property";
import AdminBarGate from "@/components/AdminBarGate";

export default function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { property: string };
}) {
  const slug = String(params?.property || "");
  const cfg = getPropertyConfig(slug);
  const logoUrl = cfg?.brand?.logoUrl;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 🔐 Admin-only top bar */}
      <AdminBarGate />

      {/* Sticky global header */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto w-full max-w-lg px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Logo */}
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

            {/* Right: Quick link back to hub home */}
            <div className="flex items-center gap-2">
            <Link
              href={`/p/${slug}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/host"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
              title="Host login"
            >
              Host Login
            </Link>
          </div>
</div>
        </div>
      </div>

      <main>{children}</main>
    </div>
  );
}
