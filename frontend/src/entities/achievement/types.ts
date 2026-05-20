export type AchievementStatus =
  | { kind: "unlocked"; unlockedAt?: string }
  | { kind: "in-progress"; current: number; total: number }
  | { kind: "locked" };

export type Achievement = {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  /** Slot name for the pixel-art icon (resolves to `public/art/<slot>.png`). */
  iconSlot: string;
  iconAsset?: string;
  tone: "purple" | "gold" | "cyan" | "green" | "red";
  status: AchievementStatus;
};

export const MOCK_ACHIEVEMENTS: Achievement[] = [
  {
    id: "streak-master",
    title: "Мастер серии",
    description: "Удержи серию в 10 дней",
    xpReward: 10,
    iconSlot: "icon/achievement-streak",
    tone: "purple",
    status: { kind: "unlocked", unlockedAt: "2026-05-10" },
  },
  {
    id: "problem-solver",
    title: "Решатель задач",
    description: "Реши 100 задач",
    xpReward: 20,
    iconSlot: "icon/achievement-solver",
    tone: "cyan",
    status: { kind: "in-progress", current: 82, total: 100 },
  },
  {
    id: "code-warrior",
    title: "Кодовый воин",
    description: "Реши 500 задач",
    xpReward: 50,
    iconSlot: "icon/achievement-warrior",
    tone: "gold",
    status: { kind: "in-progress", current: 312, total: 500 },
  },
];
