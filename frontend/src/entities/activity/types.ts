export type ActivityKind = "task-solved" | "chapter-completed" | "streak";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  title: string;
  highlight: string;
  xp: number;
  occurredAt: string;
  whenRelative: string;
};

export const MOCK_ACTIVITY: ActivityEntry[] = [
  {
    id: "1",
    kind: "task-solved",
    title: "Решено",
    highlight: "Reverse Linked List",
    xp: 25,
    occurredAt: "2026-05-20T12:00:00Z",
    whenRelative: "2 мин. назад",
  },
  {
    id: "2",
    kind: "chapter-completed",
    title: "Завершена",
    highlight: "Глава 3",
    xp: 100,
    occurredAt: "2026-05-20T11:00:00Z",
    whenRelative: "1 ч. назад",
  },
  {
    id: "3",
    kind: "streak",
    title: "Достигнута",
    highlight: "серия 10 дней",
    xp: 50,
    occurredAt: "2026-05-20T10:00:00Z",
    whenRelative: "2 ч. назад",
  },
];
