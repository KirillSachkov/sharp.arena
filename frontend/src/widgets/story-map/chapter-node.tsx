import { Lock, Sword } from "lucide-react";
import type { ChapterSummary } from "@/entities/chapter";
import { cn } from "@/shared/lib/cn";

type Props = {
  chapter: ChapterSummary;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

const TONE_RING: Record<NonNullable<ChapterSummary["nodeTone"]>, string> = {
  primary: "border-primary/70 bg-primary/15 text-primary-soft",
  gold:    "border-accent-gold/70 bg-accent-gold/10 text-accent-gold",
  cyan:    "border-accent-cyan/70 bg-accent-cyan/10 text-accent-cyan",
  green:   "border-accent-green/70 bg-accent-green/10 text-accent-green",
  red:     "border-accent-red/70 bg-accent-red/10 text-accent-red",
};

export function ChapterNode({ chapter, isSelected, onSelect }: Props) {
  const isLocked = chapter.status === "locked";
  const isBoss = chapter.nodeType === "boss";
  const toneClass = chapter.nodeTone
    ? TONE_RING[chapter.nodeTone]
    : "border-border-subtle bg-bg-elevated text-text-dim";

  return (
    <button
      type="button"
      onClick={() => onSelect(chapter.id)}
      disabled={isLocked}
      style={{ left: `${chapter.mapPosition.x}%`, top: `${chapter.mapPosition.y}%` }}
      className={cn(
        "group absolute -translate-x-1/2 -translate-y-1/2 transition-transform",
        !isLocked && "hover:scale-105",
        isSelected && "scale-110",
      )}
      aria-label={`Глава ${chapter.index}: ${chapter.title}`}
    >
      <span
        className={cn(
          "grid place-items-center rounded-lg border-2 font-display text-base shadow-lg backdrop-blur-sm",
          isBoss ? "size-16" : "size-12",
          toneClass,
          isSelected && "ring-2 ring-offset-2 ring-offset-bg-deep ring-primary",
          isLocked && "border-border-subtle/60 bg-bg-deep/80 text-text-muted",
        )}
      >
        {isLocked ? (
          <Lock className="size-4" aria-hidden />
        ) : isBoss ? (
          <Sword className="size-6" aria-hidden />
        ) : (
          chapter.index
        )}
      </span>
      <span className="absolute top-full left-1/2 mt-1 flex -translate-x-1/2 flex-col items-center gap-0.5 whitespace-nowrap rounded-md border border-border-subtle bg-bg-deep/90 px-2 py-1 text-[11px] font-semibold text-text shadow-md backdrop-blur">
        <span>{chapter.title}</span>
        <span className="font-mono text-[10px] text-text-dim tabular-nums">
          +{chapter.xpReward} XP
        </span>
      </span>
    </button>
  );
}
