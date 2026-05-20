import { notFound } from "next/navigation";
import { Maximize2, Moon } from "lucide-react";
import { DifficultyBadge, PageHeader } from "@/shared/ui";
import { getTaskBySlug } from "@/entities/task";
import {
  TaskEditorPanel,
  TaskStatementPanel,
  TaskTestsPanel,
} from "@/widgets/task-workspace";

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = getTaskBySlug(id);
  return {
    title: task ? task.title : "Task",
  };
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = getTaskBySlug(id);
  if (!task) notFound();

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-7.5rem)] lg:min-h-[640px]">
      <PageHeader
        backHref="/arena"
        backLabel="Арена"
        title={task.title}
        trailing={
          <>
            <DifficultyBadge difficulty={task.difficulty} />
            <button
              type="button"
              aria-label="Переключить тему"
              className="hidden size-9 place-items-center rounded-md border border-border-subtle bg-bg-elevated text-text-dim hover:text-text sm:grid"
            >
              <Moon className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="На весь экран"
              className="hidden size-9 place-items-center rounded-md border border-border-subtle bg-bg-elevated text-text-dim hover:text-text sm:grid"
            >
              <Maximize2 className="size-4" aria-hidden />
            </button>
          </>
        }
        className="rounded-xl border border-border-subtle bg-bg-panel"
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <TaskStatementPanel task={task} />
        <div className="grid min-h-0 grid-rows-[auto_auto] gap-4 lg:grid-rows-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <TaskEditorPanel task={task} />
          <TaskTestsPanel />
        </div>
      </div>
    </div>
  );
}
