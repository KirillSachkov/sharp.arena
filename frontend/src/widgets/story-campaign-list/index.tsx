import { Lock, Plus } from "lucide-react";
import type { CampaignSummary } from "@/entities/campaign";
import { Panel, PanelHeader, PanelBody, ProgressBar } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type Props = {
  campaigns: CampaignSummary[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
};

export function StoryCampaignList({ campaigns, selectedSlug, onSelect }: Props) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Кампании"
        trailing={
          <button
            type="button"
            className="grid size-7 place-items-center rounded-md border border-border-subtle text-text-dim hover:border-primary/60 hover:text-primary"
            aria-label="Добавить кампанию"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        }
      />
      <PanelBody className="space-y-2">
        {campaigns.map((c) => {
          const isLocked = c.status === "locked";
          const isSelected = c.slug === selectedSlug;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => !isLocked && onSelect(c.slug)}
              disabled={isLocked}
              className={cn(
                "flex w-full items-start gap-3 rounded-md border bg-bg-elevated/60 px-3 py-3 text-left transition-colors",
                isLocked
                  ? "cursor-not-allowed border-border-subtle/60 opacity-60"
                  : isSelected
                    ? "border-primary/70 bg-primary/5"
                    : "border-border-subtle hover:border-primary/40",
              )}
              aria-current={isSelected ? "true" : undefined}
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-md border font-display text-[10px] uppercase tracking-[0.08em]",
                  isSelected
                    ? "border-primary/70 bg-primary/20 text-primary-soft"
                    : "border-border-subtle bg-bg-deep text-text-dim",
                )}
              >
                {c.languageTag}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text">
                  {c.title}
                </span>
                <span className="mt-0.5 flex items-center justify-between font-mono text-[11px] text-text-muted">
                  <span>
                    Прогресс: {c.chaptersCompleted} / {c.chaptersTotal} глав
                  </span>
                  <span className="tabular-nums">{c.percent}%</span>
                </span>
                <ProgressBar
                  value={c.percent}
                  tone="primary"
                  className="mt-2"
                />
              </span>
              {isLocked ? (
                <Lock
                  className="size-4 shrink-0 text-text-muted"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </PanelBody>
    </Panel>
  );
}
