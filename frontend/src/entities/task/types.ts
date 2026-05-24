import type { Difficulty, TaskStatus } from "@/shared/types";

export type TaskTopic =
  /* Classic algorithm topics — kept for compat with /arena/tasks/two-sum scaffolding. */
  | "arrays"
  | "strings"
  | "hash-map"
  | "linked-list"
  | "binary-search"
  | "dynamic-programming"
  | "graphs"
  | "trees"
  | "math"
  /* Platform-relevant topics — the actual Sharp Arena curriculum. */
  | "csharp-basics"
  | "oop"
  | "collections"
  | "linq"
  | "async"
  | "algorithms"
  | "data-structures"
  | "aspnet-core"
  | "web-api"
  | "websockets"
  | "ef-core"
  | "sql"
  /* Sub-tags used on task chips. */
  | "fundamentals"
  | "control-flow"
  | "real-time"
  | "concurrency"
  | "database"
  | "array";

export type TaskExample = {
  input: string;
  output: string;
  explanation?: string;
};

export type TaskFormat = "single" | "mini-quest" | "boss" | "pack";

export type TaskIconTone =
  | "purple"
  | "cyan"
  | "gold"
  | "green"
  | "red"
  | "blue"
  | "pink";

export type TaskSummary = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  difficulty: Difficulty;
  topics: TaskTopic[];
  language: "csharp";
  xpReward: number;
  estimatedMinutes: number;
  popularity: number;
  status: TaskStatus;
  unlockHint?: string;
  format: TaskFormat;
  iconGlyph: string;
  iconTone: TaskIconTone;
  acceptanceRate: number;
  solvedBy: number;
};

export type TaskDetail = TaskSummary & {
  description: string;
  examples: TaskExample[];
  constraints: string[];
  starterCode: string[];
  hints: string[];
};
