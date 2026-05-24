import { Crosshair, Maximize, Minus, Plus } from "lucide-react";
import type { ChapterSummary } from "@/entities/chapter";
import type { CampaignDetail, MapPath } from "@/entities/campaign";
import { Panel, PanelHeader, PanelBody } from "@/shared/ui";
import { ChapterNode } from "./chapter-node";
import { MapPaths } from "./map-paths";

type Props = {
  campaign: CampaignDetail;
  chapters: ChapterSummary[];
  paths: MapPath[];
  selectedChapterId: string | null;
  onSelectChapter: (id: string) => void;
};

export function StoryMap({
  campaign,
  chapters,
  paths,
  selectedChapterId,
  onSelectChapter,
}: Props) {
  return (
    <Panel className="flex flex-col overflow-hidden">
      <PanelHeader
        title={`Карта кампании: ${campaign.title.toUpperCase()}`}
        trailing={
          <div className="flex items-center gap-1.5">
            {[
              { Icon: Plus,      label: "Приблизить" },
              { Icon: Minus,     label: "Отдалить" },
              { Icon: Maximize,  label: "На весь экран" },
              { Icon: Crosshair, label: "Центрировать" },
            ].map(({ Icon, label }) => (
              <button
                key={label}
                type="button"
                className="grid size-7 place-items-center rounded-md border border-border-subtle text-text-dim hover:border-primary/60 hover:text-primary"
                aria-label={label}
              >
                <Icon className="size-3.5" aria-hidden />
              </button>
            ))}
          </div>
        }
      />
      <PanelBody className="flex-1 p-0">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-bg-deep">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(168,85,247,0.18),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(6,182,212,0.12),transparent_60%)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(45deg,var(--color-bg-elevated)_25%,transparent_25%),linear-gradient(-45deg,var(--color-bg-elevated)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--color-bg-elevated)_75%),linear-gradient(-45deg,transparent_75%,var(--color-bg-elevated)_75%)] bg-[length:24px_24px] opacity-30"
          />
          <MapPaths paths={paths} chapters={chapters} />
          {chapters.map((c) => (
            <ChapterNode
              key={c.id}
              chapter={c}
              isSelected={c.id === selectedChapterId}
              onSelect={onSelectChapter}
            />
          ))}
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-subtle bg-bg-elevated/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-accent-green" /> Завершено
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-accent-cyan" /> Доступно
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-primary" /> В процессе
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-border-subtle" /> Заблокировано
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-accent-red" /> Босс
          </li>
        </ul>
      </PanelBody>
    </Panel>
  );
}
