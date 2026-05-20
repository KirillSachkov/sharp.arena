import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: "sm" | "md";
  badge?: boolean;
  children: ReactNode;
};

/**
 * Small icon-only button used in the top nav (code editor, notifications)
 * and toolbar areas. The `label` prop is required for accessibility.
 */
export function IconButton({
  label,
  size = "md",
  badge = false,
  className,
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "relative grid place-items-center rounded-md border border-border-subtle bg-bg-elevated text-text-dim transition-colors hover:border-primary/40 hover:text-text",
        size === "sm" ? "size-8" : "size-9",
        className,
      )}
      {...rest}
    >
      {children}
      {badge ? (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent-red shadow-[0_0_0_2px_var(--color-bg-elevated)]"
        />
      ) : null}
    </button>
  );
}
