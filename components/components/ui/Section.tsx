export function Section({
  title,
  badge,
  children,
}: {
  title?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      {(title || badge) && (
        <div className="mb-3 flex items-center justify-between">
          {title ? <h2 className="text-lg font-semibold">{title}</h2> : <div />}
          {badge ? (
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
              {badge}
            </span>
          ) : null}
        </div>
      )}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
        {children}
      </div>
    </section>
  );
}
