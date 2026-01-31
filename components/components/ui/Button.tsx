import Link from "next/link";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "purple" | "request";

type ButtonProps = {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

export function Button({
  href,
  onClick,
  children,
  variant = "secondary",
  className,
  disabled = false,
  type = "button",
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 select-none " +
    "rounded-2xl px-4 py-3 text-sm font-semibold " +
    "transition-all duration-150 focus:outline-none " +
    "active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

  const variants: Record<ButtonVariant, string> = {
    primary: "bg-white text-black hover:bg-white/90 active:bg-white",
    secondary:
      "border border-white/15 bg-white/5 text-white " +
      "hover:bg-white/10 hover:border-white/25 active:bg-white/20",
    purple:
      "border border-[#5A2D82]/45 bg-white/5 text-white " +
      "hover:bg-white/10 hover:border-[#5A2D82]/65 " +
      "[box-shadow:0_0_0_1px_rgba(90,45,130,0.35),0_14px_44px_rgba(90,45,130,0.18)] " +
      "hover:[box-shadow:0_0_0_1px_rgba(90,45,130,0.55),0_18px_54px_rgba(90,45,130,0.26)]",
    request:
      "rounded-full border border-[#5A2D82]/60 bg-[#5A2D82]/25 text-white " +
      "hover:bg-[#5A2D82]/34 hover:border-[#5A2D82]/70 " +
      "[box-shadow:0_0_0_1px_rgba(90,45,130,0.45),0_16px_50px_rgba(90,45,130,0.22)] " +
      "hover:[box-shadow:0_0_0_1px_rgba(90,45,130,0.65),0_20px_60px_rgba(90,45,130,0.30)]",
  };

  const classes = clsx(base, variants[variant], className);

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={classes} type={type} disabled={disabled}>
      {children}
    </button>
  );
}
