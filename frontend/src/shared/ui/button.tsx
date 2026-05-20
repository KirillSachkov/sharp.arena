import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "gold";
type Size = "sm" | "md";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-soft active:bg-primary shadow-[0_0_20px_-12px_var(--color-primary)]",
  secondary:
    "border border-border-subtle bg-bg-elevated text-text hover:border-primary/50 hover:text-primary-soft",
  ghost: "text-text-dim hover:bg-bg-elevated hover:text-text",
  gold: "bg-accent-gold/15 text-accent-gold border border-accent-gold/40 hover:bg-accent-gold/25",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[11px]",
  md: "h-10 px-5 text-xs",
};

export function Button({
  variant = "primary",
  size = "md",
  leading,
  trailing,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {leading}
      <span>{children}</span>
      {trailing}
    </button>
  );
}
