export type Difficulty = "easy" | "medium" | "hard";

export type TaskStatus =
  | "not-started"
  | "in-progress"
  | "solved"
  | "perfect";

export type TestStatus = "passed" | "failed" | "pending";

export type ChapterStatus = "completed" | "in-progress" | "locked";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Лёгкая",
  medium: "Средняя",
  hard: "Сложная",
};
