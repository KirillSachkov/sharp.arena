import type { ReactNode } from "react";
import { CheckCircle2, Flame, Hexagon, Trophy } from "lucide-react";
import { Panel, PixelArtSlot, ProgressBar } from "@/shared/ui";
import { MOCK_PLAYER, PlayerAvatar } from "@/entities/player";

type StatProps = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone: "purple" | "gold" | "green" | "cyan";
  className?: string;
};

const valueClasses = {
  purple: "text-primary-soft",
  gold: "text-accent-gold",
  green: "text-accent-green",
  cyan: "text-accent-cyan",
};

const iconFrame = {
  purple: "bg-primary/10 text-primary-soft border-primary/30",
  gold: "bg-accent-gold/10 text-accent-gold border-accent-gold/30",
  green: "bg-accent-green/10 text-accent-green border-accent-green/30",
  cyan: "bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30",
};

function Stat({ icon, label, value, hint, tone, className }: StatProps) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className ?? ""}`}>
      <div
        className={`grid size-10 shrink-0 place-items-center rounded-md border ${iconFrame[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0 leading-tight">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          {label}
        </p>
        <p
          className={`font-pixel text-xl tabular-nums ${valueClasses[tone]}`}
        >
          {value}
        </p>
        {hint != null ? (
          <p className="truncate text-[10px] text-text-muted">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export function PlayerStrip() {
  const p = MOCK_PLAYER;
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-5 px-5 py-5 sm:px-7 sm:py-6 lg:flex-row lg:items-center lg:gap-10">
        {/* Welcome block — fixed minimum, doesn't shrink under text. */}
        <div className="flex shrink-0 items-center gap-4 lg:max-w-[320px]">
          <PlayerAvatar size={64} className="shrink-0" />
          <div className="min-w-0">
            <p className="font-pixel text-[10px] uppercase tracking-[0.18em] text-text-muted">
              С возвращением,
            </p>
            <p className="font-pixel text-base uppercase tracking-[0.04em] text-text">
              {p.handle}
            </p>
            <p className="mt-1 text-xs text-text-dim">
              Готов оттачивать навыки?
            </p>
          </div>
        </div>

        {/* Stat strip — wraps below the welcome on mobile, sits inline on lg. */}
        <div className="grid flex-1 grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">
          {/* Level (special — has its own XP progress bar) */}
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`grid size-10 shrink-0 place-items-center rounded-md border ${iconFrame.purple}`}
            >
              <Hexagon className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                Уровень
              </p>
              <p className="font-pixel text-xl tabular-nums text-text">
                {p.level}
              </p>
              <div className="mt-1 w-32 max-w-full">
                <ProgressBar
                  value={p.currentXp}
                  max={p.nextLevelXp}
                  tone="primary"
                />
                <p className="mt-0.5 font-mono text-[10px] tabular-nums text-text-muted">
                  {p.currentXp.toLocaleString()} / {p.nextLevelXp.toLocaleString()} XP
                </p>
              </div>
            </div>
          </div>

          <Stat
            tone="gold"
            icon={<Flame className="size-4" aria-hidden />}
            label="Серия"
            value={`${p.currentStreak} дн.`}
            hint={`Лучшая: ${p.maxStreak} дн.`}
          />
          <Stat
            tone="green"
            icon={<CheckCircle2 className="size-4" aria-hidden />}
            label="Решено"
            value={p.solved.toLocaleString()}
            hint="задач"
          />
          <Stat
            tone="gold"
            icon={<Trophy className="size-4" aria-hidden />}
            label="Ранг"
            value={`#${p.rank}`}
            hint={`из ${p.totalRanked.toLocaleString()}`}
          />

          {/* Division */}
          <div className="col-span-2 flex min-w-0 items-center justify-between gap-3 sm:col-span-3 xl:col-span-1 xl:justify-start">
            <div className="min-w-0 leading-tight">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                Дивизион
              </p>
              <p className="font-pixel text-lg uppercase tracking-[0.04em] text-text">
                {p.division.label}
              </p>
            </div>
            {/*
             * Division emblem — drop a 64×64 pixel-art shield into
             * `public/art/emblem/<division-id>.png` (e.g. platinum-ii.png).
             */}
            <PixelArtSlot
              slot={`emblem/${p.division.id}`}
              src={p.division.emblemAsset}
              size={48}
              label="◆"
              className="shrink-0 rounded-md border-accent-cyan/30 bg-accent-cyan/5"
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
