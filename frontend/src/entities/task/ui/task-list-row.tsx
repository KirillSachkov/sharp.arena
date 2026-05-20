import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { Chip, DifficultyBadge, TaskStatusPill } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import type { TaskSummary, TaskTopic } from "../types";

const TOPIC_LABEL: Record<TaskTopic, string> = {
  arrays: "Массивы",
  strings: "Строки",
  "hash-map": "Хеш-таблица",
  "linked-list": "Связный список",
  "binary-search": "Бинарный поиск",
  "dynamic-programming": "ДП",
  graphs: "Графы",
  trees: "Деревья",
  math: "Математика",
};

export function TaskListRow({
  task,
  className,
}: {
  task: TaskSummary;
  className?: string;
}) {
  return (
    <Link
      href={`/arena/tasks/${task.slug}`}
      className={cn(
        "group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border-subtle/60 px-3 py-3 transition-colors last:border-b-0 hover:bg-bg-elevated/60 sm:gap-4 sm:px-5 sm:py-3.5",
        className,
      )}
    >
      <DifficultyBadge difficulty={task.difficulty} />

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text group-hover:text-primary-soft">
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {task.topics.slice(0, 2).map((topic) => (
            <Chip key={topic} tone="neutral">
              {TOPIC_LABEL[topic] ?? topic}
            </Chip>
          ))}
          <span className="ml-1 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted sm:inline">
            {task.acceptanceRate.toFixed(1).replace(".", ",")}% точн. · решили {task.solvedBy.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <TaskStatusPill status={task.status} className="hidden sm:inline-flex" />
        <Chip tone="gold">
          <Sparkles className="size-3" aria-hidden /> +{task.xpReward} XP
        </Chip>
        <ChevronRight
          className="size-4 text-text-muted transition-colors group-hover:text-primary-soft"
          aria-hidden
        />
      </div>
    </Link>
  );
}
