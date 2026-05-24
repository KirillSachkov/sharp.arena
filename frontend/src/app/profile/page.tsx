import type { Metadata } from "next";
import { Award, BarChart3, Flame, Hash, ListChecks, Target } from "lucide-react";
import {
  Chip,
  Panel,
  PanelHeader,
  PanelBody,
  PixelArtSlot,
  ProgressBar,
  SegmentedTabs,
  StatTile,
  XpBar,
} from "@/shared/ui";
import { MOCK_PLAYER, PlayerAvatar } from "@/entities/player";

export const metadata: Metadata = {
  title: "Profile",
};

const SKILLS = [
  { label: "C#", level: "Expert", value: 78, tone: "primary" as const },
  { label: "Algorithms", level: "Advanced", value: 64, tone: "cyan" as const },
  {
    label: "Data Structures",
    level: "Advanced",
    value: 61,
    tone: "cyan" as const,
  },
  { label: "OOP", level: "Expert", value: 72, tone: "primary" as const },
];

const ACHIEVEMENTS = [
  {
    id: "streak-master",
    title: "Streak Master",
    description: "Maintain a 10-day streak",
    xp: 10,
  },
  {
    id: "problem-solver",
    title: "Problem Solver",
    description: "Solve 100 problems",
    xp: 20,
  },
  {
    id: "code-warrior",
    title: "Code Warrior",
    description: "Solve 500 problems",
    xp: 50,
  },
];

export default function ProfilePage() {
  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <PanelHeader title="Profile" />
        <PanelBody className="flex flex-col gap-5 md:flex-row md:items-center">
          <PlayerAvatar src={MOCK_PLAYER.avatarAsset} size={96} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
              Player
            </p>
            <h2 className="font-pixel text-3xl uppercase tracking-[0.04em] text-text">
              {MOCK_PLAYER.handle}
            </h2>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-text-dim">
              Level {MOCK_PLAYER.level}
            </p>
            <div className="mt-3 max-w-md">
              <XpBar
                level={MOCK_PLAYER.level}
                currentXp={MOCK_PLAYER.currentXp}
                nextLevelXp={MOCK_PLAYER.nextLevelXp}
              />
            </div>
          </div>
        </PanelBody>

        <div className="border-t border-border-subtle px-5 pt-3">
          <SegmentedTabs
            items={[
              { id: "stats", label: "Stats" },
              { id: "achievements", label: "Achievements" },
              { id: "activity", label: "Activity" },
            ]}
            defaultActiveId="stats"
          />
        </div>

        <PanelBody className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile
            label="Problems Solved"
            value={MOCK_PLAYER.solved.toLocaleString()}
            tone="purple"
            icon={<ListChecks className="size-4" aria-hidden />}
          />
          <StatTile
            label="Acceptance Rate"
            value={`${MOCK_PLAYER.acceptanceRate.toFixed(1)}%`}
            tone="cyan"
            icon={<Target className="size-4" aria-hidden />}
          />
          <StatTile
            label="Current Streak"
            value={`${MOCK_PLAYER.currentStreak} d`}
            tone="gold"
            icon={<Flame className="size-4" aria-hidden />}
          />
          <StatTile
            label="Max Streak"
            value={`${MOCK_PLAYER.maxStreak} d`}
            tone="gold"
            icon={<BarChart3 className="size-4" aria-hidden />}
          />
        </PanelBody>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Skills" />
          <PanelBody className="space-y-4">
            {SKILLS.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text">{s.label}</span>
                  <div className="flex items-center gap-3 font-mono text-text-dim">
                    <Chip tone={s.tone === "primary" ? "purple" : "cyan"}>
                      {s.level}
                    </Chip>
                    <span className="tabular-nums">{s.value}%</span>
                  </div>
                </div>
                <ProgressBar
                  className="mt-2"
                  value={s.value}
                  tone={s.tone === "primary" ? "primary" : "cyan"}
                />
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Recent Achievements" />
          <PanelBody className="space-y-3">
            {ACHIEVEMENTS.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-elevated/60 px-3 py-2.5"
              >
                <PixelArtSlot
                  slot={`icon/${a.id}`}
                  size={48}
                  label="◆"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">
                    {a.title}
                  </p>
                  <p className="truncate text-xs text-text-dim">
                    {a.description}
                  </p>
                </div>
                <Chip tone="gold">
                  <Award className="size-3" aria-hidden /> {a.xp} XP
                </Chip>
                <Hash
                  className="hidden size-3.5 text-text-muted md:block"
                  aria-hidden
                />
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
