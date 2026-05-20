import type { Metadata } from "next";
import { LayoutGrid, ListChecks, Trophy } from "lucide-react";
import {
  Panel,
  PanelHeader,
  PanelBody,
  PageHeader,
  StatTile,
} from "@/shared/ui";
import { MOCK_TASKS, TaskListRow } from "@/entities/task";
import { ArenaFilterBar } from "@/widgets/arena-catalog";

export const metadata: Metadata = {
  title: "Арена",
};

export default function ArenaPage() {
  const total = MOCK_TASKS.length;
  const solved = MOCK_TASKS.filter(
    (t) => t.status === "solved" || t.status === "perfect",
  ).length;
  const totalXp = MOCK_TASKS.filter(
    (t) => t.status === "solved" || t.status === "perfect",
  ).reduce((acc, t) => acc + t.xpReward, 0);

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <PageHeader title="Арена" subtitle="Свободная практика" />
        <PanelBody className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatTile
            label="Задач доступно"
            value={total}
            tone="purple"
            icon={<LayoutGrid className="size-4" aria-hidden />}
          />
          <StatTile
            label="Решено"
            value={`${solved}/${total}`}
            tone="green"
            icon={<ListChecks className="size-4" aria-hidden />}
          />
          <StatTile
            label="XP за арену"
            value={`${totalXp.toLocaleString()} XP`}
            tone="gold"
            icon={<Trophy className="size-4" aria-hidden />}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelBody className="space-y-4">
          <ArenaFilterBar />
        </PanelBody>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Сражения"
          trailing={
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              {total} задач
            </span>
          }
        />
        <PanelBody className="p-0">
          {MOCK_TASKS.map((task) => (
            <TaskListRow key={task.id} task={task} />
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
