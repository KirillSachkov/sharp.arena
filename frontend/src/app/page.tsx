import {
  AchievementsCard,
  ActionCards,
  PlayerStrip,
  ProgressOverviewCard,
  RecentActivityCard,
  SiteFooter,
  StoryProgressMap,
  TopPlayersCard,
} from "@/widgets/dashboard";

export default function HomePage() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <PlayerStrip />
      <ActionCards />

      <div className="grid grid-cols-1 gap-4 sm:space-y-0 lg:grid-cols-3">
        <RecentActivityCard />
        <ProgressOverviewCard />
        <AchievementsCard />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <StoryProgressMap />
        <TopPlayersCard />
      </div>

      <SiteFooter />
    </div>
  );
}
