import Link from "next/link";
import { ArrowRight, Clock, Layers, Sparkles } from "lucide-react";
import { Panel, ProgressBar } from "@/shared/ui";
import { TaskIcon } from "@/entities/task";
import type { CollectionAccent, CollectionSummary } from "@/entities/collection";
import { cn } from "@/shared/lib/cn";

const ACCENT_GLOW: Record<CollectionAccent, string> = {
  purple:
    "shadow-[0_0_60px_-30px_var(--color-primary)] hover:border-primary/40",
  gold: "shadow-[0_0_60px_-30px_var(--color-accent-gold)] hover:border-accent-gold/40",
  cyan: "shadow-[0_0_60px_-30px_var(--color-accent-cyan)] hover:border-accent-cyan/40",
  green:
    "shadow-[0_0_60px_-30px_var(--color-accent-green)] hover:border-accent-green/40",
};

const ACCENT_BAR: Record<CollectionAccent, "primary" | "gold" | "cyan" | "green"> =
  {
    purple: "primary",
    gold: "gold",
    cyan: "cyan",
    green: "green",
  };

const ACCENT_LABEL_COLOR: Record<CollectionAccent, string> = {
  purple: "text-primary-soft",
  gold: "text-accent-gold",
  cyan: "text-accent-cyan",
  green: "text-accent-green",
};

const ACCENT_HOVER_TITLE: Record<CollectionAccent, string> = {
  purple: "group-hover:text-primary-soft",
  gold: "group-hover:text-accent-gold",
  cyan: "group-hover:text-accent-cyan",
  green: "group-hover:text-accent-green",
};

type ArenaCollectionsSidebarProps = {
  collections: CollectionSummary[];
  className?: string;
};

export function ArenaCollectionsSidebar({
  collections,
  className,
}: ArenaCollectionsSidebarProps) {
  return (
    <aside className={cn("flex flex-col gap-3", className)}>
      <header className="flex items-center gap-2 px-1 pt-0.5">
        <Layers className="size-3.5 text-text-muted" aria-hidden />
        <h3 className="font-pixel text-[11px] uppercase tracking-[0.22em] text-text">
          Подборки
        </h3>
      </header>

      <ul className="flex flex-col gap-3">
        {collections.map((c) => (
          <li key={c.id}>
            <CollectionCard collection={c} />
          </li>
        ))}
      </ul>

      <BonusTreasureCard />
    </aside>
  );
}

function CollectionCard({ collection }: { collection: CollectionSummary }) {
  const hours = Math.floor(collection.totalMinutes / 60);
  const minutes = collection.totalMinutes % 60;
  const timeLabel =
    hours > 0
      ? minutes > 0
        ? `${hours}ч ${minutes}м`
        : `${hours}ч`
      : `${minutes}м`;

  return (
    <Link
      href={`/arena/collections/${collection.slug}`}
      className={cn(
        "group block rounded-xl border border-border-subtle bg-bg-panel p-4 transition-colors",
        ACCENT_GLOW[collection.accent],
      )}
    >
      <div className="flex items-start gap-3">
        <TaskIcon glyph={collection.iconGlyph} tone={collection.iconTone} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "line-clamp-2 font-pixel text-[11px] uppercase leading-tight tracking-[0.08em] text-text",
              ACCENT_HOVER_TITLE[collection.accent],
            )}
          >
            {collection.title}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] text-text-dim">
            {collection.subtitle}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
        <span className="inline-flex items-center gap-1">
          <Layers className="size-3" aria-hidden />
          {collection.taskCount} задач
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" aria-hidden />
          {timeLabel}
        </span>
        <span
          className={cn(
            "ml-auto font-pixel tracking-[0.06em]",
            ACCENT_LABEL_COLOR[collection.accent],
          )}
        >
          {collection.progress}%
        </span>
      </div>

      <ProgressBar
        value={collection.progress}
        tone={ACCENT_BAR[collection.accent]}
        className="mt-2"
      />
    </Link>
  );
}

function BonusTreasureCard() {
  return (
    <Panel
      className="relative overflow-hidden border-accent-gold/30"
      glow
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.18),transparent_55%)]"
      />
      <div className="relative flex items-start gap-3 p-4">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-md border border-accent-gold/40 bg-accent-gold/10 text-accent-gold shadow-[0_0_24px_-12px_var(--color-accent-gold)]"
        >
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-snug text-text">
            Завершай подборки и получай{" "}
            <span className="text-accent-gold">бонусные XP</span> и значки!
          </p>
          <Link
            href="/arena/collections"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-soft transition-colors hover:text-primary"
          >
            Все подборки
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
      </div>
    </Panel>
  );
}
