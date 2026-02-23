import Image from "next/image";
import Link from "next/link";

export function PublicHeader(props?: { subtitle?: string }) {
  const subtitle =
    props?.subtitle ||
    "A public, location-based concierge that builds time-blocked plans using live Google ratings, travel time, and hidden gems.";

  return (
    <div className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-[#120016] via-[#0b0010] to-black/80 backdrop-blur">
      <div className="mx-auto w-full max-w-3xl px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="min-w-0 flex-1">
            <div className="relative h-20 w-full sm:h-24 sm:w-[40rem]">
              <Image
                src="/brand/foc-logo.png"
                alt="Fields of Comfort Stays"
                fill
                priority
                className="object-contain object-left scale-[1.25] origin-left"
              />
            </div>
          </Link>

          <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            Public Concierge
          </div>
        </div>

        <p className="mt-2 text-sm text-white/70">{subtitle}</p>
      </div>
    </div>
  );
}