import { Check, Lock } from "lucide-react";
import type { ActSummary } from "@/entities/act";
import { Panel, PanelBody, ProgressBar } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type Props = {
  acts: ActSummary[];
};

const STATUS_BORDER: Record<ActSummary["status"], string> = {
  completed: "border-accent-green/40",
  "in-progress": "border-primary/40",
  available: "border-accent-cyan/40",
  locked: "border-border-subtle/60",
};

const STATUS_TONE: Record<
  ActSummary["status"],
  "primary" | "gold" | "green" | "cyan"
> = {
  completed: "green",
  "in-progress": "primary",
  available: "cyan",
  locked: "primary",
};

export function StoryActsBar({ acts }: Props) {
  return (
    <Panel className="overflow-hidden">
      <PanelBody>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Акты кампании
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {acts.map((a) => {
            const isLocked = a.status === "locked";
            return (
              <li
                key={a.id}
                className={cn(
                  "rounded-md border bg-bg-elevated/60 px-4 py-3",
                  STATUS_BORDER[a.status],
                  isLocked && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs uppercase tracking-[0.18em] text-primary-soft">
                    {a.title}
                  </span>
                  {a.status === "completed" ? (
                    <Check className="size-4 text-accent-green" aria-hidden />
                  ) : isLocked ? (
                    <Lock className="size-4 text-text-muted" aria-hidden />
                  ) : null}
                </div>
                {a.subtitle ? (
                  <p className="mt-1 text-sm font-semibold text-text">
                    {a.subtitle}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-text-muted">
                  <ProgressBar
                    value={a.percent}
                    tone={STATUS_TONE[a.status]}
                    className="flex-1"
                  />
                  <span className="ml-3 tabular-nums">{a.percent}%</span>
                </div>
              </li>
            );
          })}
        </ul>
      </PanelBody>
    </Panel>
  );
}
