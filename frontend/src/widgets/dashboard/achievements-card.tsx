import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Panel, PanelBody, PanelHeader, PixelArtSlot } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { MOCK_ACHIEVEMENTS, type Achievement } from "@/entities/achievement";

const toneFrame: Record<Achievement["tone"], string> = {
  purple: "border-primary/30 bg-primary/5",
  gold: "border-accent-gold/30 bg-accent-gold/5",
  cyan: "border-accent-cyan/30 bg-accent-cyan/5",
  green: "border-accent-green/30 bg-accent-green/5",
  red: "border-accent-red/30 bg-accent-red/5",
};

const toneText: Record<Achievement["tone"], string> = {
  purple: "text-primary-soft",
  gold: "text-accent-gold",
  cyan: "text-accent-cyan",
  green: "text-accent-green",
  red: "text-accent-red",
};

function AchievementRow({ a }: { a: Achievement }) {
  return (
    <div className="flex items-center gap-3">
      {/*
       * Pixel-art icon — drop a 32×32 png at `public/art/<iconSlot>.png`.
       * Slot keys live in the Achievement entity mock data.
       */}
      <PixelArtSlot
        slot={a.iconSlot}
        src={a.iconAsset}
        size={48}
        label="◆"
        className={cn("shrink-0", toneFrame[a.tone])}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">{a.title}</p>
        <p className="truncate text-xs text-text-dim">{a.description}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("font-mono text-xs font-semibold", toneText[a.tone])}>
          {a.xpReward} XP
        </p>
        {a.status.kind === "unlocked" ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-green">
            Открыто
          </p>
        ) : a.status.kind === "in-progress" ? (
          <p className="font-mono text-[10px] tabular-nums text-text-muted">
            {a.status.current} / {a.status.total}
          </p>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
            Закрыто
          </p>
        )}
      </div>
    </div>
  );
}

export function AchievementsCard() {
  return (
    <Panel className="h-full overflow-hidden">
      <PanelHeader
        title="Достижения"
        trailing={
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary-soft hover:text-primary"
          >
            Все
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      />
      <PanelBody className="space-y-4">
        {MOCK_ACHIEVEMENTS.map((a) => (
          <AchievementRow key={a.id} a={a} />
        ))}
      </PanelBody>
    </Panel>
  );
}
