import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
  glow?: boolean;
};

export function Panel({
  className,
  children,
  inset = false,
  glow = false,
  ...rest
}: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-border-subtle shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        inset ? "bg-bg-elevated" : "bg-bg-panel",
        glow && "shadow-[0_0_60px_-30px_var(--color-primary),inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

type PanelHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  leading?: ReactNode;
  className?: string;
};

export function PanelHeader({
  title,
  subtitle,
  trailing,
  leading,
  className,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="flex min-w-0 items-baseline gap-3">
          <h3 className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-text">
            {title}
          </h3>
          {subtitle != null ? (
            <span className="truncate text-xs uppercase tracking-[0.15em] text-text-muted">
              {subtitle}
            </span>
          ) : null}
        </div>
      </div>
      {trailing != null ? (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      ) : null}
    </div>
  );
}

export function PanelBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
