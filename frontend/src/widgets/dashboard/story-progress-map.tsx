import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { Panel, PanelBody, PanelHeader, PixelArtSlot, ProgressBar } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { MOCK_CHAPTERS, type ChapterSummary } from "@/entities/chapter";

const toneRing: Record<NonNullable<ChapterSummary["tone"]>, string> = {
  primary: "border-primary/70 shadow-[0_0_24px_-8px_var(--color-primary)]",
  gold: "border-accent-gold/70",
  cyan: "border-accent-cyan/70",
  green: "border-accent-green/70",
  red: "border-accent-red/70 shadow-[0_0_24px_-8px_var(--color-accent-red)]",
};

function ChapterNode({
  chapter,
  isCurrent,
}: {
  chapter: ChapterSummary;
  isCurrent: boolean;
}) {
  const locked = chapter.status === "locked";
  const completed = chapter.status === "completed";
  const ring =
    chapter.tone && !locked ? toneRing[chapter.tone] : "border-border-subtle";

  return (
    <li className="relative flex shrink-0 flex-col items-center gap-2 text-center">
      <div
        className={cn(
          "relative grid place-items-center rounded-lg border",
          chapter.isBoss ? "size-20" : "size-16",
          ring,
          locked && "opacity-60",
          isCurrent && "ring-2 ring-primary/40 ring-offset-2 ring-offset-bg-panel",
        )}
      >
        {/*
         * Pixel-art node icon — drop a 32×32 png at `public/art/<nodeSlot>.png`.
         * Slot keys live in the Chapter entity mock data:
         *   icon/story-node-castle / hexagon / warrior / locked / boss
         */}
        <PixelArtSlot
          slot={chapter.nodeSlot}
          src={chapter.nodeAsset}
          size={chapter.isBoss ? 64 : 48}
          label={String(chapter.index)}
          className="size-full rounded-md border-0 bg-bg-elevated/60"
        />
        {completed ? (
          <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-bg-panel bg-accent-green text-bg-deep">
            <Check className="size-3" aria-hidden strokeWidth={3} />
          </span>
        ) : null}
        {locked ? (
          <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-bg-panel bg-bg-elevated text-text-muted">
            <Lock className="size-2.5" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="w-20">
        <p className="line-clamp-2 text-center text-[10px] leading-tight text-text-muted">
          <span className="font-mono">{chapter.index}.</span> {chapter.title}
        </p>
      </div>
    </li>
  );
}

export function StoryProgressMap() {
  const chapters = MOCK_CHAPTERS;
  const completedChapters = chapters.filter((c) => c.status === "completed").length;
  const currentChapter =
    chapters.find((c) => c.status === "in-progress") ?? chapters[0];
  const overallPct = Math.round(
    (chapters.reduce((acc, c) => acc + c.tasksCompleted, 0) /
      chapters.reduce((acc, c) => acc + c.tasksTotal, 0)) *
      100,
  );

  return (
    <Panel className="h-full overflow-hidden">
      <PanelHeader
        title="Прогресс истории"
        trailing={
          <Link
            href="/story"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim hover:text-text"
          >
            Глава {currentChapter.index} из {chapters.length}
          </Link>
        }
      />
      <PanelBody className="space-y-5">
        <div className="relative">
          {/* Dotted connecting path */}
          <div
            aria-hidden
            className="absolute left-8 right-8 top-8 hidden h-px bg-[radial-gradient(circle,var(--color-text-muted)_1px,transparent_1.5px)] bg-[length:8px_8px] bg-repeat-x sm:block"
          />
          <ul className="relative flex items-start justify-between gap-2 overflow-x-auto pb-2 sm:gap-0">
            {chapters.map((c) => (
              <ChapterNode
                key={c.id}
                chapter={c}
                isCurrent={c.id === currentChapter.id}
              />
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
            <span>Общий прогресс</span>
            <span className="tabular-nums text-text-dim">
              {overallPct}% завершено · {completedChapters} из {chapters.length} глав
            </span>
          </div>
          <ProgressBar value={overallPct} tone="primary" />
        </div>
      </PanelBody>
    </Panel>
  );
}
