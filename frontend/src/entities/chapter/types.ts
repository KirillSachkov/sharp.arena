import type { ChapterStatus } from "@/shared/types";

export type ChapterSummary = {
  id: string;
  slug: string;
  index: number;
  title: string;
  tasksCompleted: number;
  tasksTotal: number;
  status: ChapterStatus;
  /** Pixel-art slot for the story-map node. Resolves to public/art/<slot>.png. */
  nodeSlot: string;
  nodeAsset?: string;
  /** Optional accent color for the node ring. */
  tone?: "primary" | "gold" | "cyan" | "green" | "red";
  /** True for the final boss chapter — rendered slightly larger. */
  isBoss?: boolean;
};

export const MOCK_CHAPTERS: ChapterSummary[] = [
  {
    id: "ch-1",
    slug: "getting-started",
    index: 1,
    title: "Getting Started",
    tasksCompleted: 10,
    tasksTotal: 10,
    status: "completed",
    nodeSlot: "icon/story-node-castle",
    tone: "green",
  },
  {
    id: "ch-2",
    slug: "variables-types",
    index: 2,
    title: "Variables & Types",
    tasksCompleted: 8,
    tasksTotal: 10,
    status: "completed",
    nodeSlot: "icon/story-node-hexagon",
    tone: "green",
  },
  {
    id: "ch-3",
    slug: "control-flow",
    index: 3,
    title: "Control Flow",
    tasksCompleted: 7,
    tasksTotal: 10,
    status: "in-progress",
    nodeSlot: "icon/story-node-warrior",
    tone: "primary",
  },
  {
    id: "ch-4",
    slug: "methods",
    index: 4,
    title: "Methods",
    tasksCompleted: 0,
    tasksTotal: 10,
    status: "locked",
    nodeSlot: "icon/story-node-locked",
  },
  {
    id: "ch-5",
    slug: "data-structures",
    index: 5,
    title: "Data Structures",
    tasksCompleted: 0,
    tasksTotal: 10,
    status: "locked",
    nodeSlot: "icon/story-node-locked",
  },
  {
    id: "ch-6",
    slug: "oop-basics",
    index: 6,
    title: "OOP Basics",
    tasksCompleted: 0,
    tasksTotal: 10,
    status: "locked",
    nodeSlot: "icon/story-node-locked",
  },
  {
    id: "ch-7",
    slug: "advanced-csharp",
    index: 7,
    title: "Advanced C#",
    tasksCompleted: 0,
    tasksTotal: 10,
    status: "locked",
    nodeSlot: "icon/story-node-locked",
  },
  {
    id: "ch-8",
    slug: "mastery",
    index: 8,
    title: "Mastery",
    tasksCompleted: 0,
    tasksTotal: 12,
    status: "locked",
    nodeSlot: "icon/story-node-boss",
    tone: "red",
    isBoss: true,
  },
];
