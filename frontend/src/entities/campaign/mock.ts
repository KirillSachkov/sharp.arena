import type { ChapterDetail, ChapterSummary } from "@/entities/chapter";
import type { ActSummary } from "@/entities/act";
import type { StoryInsert } from "@/entities/story-insert";
import type {
  CampaignDetail,
  CampaignSummary,
  MapPath,
} from "./types";

const CSHARP_ACTS: ActSummary[] = [
  {
    id: "act-1",
    campaignId: "campaign-csharp",
    slug: "act-1",
    index: 1,
    title: "Акт I",
    subtitle: "Основы языка",
    status: "completed",
    percent: 100,
  },
  {
    id: "act-2",
    campaignId: "campaign-csharp",
    slug: "act-2",
    index: 2,
    title: "Акт II",
    subtitle: "Структуры и логика",
    status: "completed",
    percent: 83,
  },
  {
    id: "act-3",
    campaignId: "campaign-csharp",
    slug: "act-3",
    index: 3,
    title: "Акт III",
    subtitle: "Объектная модель",
    status: "in-progress",
    percent: 33,
  },
  {
    id: "act-4",
    campaignId: "campaign-csharp",
    slug: "act-4",
    index: 4,
    title: "Акт IV",
    subtitle: "Веб и API",
    status: "locked",
    percent: 0,
  },
];

const CSHARP_CHAPTERS: ChapterSummary[] = [
  {
    id: "ch-1", actId: "act-1", slug: "variables", index: 1,
    title: "Переменные и типы", status: "completed", xpReward: 10,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 18, y: 36 }, prerequisiteChapterIds: [],
  },
  {
    id: "ch-2", actId: "act-1", slug: "conditions", index: 2,
    title: "Условия", status: "completed", xpReward: 10,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 34, y: 30 }, prerequisiteChapterIds: ["ch-1"],
  },
  {
    id: "ch-3", actId: "act-1", slug: "loops", index: 3,
    title: "Циклы", status: "completed", xpReward: 20,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 52, y: 34 }, prerequisiteChapterIds: ["ch-2"],
  },
  {
    id: "ch-4", actId: "act-2", slug: "methods", index: 4,
    title: "Методы", status: "completed", xpReward: 20,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 56, y: 50 }, prerequisiteChapterIds: ["ch-3"],
  },
  {
    id: "ch-5", actId: "act-2", slug: "collections", index: 5,
    title: "Коллекции", status: "completed", xpReward: 20,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 48, y: 60 }, prerequisiteChapterIds: ["ch-4"],
  },
  {
    id: "ch-6", actId: "act-2", slug: "linq", index: 6,
    title: "LINQ", status: "in-progress", xpReward: 25,
    nodeType: "regular", nodeTone: "cyan",
    mapPosition: { x: 36, y: 64 }, prerequisiteChapterIds: ["ch-5"],
  },
  {
    id: "ch-7", actId: "act-3", slug: "oop", index: 7,
    title: "ООП", status: "in-progress", xpReward: 30,
    nodeType: "regular", nodeTone: "primary",
    mapPosition: { x: 26, y: 70 }, prerequisiteChapterIds: ["ch-6"],
  },
  {
    id: "ch-8", actId: "act-3", slug: "async", index: 8,
    title: "Async/await", status: "locked", xpReward: 35,
    nodeType: "regular",
    mapPosition: { x: 18, y: 76 }, prerequisiteChapterIds: ["ch-7"],
  },
  {
    id: "ch-9", actId: "act-4", slug: "aspnet", index: 9,
    title: "ASP.NET Core", status: "locked", xpReward: 40,
    nodeType: "regular",
    mapPosition: { x: 42, y: 84 }, prerequisiteChapterIds: ["ch-8"],
  },
  {
    id: "ch-10", actId: "act-4", slug: "boss", index: 10,
    title: "Финальный босс", status: "locked", xpReward: 100,
    nodeType: "boss", nodeTone: "red",
    mapPosition: { x: 80, y: 80 }, prerequisiteChapterIds: ["ch-9"],
  },
];

