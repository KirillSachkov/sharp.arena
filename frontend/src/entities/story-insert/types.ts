export type StoryInsertPosition = "before" | "after";

export type StoryInsert = {
  id: string;
  chapterId: string;
  position: StoryInsertPosition;
  title: string;
  /** Plain-text preview shown in the right panel. */
  preview: string;
  artAsset?: string;
};
