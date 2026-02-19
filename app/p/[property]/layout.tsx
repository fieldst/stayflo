// app/p/[property]/layout.tsx

import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { getPropertyConfig } from "@/lib/property";
import AdminBarGate from "@/components/AdminBarGate";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ property: string }>;
};

const ADMIN_COOKIE = "stayflo_admin";

export default async function PropertyLayout({ children, params }: LayoutProps) {
  const resolvedParams = await params;
  const slug = String(resolvedParams?.property || "");

  const cfg = getPropertyConfig(slug);
  const logoUrl = cfg?.brand?.logoUrl;

  const homeHref = slug ? `/p/${slug}` : "/p/lamar";
  const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL;


  const jar = await cookies();
  const val = jar.get(ADMIN_COOKIE)?.value;
  const isAuthed = val === "1" || val === "true";

  return (
    <div className="min-h-screen bg-black text-white">
      <AdminBarGate />

      <div className="sticky top-0 z-30 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto w-full max-w-lg px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            {logoUrl ? (
              <div className="min-w-0 flex-1">
                <div className="relative h-32 w-full sm:h-36 sm:w-[40rem]">
                  <Image
                    src={logoUrl}
                    alt="Fields of Comfort Stays"
                    fill
                    priority
                    className="object-contain object-left scale-[1.40] origin-left"
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold tracking-wide">
                Fields of Comfort Stays
              </div>
            )}

            <div className="shrink-0 flex items-center gap-3">
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

              {instagramUrl ? (
  <a
    href={instagramUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="
      inline-flex items-center justify-center gap-2
      rounded-full
      border border-purple-400/50
      bg-purple-500/15
      px-3 py-2
      text-xs font-semibold text-white
      shadow-[0_0_16px_rgba(168,85,247,0.35)]
      transition
      hover:bg-purple-500/25
      active:scale-[0.98]
    "
    aria-label="Follow Fields of Comfort Stays on Instagram"
  >
    <svg
      width="14"
      height="14"
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
    Follow Me :)
  </a>
) : null}


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
