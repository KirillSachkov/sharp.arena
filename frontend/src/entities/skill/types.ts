export type SkillLevel =
  | "Новичок"
  | "Ученик"
  | "Продвинутый"
  | "Эксперт"
  | "Мастер";

export type SkillProgress = {
  id: string;
  label: string;
  /** 0–100 mastery percentage. */
  value: number;
  level: SkillLevel;
  tone: "primary" | "cyan" | "gold" | "green";
};

export const MOCK_SKILLS: SkillProgress[] = [
  {
    id: "algorithms",
    label: "Алгоритмы",
    value: 92,
    level: "Продвинутый",
    tone: "primary",
  },
  {
    id: "data-structures",
    label: "Структуры данных",
    value: 65,
    level: "Продвинутый",
    tone: "cyan",
  },
  {
    id: "csharp-syntax",
    label: "Синтаксис C#",
    value: 78,
    level: "Эксперт",
    tone: "gold",
  },
  {
    id: "problem-solving",
    label: "Решение задач",
    value: 42,
    level: "Продвинутый",
    tone: "primary",
  },
];

/** Quick total used in Progress Overview footer. */
export type ProgressOverview = {
  totalXp: number;
  nextRewardXp: number;
};

export const MOCK_PROGRESS_OVERVIEW: ProgressOverview = {
  totalXp: 11230,
  nextRewardXp: 770,
};
