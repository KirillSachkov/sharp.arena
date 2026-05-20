import type { Difficulty, TaskStatus } from "@/shared/types";

export type TaskTopic =
  | "arrays"
  | "strings"
  | "hash-map"
  | "linked-list"
  | "binary-search"
  | "dynamic-programming"
  | "graphs"
  | "trees"
  | "math";

export type TaskExample = {
  input: string;
  output: string;
  explanation?: string;
};

export type TaskSummary = {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  topics: TaskTopic[];
  language: "csharp";
  xpReward: number;
  status: TaskStatus;
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
