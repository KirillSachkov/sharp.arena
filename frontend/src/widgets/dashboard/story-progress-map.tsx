import Link from "next/link";
import { Check, Lock, Sword } from "lucide-react";
import { Panel, PanelBody, PanelHeader, ProgressBar } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import type { ChapterSummary } from "@/entities/chapter";

const TONE_RING: Record<NonNullable<ChapterSummary["nodeTone"]>, string> = {
  primary: "border-primary/70 shadow-[0_0_24px_-8px_var(--color-primary)]",
  gold: "border-accent-gold/70",
  cyan: "border-accent-cyan/70",
  green: "border-accent-green/70",
  red: "border-accent-red/70 shadow-[0_0_24px_-8px_var(--color-accent-red)]",
};

const DASHBOARD_CHAPTER_PREVIEW: ChapterSummary[] = [
  { id: "d-ch-1", actId: "d-act-1", slug: "variables", index: 1,
    title: "Переменные", status: "completed", xpReward: 10,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 0, y: 0 }, prerequisiteChapterIds: [] },
  { id: "d-ch-2", actId: "d-act-1", slug: "conditions", index: 2,
    title: "Условия", status: "completed", xpReward: 10,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 0, y: 0 }, prerequisiteChapterIds: ["d-ch-1"] },
  { id: "d-ch-3", actId: "d-act-1", slug: "loops", index: 3,
    title: "Циклы", status: "completed", xpReward: 20,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 0, y: 0 }, prerequisiteChapterIds: ["d-ch-2"] },
  { id: "d-ch-4", actId: "d-act-2", slug: "methods", index: 4,
    title: "Методы", status: "completed", xpReward: 20,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 0, y: 0 }, prerequisiteChapterIds: ["d-ch-3"] },
  { id: "d-ch-5", actId: "d-act-2", slug: "collections", index: 5,
    title: "Коллекции", status: "completed", xpReward: 20,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 0, y: 0 }, prerequisiteChapterIds: ["d-ch-4"] },
  { id: "d-ch-6", actId: "d-act-2", slug: "linq", index: 6,
    title: "LINQ", status: "in-progress", xpReward: 25,
    nodeType: "regular", nodeTone: "cyan",
    mapPosition: { x: 0, y: 0 }, prerequisiteChapterIds: ["d-ch-5"] },
  { id: "d-ch-7", actId: "d-act-3", slug: "oop", index: 7,
    title: "ООП", status: "in-progress", xpReward: 30,
    nodeType: "regular", nodeTone: "primary",
    mapPosition: { x: 0, y: 0 }, prerequisiteChapterIds: ["d-ch-6"] },
  { id: "d-ch-8", actId: "d-act-4", slug: "boss", index: 8,
    title: "Финальный босс", status: "locked", xpReward: 100,
    nodeType: "boss", nodeTone: "red",
    mapPosition: { x: 0, y: 0 }, prerequisiteChapterIds: ["d-ch-7"] },
];

function ChapterNode({
  chapter,
  isCurrent,
}: {
  chapter: ChapterSummary;
  isCurrent: boolean;
}) {
  const locked = chapter.status === "locked";
  const completed = chapter.status === "completed";
  const isBoss = chapter.nodeType === "boss";
  const ring =
    chapter.nodeTone && !locked ? TONE_RING[chapter.nodeTone] : "border-border-subtle";

  return (
    <li className="relative flex shrink-0 flex-col items-center gap-2 text-center">
      <div
        className={cn(
          "relative grid place-items-center rounded-lg border bg-bg-elevated/60 font-display text-sm",
          isBoss ? "size-20" : "size-16",
          ring,
          locked && "opacity-60 text-text-muted",
          isCurrent && "ring-2 ring-primary/40 ring-offset-2 ring-offset-bg-panel",
        )}
      >
        {locked ? (
          <Lock className="size-5" aria-hidden />
        ) : isBoss ? (
          <Sword className="size-7" aria-hidden />
        ) : (
          chapter.index
        )}
        {completed ? (
          <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-bg-panel bg-accent-green text-bg-deep">
            <Check className="size-3" aria-hidden strokeWidth={3} />
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
  const chapters = DASHBOARD_CHAPTER_PREVIEW;
  const completedChapters = chapters.filter((c) => c.status === "completed").length;
  const currentChapter =
    chapters.find((c) => c.status === "in-progress") ?? chapters[0]!;
  const overallPct = Math.round((completedChapters / chapters.length) * 100);

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
