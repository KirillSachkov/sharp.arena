import type { ChapterStatus } from "@/shared/types";

export type ChapterDifficulty = "easy" | "medium" | "hard" | "boss";

export type ChapterNodeType = "regular" | "boss" | "gate";

export type ChapterNodeTone =
  | "primary"
  | "gold"
  | "cyan"
  | "green"
  | "red";

export type MapPosition = {
  /** Percent of map width (0..100) — keeps positioning resolution-agnostic. */
  x: number;
  /** Percent of map height (0..100). */
  y: number;
};

export type ChapterGoal = {
  id: string;
  label: string;
  completed: boolean;
};

export type ChapterRewardType = "xp" | "gem" | "trophy" | "chest" | "title";

export type ChapterReward = {
  type: ChapterRewardType;
  /** Numeric value for xp/gem rewards; undefined for trophy/chest/title. */
  amount?: number;
  /** Optional pixel-art slot. */
  asset?: string;
  label?: string;
};

export type ChapterSummary = {
  id: string;
  actId: string;
  slug: string;
  /** 1-based index used in node label and panel title. */
  index: number;
  title: string;
  status: ChapterStatus;
  xpReward: number;
  nodeType: ChapterNodeType;
  nodeTone?: ChapterNodeTone;
  /** Pixel-art slot for the map node (resolves to public/art/<slot>.png). */
  nodeAsset?: string;
  mapPosition: MapPosition;
  prerequisiteChapterIds: string[];
};

export type ChapterDetail = ChapterSummary & {
  summary: string;
  difficulty: ChapterDifficulty;
  estimatedMinutes: number;
  recommendedXp: number;
  skills: string[];
  goals: ChapterGoal[];
  rewards: ChapterReward[];
  /** 0..100 — progress within an in-progress chapter. */
  progressPercent: number;
};
