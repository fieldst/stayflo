export function CardRow({
  icon,
  title,
  description,
  rightBadge,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  rightBadge?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon ? <div className="mt-1">{icon}</div> : null}
          <div>
            <div className="text-base font-semibold">{title}</div>
            {description ? (
              <div className="mt-1 text-sm text-white/70">{description}</div>
            ) : null}
          </div>
        </div>

        {rightBadge ? (
          <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
            {rightBadge}
          </span>
        ) : null}
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
