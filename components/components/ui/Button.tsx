import Link from "next/link";
import clsx from "clsx";

type ButtonProps = {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export function Button({
  href,
  onClick,
  children,
  variant = "secondary",
  className,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-150 focus:outline-none";

  const variants = {
    primary:
      "bg-white text-black hover:bg-white/90 active:scale-[0.97] active:bg-white",
    secondary:
      "border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:border-white/25 active:bg-white/20 active:scale-[0.97]",
  };

  const classes = clsx(base, variants[variant], className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
