import type { ChapterDetail, ChapterSummary } from "@/entities/chapter";
import type { ActSummary } from "@/entities/act";
import type { StoryInsert } from "@/entities/story-insert";

export type CampaignStatus = "locked" | "available" | "in-progress" | "completed";

export type CampaignSummary = {
  id: string;
  slug: string;
  /** Short language tag rendered in the campaign card chip (e.g. "C#", "TS"). */
  languageTag: string;
  title: string;
  status: CampaignStatus;
  chaptersCompleted: number;
  chaptersTotal: number;
  /** 0..100 derived from chapters. */
  percent: number;
  iconAsset?: string;
};

export type MapPath = {
  id: string;
  fromChapterId: string;
  toChapterId: string;
  style: "solid" | "dashed";
};

export type CampaignDetail = CampaignSummary & {
  subtitle?: string;
  descriptionMd: string;
  mapBackgroundAsset?: string;
  acts: ActSummary[];
  chapters: ChapterSummary[];
  /** Used by the right panel when a single chapter is selected. */
  chapterDetailsById: Record<string, ChapterDetail>;
  /** Insert previews keyed by chapter id. */
  insertsByChapterId: Record<string, StoryInsert[]>;
  mapPaths: MapPath[];
};
