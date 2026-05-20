"use client";

import { useState } from "react";
import { Play, RotateCcw, Settings2 } from "lucide-react";
import { Button, CodeFrame, Panel, VictoryOverlay } from "@/shared/ui";
import type { TaskDetail } from "@/entities/task";

export function TaskEditorPanel({ task }: { task: TaskDetail }) {
  const [victoryOpen, setVictoryOpen] = useState(true);

  return (
    <Panel className="relative flex min-h-[420px] flex-col overflow-hidden lg:h-full lg:min-h-0">
      <div className="min-h-0 flex-1 p-4">
        <CodeFrame
          lines={task.starterCode}
          filename="Program.cs"
          language="csharp"
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border-subtle bg-bg-elevated/40 p-3">
        <Button variant="secondary" size="sm" leading={<RotateCcw className="size-3.5" aria-hidden />}>
          Сброс
        </Button>
        <Button
          variant="primary"
          size="md"
          leading={<Play className="size-4" aria-hidden />}
          onClick={() => setVictoryOpen(true)}
        >
          Запуск
        </Button>
        <button
          type="button"
          aria-label="Настройки редактора"
          className="grid size-10 place-items-center rounded-md border border-border-subtle bg-bg-elevated text-text-dim transition-colors hover:text-text"
        >
          <Settings2 className="size-4" aria-hidden />
        </button>
      </div>

      {victoryOpen ? (
        <VictoryOverlay
          xpEarned={task.xpReward}
          onClose={() => setVictoryOpen(false)}
        />
      ) : null}
    </Panel>
  );
}
