import { Swords } from "lucide-react";

/**
 * Compact left-aligned hero for the arena catalog: pixel-tile swords icon +
 * "АРЕНА" wordmark + tagline. Lives flush with the toolbar so the page reads
 * like one continuous control strip rather than a separate cover.
 */
export function ArenaPageHero() {
  return (
    <div className="flex items-center gap-4">
      <span
        aria-hidden
        className="grid size-14 shrink-0 place-items-center rounded-xl border border-primary/50 bg-primary/10 text-primary-soft shadow-[0_0_36px_-12px_var(--color-primary)]"
      >
        <Swords className="size-7" strokeWidth={1.6} />
      </span>
      <div className="min-w-0">
        <h1 className="font-pixel text-[clamp(1.5rem,3.2vw,2.25rem)] uppercase tracking-[0.06em] text-text">
          Арена
        </h1>
        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-text-muted">
          Выбери следующий вызов
        </p>
      </div>
    </div>
  );
}
