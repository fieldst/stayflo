import { getPropertyConfig } from "@/lib/property";

export function PropertyBadge({ slug }: { slug: string }) {
  const cfg = getPropertyConfig(slug);

  if (!cfg) return null;

  // You can change these labels to match your brand voice
  const title =
    cfg.slug === "lamar" ? "Lamar Street" :
    cfg.slug === "gabriel" ? "Gabriel Street" :
    cfg.name ?? cfg.slug;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-5">
      <div className="text-xs uppercase tracking-wide text-white/60">{cfg.city}</div>
      <div className="mt-1 text-2xl font-bold text-white">{title}</div>
      <div className="mt-1 text-sm text-white/70">
        You’re viewing the guide for <span className="font-semibold">{title}</span>.
      </div>
    </div>
  );
}
