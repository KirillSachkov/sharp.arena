import { cn } from "@/shared/lib/cn";

type XpBarProps = {
  currentXp: number;
  nextLevelXp: number;
  level?: number;
  className?: string;
  showLabel?: boolean;
};

export function XpBar({
  currentXp,
  nextLevelXp,
  level,
  className,
  showLabel = true,
}: XpBarProps) {
  const pct = nextLevelXp > 0 ? Math.min(100, (currentXp / nextLevelXp) * 100) : 0;
  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      {showLabel ? (
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          <span>{level != null ? `Level ${level}` : "XP"}</span>
          <span className="tabular-nums text-text-dim">
            {currentXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
          </span>
        </div>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full border border-border-subtle bg-bg-elevated">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary via-primary-soft to-accent-gold shadow-[0_0_12px_-4px_var(--color-primary)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  tone = "primary",
  className,
}: {
  value: number;
  max?: number;
  tone?: "primary" | "gold" | "green" | "cyan";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = {
    primary: "from-primary to-primary-soft",
    gold: "from-accent-gold/80 to-accent-gold",
    green: "from-accent-green/70 to-accent-green",
    cyan: "from-accent-cyan/70 to-accent-cyan",
  }[tone];
  return (
    <div
      className={cn(
        "h-1.5 overflow-hidden rounded-full border border-border-subtle bg-bg-elevated",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full bg-gradient-to-r", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
