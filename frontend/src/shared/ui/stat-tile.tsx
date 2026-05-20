import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type StatTileProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "purple" | "gold" | "green" | "cyan";
  className?: string;
};

const tones = {
  neutral: "text-text",
  purple: "text-primary-soft",
  gold: "text-accent-gold",
  green: "text-accent-green",
  cyan: "text-accent-cyan",
};

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-2.5 sm:gap-3 sm:px-3.5 sm:py-3",
        className,
      )}
    >
      {icon ? (
        <div className="hidden size-10 shrink-0 place-items-center rounded-md border border-border-subtle bg-bg-panel text-text-dim sm:grid">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted sm:tracking-[0.18em]">
          {label}
        </p>
        <p
          className={cn(
            "truncate font-pixel text-lg uppercase tracking-[0.04em] tabular-nums sm:text-xl",
            tones[tone],
          )}
        >
          {value}
        </p>
        {hint != null ? (
          <p className="truncate text-[11px] text-text-dim">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