const CSHARP_PATHS: MapPath[] = [
  { id: "p-1-2", fromChapterId: "ch-1", toChapterId: "ch-2", style: "solid" },
  { id: "p-2-3", fromChapterId: "ch-2", toChapterId: "ch-3", style: "solid" },
  { id: "p-3-4", fromChapterId: "ch-3", toChapterId: "ch-4", style: "solid" },
  { id: "p-4-5", fromChapterId: "ch-4", toChapterId: "ch-5", style: "solid" },
  { id: "p-5-6", fromChapterId: "ch-5", toChapterId: "ch-6", style: "solid" },
  { id: "p-6-7", fromChapterId: "ch-6", toChapterId: "ch-7", style: "solid" },
  { id: "p-7-8", fromChapterId: "ch-7", toChapterId: "ch-8", style: "dashed" },
  { id: "p-8-9", fromChapterId: "ch-8", toChapterId: "ch-9", style: "dashed" },
  { id: "p-9-10", fromChapterId: "ch-9", toChapterId: "ch-10", style: "dashed" },
];

const CSHARP_CHAPTER_DETAIL_OOP: ChapterDetail = {
  ...CSHARP_CHAPTERS[6]!,
  summary:
    "Пора разобраться, как создавать свои типы и строить гибкие, переиспользуемые системы с помощью принципов ООП.",
  difficulty: "medium",
  estimatedMinutes: 50,
  recommendedXp: 30,
  skills: ["Основы", "ООП", "Классы", "Объекты", "Инкапсуляция", "Наследование", "Полиморфизм"],
  progressPercent: 60,
  goals: [
    { id: "g-1", label: "Создать класс и объекты", completed: true },
    { id: "g-2", label: "Понять инкапсуляцию и модификаторы", completed: true },
    { id: "g-3", label: "Наследование и переопределение методов", completed: true },
    { id: "g-4", label: "Полиморфизм на практике", completed: false },
    { id: "g-5", label: "Применить ООП в мини-проекте", completed: false },
  ],
  rewards: [
    { type: "xp", amount: 30 },
    { type: "gem", amount: 150 },
    { type: "trophy", amount: 1 },
    { type: "chest", amount: 1 },
  ],
};

const CSHARP_INSERTS: StoryInsert[] = [
  {
    id: "insert-7",
    chapterId: "ch-7",
    position: "before",
    title: "Хранители кода",
    preview:
      "Хранители кода открыли тебе тайну шаблонов. Но без понимания форм ты не сможешь пройти дальше.",
    artAsset: "banner/insert-oop",
  },
];

export const MOCK_CAMPAIGNS: CampaignSummary[] = [
  {
    id: "campaign-csharp",
    slug: "csharp-basics",
    languageTag: "C#",
    title: "Основы C#",
    status: "in-progress",
    chaptersCompleted: 6,
    chaptersTotal: 10,
    percent: 60,
    iconAsset: "icon/campaign-csharp",
  },
  {
    id: "campaign-typescript",
    slug: "typescript-basics",
    languageTag: "TS",
    title: "Основы TypeScript",
    status: "locked",
    chaptersCompleted: 2,
    chaptersTotal: 10,
    percent: 20,
  },
  {
    id: "campaign-http",
    slug: "http-master",
    languageTag: "HTTP",
    title: "Мастер HTTP",
    status: "locked",
    chaptersCompleted: 1,
    chaptersTotal: 9,
    percent: 11,
  },
];

export const MOCK_CAMPAIGN_DETAILS: Record<string, CampaignDetail> = {
  "csharp-basics": {
    ...MOCK_CAMPAIGNS[0]!,
    subtitle: "Кампания: Основы C#",
    descriptionMd:
      "Освой синтаксис, типы и базовые конструкции языка, прежде чем погружаться в архитектурные паттерны.",
    mapBackgroundAsset: "banner/map-csharp",
    acts: CSHARP_ACTS,
    chapters: CSHARP_CHAPTERS,
    chapterDetailsById: {
      [CSHARP_CHAPTER_DETAIL_OOP.id]: CSHARP_CHAPTER_DETAIL_OOP,
    },
    insertsByChapterId: { "ch-7": CSHARP_INSERTS },
    mapPaths: CSHARP_PATHS,
  },
};
