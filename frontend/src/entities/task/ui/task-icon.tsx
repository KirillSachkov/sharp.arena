import { cn } from "@/shared/lib/cn";
import type { TaskIconTone } from "../types";

const TONE_CLASSES: Record<TaskIconTone, string> = {
  purple:
    "border-primary/50 bg-primary/15 text-primary-soft shadow-[0_0_28px_-14px_var(--color-primary)]",
  cyan: "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan shadow-[0_0_28px_-14px_var(--color-accent-cyan)]",
  gold: "border-accent-gold/40 bg-accent-gold/10 text-accent-gold shadow-[0_0_28px_-14px_var(--color-accent-gold)]",
  green:
    "border-accent-green/40 bg-accent-green/10 text-accent-green shadow-[0_0_28px_-14px_var(--color-accent-green)]",
  red: "border-accent-red/40 bg-accent-red/10 text-accent-red shadow-[0_0_28px_-14px_var(--color-accent-red)]",
  blue: "border-sky-400/40 bg-sky-400/10 text-sky-300 shadow-[0_0_28px_-14px_#38bdf8]",
  pink: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300 shadow-[0_0_28px_-14px_#e879f9]",
};

type TaskIconProps = {
  glyph: string;
  tone: TaskIconTone;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Square chip with a single glyph (C#, ∞, λ, Σ, API, …) used as the task
 * row icon in the arena catalog. Glyphs are intentional Unicode characters,
 * not real iconography — they read as 8-bit pixel tokens against the dark
 * panel and keep the asset payload at zero bytes during Phase 0.
 */
export function TaskIcon({
  glyph,
  tone,
  size = "md",
  className,
}: TaskIconProps) {
  const dims = size === "sm" ? "size-9" : "size-11";
  const textSize =
    glyph.length > 2 ? "text-[10px] tracking-[0.04em]" : "text-base";
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-md border font-pixel uppercase",
        dims,
        textSize,
        TONE_CLASSES[tone],
        className,
      )}
    >
      {glyph}
    </span>
  );
}
