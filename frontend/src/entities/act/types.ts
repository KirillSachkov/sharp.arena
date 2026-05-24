export type ActStatus = "locked" | "available" | "in-progress" | "completed";

export type ActSummary = {
  id: string;
  campaignId: string;
  slug: string;
  /** 1-based index. */
  index: number;
  title: string;
  subtitle?: string;
  status: ActStatus;
  /** 0..100 — derived from chapter completion within the act. */
  percent: number;
};
