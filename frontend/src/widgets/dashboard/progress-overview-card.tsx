import { Hexagon } from "lucide-react";
import {
  CircularProgress,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
} from "@/shared/ui";
import { MOCK_SKILLS, MOCK_PROGRESS_OVERVIEW } from "@/entities/skill";

export function ProgressOverviewCard() {
  const nextReward = MOCK_PROGRESS_OVERVIEW.nextRewardXp;
  const totalXp = MOCK_PROGRESS_OVERVIEW.totalXp;
  // Visualize "next reward" as remaining-toward-1000-step.
  const stepGoal = 1000;
  const earnedTowardStep = stepGoal - (nextReward % stepGoal);

  return (
    <Panel className="h-full overflow-hidden">
      <PanelHeader title="Обзор прогресса" />
      <PanelBody className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {MOCK_SKILLS.map((s) => (
            <div
              key={s.id}
              className="flex min-w-0 flex-col items-center gap-2 text-center"
            >
              <CircularProgress value={s.value} tone={s.tone} size={72} />
              <div className="min-w-0">
                <p className="line-clamp-2 text-xs font-semibold text-text">
                  {s.label}
                </p>
                <p className="font-mono text-[10px] text-text-muted">
                  {s.level}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Hexagon className="size-3.5 text-primary-soft" aria-hidden />
              Всего XP: <span className="tabular-nums text-text">{totalXp.toLocaleString()}</span>
            </span>
            <span className="tabular-nums text-text-dim">
              До награды {nextReward} XP
            </span>
          </div>
          <ProgressBar
            value={earnedTowardStep}
            max={stepGoal}
            tone="cyan"
          />
        </div>
      </PanelBody>
    </Panel>
  );
}
