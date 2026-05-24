export type PlayerDivision = {
  /** Stable key — also the placeholder slot id for the emblem. */
  id: "bronze" | "silver" | "gold" | "platinum-ii" | "diamond" | "legend";
  label: string;
  emblemAsset?: string;
};

export type PlayerSummary = {
  id: string;
  handle: string;
  avatarAsset?: string;
  level: number;
  currentXp: number;
  nextLevelXp: number;
  totalXp: number;
  solved: number;
  totalSolvable: number;
  currentStreak: number;
  maxStreak: number;
  rank: number;
  totalRanked: number;
  acceptanceRate: number;
  division: PlayerDivision;
};

export const MOCK_PLAYER: PlayerSummary = {
  id: "code-ninja",
  handle: "CodeNinja",
  avatarAsset: "/art/avatar/code-ninja.webp",
  level: 24,
  currentXp: 4230,
  nextLevelXp: 6000,
  totalXp: 11230,
  solved: 312,
  totalSolvable: 1450,
  currentStreak: 12,
  maxStreak: 28,
  rank: 245,
  totalRanked: 18760,
  acceptanceRate: 92.4,
  division: {
    id: "platinum-ii",
    label: "Платина II",
  },
};
