import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type Tone = "neutral" | "purple" | "gold" | "green" | "red" | "cyan";

const tones: Record<Tone, string> = {
  neutral: "border-border-subtle bg-bg-elevated text-text-dim",
  purple: "border-primary/40 bg-primary/10 text-primary-soft",
  gold: "border-accent-gold/40 bg-accent-gold/10 text-accent-gold",
  green: "border-accent-green/40 bg-accent-green/10 text-accent-green",
  red: "border-accent-red/40 bg-accent-red/10 text-accent-red",
  cyan: "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan",
};

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-md border px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
