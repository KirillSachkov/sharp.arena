import type { Metadata } from "next";
import { Crown, Medal } from "lucide-react";
import {
  Chip,
  Panel,
  PanelHeader,
  PanelBody,
  SegmentedTabs,
} from "@/shared/ui";
import { PlayerAvatar } from "@/entities/player";
import { cn } from "@/shared/lib/cn";

export const metadata: Metadata = {
  title: "Leaderboard",
};

type Row = { rank: number; handle: string; xp: number; solved: number };

const ROWS: Row[] = [
  { rank: 1, handle: "DevMaster", xp: 12540, solved: 682 },
  { rank: 2, handle: "CodeNinja", xp: 11230, solved: 512 },
  { rank: 3, handle: "Sharpy", xp: 10870, solved: 498 },
  { rank: 4, handle: "ByteBender", xp: 9760, solved: 450 },
  { rank: 5, handle: "NullPointer", xp: 8910, solved: 412 },
  { rank: 6, handle: "SyntaxSamurai", xp: 8420, solved: 398 },
  { rank: 7, handle: "LoopWizard", xp: 7770, solved: 366 },
  { rank: 8, handle: "ArrayAdapter", xp: 7120, solved: 342 },
];

function rankBadge(rank: number) {
  if (rank === 1)
    return (
      <span className="grid size-7 place-items-center rounded-md bg-accent-gold/20 text-accent-gold">
        <Crown className="size-3.5" aria-hidden />
      </span>
    );
  if (rank === 2)
    return (
      <span className="grid size-7 place-items-center rounded-md bg-text-dim/20 text-text">
        <Medal className="size-3.5" aria-hidden />
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

export default function LeaderboardPage() {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Leaderboard"
        trailing={<Chip tone="gold">Season 1</Chip>}
      />
      <PanelBody className="space-y-4">
        <SegmentedTabs
          variant="pill"
          items={[
            { id: "global", label: "Global" },
            { id: "friends", label: "Friends" },
            { id: "country", label: "Country" },
          ]}
          defaultActiveId="global"
        />

        <div className="overflow-hidden rounded-md border border-border-subtle">
          <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border-subtle bg-bg-elevated/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted sm:grid-cols-[3rem_minmax(0,1fr)_auto_auto] sm:gap-4 sm:px-4">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">XP</span>
            <span className="hidden text-right sm:inline">Solved</span>
          </div>
          {ROWS.map((r) => {
            const isMe = r.handle === "CodeNinja";
            return (
              <div
                key={r.rank}
                className={cn(
                  "grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border-subtle/60 px-3 py-3 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)_auto_auto] sm:gap-4 sm:px-4",
                  isMe && "bg-primary/10",
                )}
              >
                {rankBadge(r.rank)}
                <div className="flex min-w-0 items-center gap-3">
                  <PlayerAvatar size={32} />
                  <span
                    className={cn(
                      "truncate text-sm font-semibold",
                      isMe ? "text-primary-soft" : "text-text",
                    )}
                  >
                    {r.handle}
                  </span>
                </div>
                <span className="font-mono text-xs tabular-nums text-accent-gold">
                  {r.xp.toLocaleString()}
                </span>
                <span className="hidden font-mono text-xs tabular-nums text-text-dim sm:inline">
                  {r.solved}
                </span>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-soft hover:bg-primary/20"
          >
            View Full Leaderboard →
          </button>
        </div>
      </PanelBody>
    </Panel>
  );
}
