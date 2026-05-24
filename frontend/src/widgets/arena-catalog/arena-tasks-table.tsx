import Link from "next/link";
import {
  Clock,
  Flame,
  Lock,
  Sparkles,
} from "lucide-react";
import {
  Chip,
  DifficultyBadge,
  Panel,
  TaskStatusPill,
} from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { TaskIcon, TOPIC_LABEL } from "@/entities/task";
import type { TaskSummary } from "@/entities/task";

type ArenaTasksTableProps = {
  tasks: TaskSummary[];
  totalCount: number;
  className?: string;
};

/*
 * 8-column grid that survives in ~800px of center-column space:
 *   idx | icon | title+desc+tags | difficulty | reward | time | popularity | status
 *
 * Tags live inline under the description (not in their own column) so the
 * content column still gets meaningful width at 1440px without forcing a
 * horizontal scroll on smaller laptops.
 */
const COLUMNS_CLASS =
  "grid grid-cols-[1.75rem_2.75rem_minmax(0,1fr)_4.75rem_5rem_3.5rem_3.75rem_7rem] items-center gap-2.5";

export function ArenaTasksTable({
  tasks,
  totalCount,
  className,
}: ArenaTasksTableProps) {
  return (
    <Panel className={cn("overflow-hidden", className)}>
      <header className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
        <p className="font-pixel text-[11px] uppercase tracking-[0.22em] text-text">
          <span className="text-text-muted">{totalCount}</span>
          <span className="ml-2 text-text">вызовов найдено</span>
        </p>
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted lg:block">
          1–{tasks.length} из {totalCount}
        </p>
      </header>

      <div
        className={cn(
          COLUMNS_CLASS,
          "hidden border-b border-border-subtle px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted xl:grid",
        )}
        aria-hidden
      >
        <span />
        <span />
        <span />
        <span>Уровень</span>
        <span>Награда</span>
        <span>Время</span>
        <span>Попул.</span>
        <span>Статус</span>
      </div>

      <ol className="divide-y divide-border-subtle/70">
        {tasks.map((task, index) => (
          <li key={task.id}>
            <TaskRow task={task} index={index + 1} />
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function TaskRow({ task, index }: { task: TaskSummary; index: number }) {
  const locked = task.status === "locked";
  const rowClasses = cn(
    "group block px-5 py-3.5 transition-colors",
    locked
      ? "opacity-80 hover:bg-bg-elevated/40"
      : "hover:bg-bg-elevated/70",
  );

  const inner = (
    <div className={cn(COLUMNS_CLASS, "grid")}>
      <span className="font-mono text-[12px] tabular-nums text-text-muted">
        {String(index).padStart(2, "0")}
      </span>

      <TaskIcon glyph={task.iconGlyph} tone={task.iconTone} />

      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-[13.5px] font-semibold transition-colors",
            locked
              ? "text-text-dim"
              : "text-text group-hover:text-primary-soft",
          )}
        >
          {task.title}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-text-muted">
          {task.shortDescription}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {task.topics.slice(0, 2).map((topic) => (
            <Chip key={topic} tone="neutral">
              {TOPIC_LABEL[topic] ?? topic}
            </Chip>
          ))}
        </div>
      </div>

      <DifficultyBadge difficulty={task.difficulty} className="hidden xl:inline-flex" />

      <Chip tone="gold" className="hidden xl:inline-flex">
        <Sparkles className="size-3" aria-hidden /> +{task.xpReward} XP
      </Chip>

      <span className="hidden items-center gap-1 font-mono text-[11px] tabular-nums text-text-dim xl:inline-flex">
        <Clock className="size-3 text-text-muted" aria-hidden />~
        {task.estimatedMinutes}м
      </span>

      <span className="hidden items-center gap-1 font-mono text-[11px] tabular-nums text-text-dim xl:inline-flex">
        <Flame
          className={cn(
            "size-3",
            task.popularity >= 90 ? "text-accent-gold" : "text-text-muted",
          )}
          aria-hidden
        />
        {task.popularity}%
      </span>

      <StatusCell task={task} />
    </div>
  );

  return locked ? (
    <div className={rowClasses} aria-disabled>
      {inner}
    </div>
  ) : (
    <Link href={`/arena/tasks/${task.slug}`} className={rowClasses}>
      {inner}
    </Link>
  );
}

function StatusCell({ task }: { task: TaskSummary }) {
  if (task.status === "locked") {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated/60 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        <Lock className="size-3" aria-hidden />
        <span className="flex flex-col leading-tight">
          <span>Закрыто</span>
          {task.unlockHint ? (
            <span className="font-mono text-[8px] tracking-[0.1em] text-text-muted/80">
              {task.unlockHint}
            </span>
          ) : null}
        </span>
      </span>
    );
  }
  return <TaskStatusPill status={task.status} />;
}
