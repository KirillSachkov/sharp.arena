import type { TaskIconTone } from "@/entities/task";

export type CollectionAccent = "purple" | "cyan" | "gold" | "green";

export type CollectionSummary = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  taskCount: number;
  totalMinutes: number;
  progress: number;
  accent: CollectionAccent;
  iconGlyph: string;
  iconTone: TaskIconTone;
};
