import {
  ArrowRight,
  Check,
  Gauge,
  Gem,
  Gift,
  RotateCcw,
  Sparkles,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import type { ChapterDetail, ChapterRewardType } from "@/entities/chapter";
import type { StoryInsert } from "@/entities/story-insert";
import { Panel, PanelHeader, PanelBody, ProgressBar, Chip } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type Props = {
  chapter: ChapterDetail;
  insert?: StoryInsert;
};

const REWARD_ICON: Record<ChapterRewardType, typeof Zap> = {
  xp: Zap,
  gem: Gem,
  trophy: Trophy,
  chest: Gift,
  title: Sparkles,
};

const DIFFICULTY_LABEL: Record<ChapterDetail["difficulty"], string> = {
  easy: "Лёгкая",
  medium: "Средняя",
  hard: "Сложная",
  boss: "Босс",
};

const STATUS_LABEL: Record<ChapterDetail["status"], string> = {
  locked: "Заблокировано",
  "in-progress": "В процессе",
  completed: "Завершено",
};

const STATUS_TONE_CLASS: Record<ChapterDetail["status"], string> = {
  locked: "text-text-muted",
  "in-progress": "text-primary-soft",
  completed: "text-accent-green",
};

export function StoryChapterPanel({ chapter, insert }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <Panel className="overflow-hidden">
        <PanelHeader title="Текущая глава" />
        <PanelBody className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg border-2 border-primary/70 bg-primary/15 font-display text-base text-primary-soft">
              {chapter.index}
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-text">
                {chapter.title}
              </p>
              <p className={cn("mt-0.5 font-mono text-[11px] uppercase tracking-[0.18em]", STATUS_TONE_CLASS[chapter.status])}>
                {STATUS_LABEL[chapter.status]}
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-text-dim">
            {chapter.summary}
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
              <span>Прогресс главы</span>
              <span className="tabular-nums text-text-dim">
                {chapter.progressPercent}%
              </span>
            </div>
            <ProgressBar value={chapter.progressPercent} tone="primary" />
          </div>

          <dl className="grid grid-cols-1 gap-2 text-xs">
            <PanelStat
              icon={Gauge}
              label="Сложность"
              value={DIFFICULTY_LABEL[chapter.difficulty]}
            />
            <PanelStat
              icon={Timer}
              label="Время на главу"
              value={`${chapter.estimatedMinutes}–${chapter.estimatedMinutes + 10} мин`}
            />
            <PanelStat
              icon={Zap}
              label="Рекомендуемый XP"
              value={`+${chapter.recommendedXp} XP`}
              valueClassName="text-accent-gold"
            />
          </dl>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Награды
            </p>
            <div className="flex flex-wrap gap-2">
              {chapter.rewards.map((r) => {
                const Icon = REWARD_ICON[r.type];
                return (
                  <span
                    key={r.type}
                    className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1.5 font-mono text-[11px] text-text-dim"
                  >
                    <Icon className="size-3.5 text-accent-gold" aria-hidden />
                    {r.amount ?? 1}
                  </span>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Навыки и темы
            </p>
            <div className="flex flex-wrap gap-1.5">
              {chapter.skills.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Цели главы
            </p>
            <ul className="space-y-1.5">
              {chapter.goals.map((g) => (
                <li
                  key={g.id}
                  className={cn(
                    "flex items-start gap-2 text-xs",
                    g.completed ? "text-text-dim" : "text-text",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                      g.completed
                        ? "border-accent-green/60 bg-accent-green/15 text-accent-green"
                        : "border-border-subtle bg-bg-deep text-text-muted",
                    )}
                  >
                    {g.completed ? <Check className="size-2.5" aria-hidden /> : null}
                  </span>
                  <span>{g.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-primary-soft"
            >
              Продолжить главу
              <ArrowRight className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="flex h-9 items-center justify-center gap-2 rounded-md border border-border-subtle bg-bg-elevated/60 text-xs font-semibold uppercase tracking-[0.16em] text-text-dim hover:border-primary/40 hover:text-text"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Повторить главу
            </button>
          </div>
        </PanelBody>
      </Panel>

      {insert ? (
        <Panel className="overflow-hidden">
          <PanelHeader title="Сюжетная вставка" />
          <PanelBody className="space-y-2">
            <p className="text-xs leading-relaxed text-text-dim">{insert.preview}</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-soft hover:text-primary"
            >
              Смотреть вставку
              <ArrowRight className="size-3.5" aria-hidden />
            </button>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}

function PanelStat({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle/60 bg-bg-elevated/40 px-3 py-2">
      <span className="flex items-center gap-2 text-text-dim">
        <Icon className="size-3.5 text-text-muted" aria-hidden />
        {label}
      </span>
      <span className={cn("font-mono tabular-nums text-text", valueClassName)}>
        {value}
      </span>
    </div>
  );
}
