"use client";

import { useState } from "react";
import {
  MOCK_CAMPAIGNS,
  MOCK_CAMPAIGN_DETAILS,
} from "@/entities/campaign";
import { StoryCampaignList } from "@/widgets/story-campaign-list";
import { StoryMap } from "@/widgets/story-map";
import { StoryChapterPanel } from "@/widgets/story-chapter-panel";
import { StoryActsBar } from "@/widgets/story-acts-bar";

type CampaignDetail = (typeof MOCK_CAMPAIGN_DETAILS)[string];

function pickInitialChapterId(campaign: CampaignDetail) {
  const inProgressWithDetail = campaign.chapters.find(
    (c) => c.status === "in-progress" && campaign.chapterDetailsById[c.id],
  );
  return (
    inProgressWithDetail?.id ??
    campaign.chapters.find((c) => c.status === "in-progress")?.id ??
    campaign.chapters[0]!.id
  );
}

export default function StoryPage() {
  const [selectedCampaignSlug, setSelectedCampaignSlug] = useState(
    MOCK_CAMPAIGNS[0]!.slug,
  );
  const campaign = MOCK_CAMPAIGN_DETAILS[selectedCampaignSlug]!;
  const [selectedChapterId, setSelectedChapterId] = useState(() =>
    pickInitialChapterId(campaign),
  );
  const detail =
    campaign.chapterDetailsById[selectedChapterId] ??
    Object.values(campaign.chapterDetailsById)[0]!;
  const insert = campaign.insertsByChapterId[detail.id]?.[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr_340px]">
        <StoryCampaignList
          campaigns={MOCK_CAMPAIGNS}
          selectedSlug={selectedCampaignSlug}
          onSelect={(slug) => {
            setSelectedCampaignSlug(slug);
            const next = MOCK_CAMPAIGN_DETAILS[slug];
            if (next) setSelectedChapterId(pickInitialChapterId(next));
          }}
        />
        <StoryMap
          campaign={campaign}
          chapters={campaign.chapters}
          paths={campaign.mapPaths}
          selectedChapterId={selectedChapterId}
          onSelectChapter={setSelectedChapterId}
        />
        <StoryChapterPanel chapter={detail} insert={insert} />
      </div>
      <StoryActsBar acts={campaign.acts} />
    </div>
  );
}
