import Link from "next/link";
import { ArrowRight, Crown, Medal } from "lucide-react";
import { Panel, PanelBody, PanelHeader, PixelArtSlot } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { MOCK_TOP_PLAYERS } from "@/entities/leaderboard";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="grid size-7 place-items-center rounded-md bg-accent-gold/15 text-accent-gold">
        <Crown className="size-3.5" aria-hidden />
      </span>
    );
  if (rank === 2)
    return (
      <span className="grid size-7 place-items-center rounded-md bg-text-dim/15 text-text">
        <Crown className="size-3.5" aria-hidden />
      </span>
    );
  if (rank === 3)
    return (
      <span className="grid size-7 place-items-center rounded-md bg-accent-gold/10 text-accent-gold/80">
        <Medal className="size-3.5" aria-hidden />
      </span>
    );
  return (
    <span className="grid size-7 place-items-center rounded-md border border-border-subtle text-text-muted">
      {rank}
    </span>
  );
}

export function TopPlayersCard() {
  return (
    <Panel className="h-full overflow-hidden">
      <PanelHeader
        title="Топ игроков"
        trailing={
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary-soft hover:text-primary"
          >
            Весь рейтинг
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      />
      <PanelBody className="p-0">
        <div className="grid grid-cols-[2rem_2rem_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border-subtle bg-bg-elevated/40 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
          <span>Ранг</span>
          <span aria-hidden />
          <span>Игрок</span>
          <span className="text-right">Решено</span>
          <span className="text-right">XP</span>
        </div>
        <ul>
          {MOCK_TOP_PLAYERS.map((p) => (
            <li
              key={p.playerId}
              className={cn(
                "grid grid-cols-[2rem_2rem_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border-subtle/60 px-5 py-2.5 last:border-b-0",
                p.isMe && "bg-accent-gold/10 ring-1 ring-inset ring-accent-gold/40",
              )}
            >
              <RankBadge rank={p.rank} />
              <PixelArtSlot
                slot={p.avatarSlot}
                src={p.avatarAsset}
                size={32}
                label="AVA"
                className="rounded-md border-primary/30"
              />
              <span
                className={cn(
                  "truncate text-sm font-semibold",
                  p.isMe ? "text-accent-gold" : "text-text",
                )}
              >
                {p.handle}
              </span>
              <span className="font-mono text-xs tabular-nums text-text-dim">
                {p.solved}
              </span>
              <span className="font-mono text-xs tabular-nums text-accent-gold">
                {p.xp.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}
