import type { Metadata } from "next";
import { MOCK_TASKS, MOCK_TOTAL_TASKS } from "@/entities/task";
import { MOCK_COLLECTIONS } from "@/entities/collection";
import {
  ArenaCollectionsSidebar,
  ArenaFiltersSidebar,
  ArenaPageHero,
  ArenaPagination,
  ArenaTasksTable,
  ArenaToolbar,
} from "@/widgets/arena-catalog";
import { SiteFooter } from "@/widgets/dashboard";

export const metadata: Metadata = {
  title: "Арена",
  description:
    "Каталог практических задач Sharp Arena — фундаменты C#, ASP.NET Core, WebSockets, EF Core и подготовка к собеседованиям.",
};

export default function ArenaPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-br from-bg-panel via-bg-panel to-bg-elevated/60 p-5 shadow-[0_0_120px_-60px_var(--color-primary)] sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
          <ArenaPageHero />
          <div className="flex min-w-0 flex-1 flex-col">
            <ArenaToolbar />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[14rem_minmax(0,1fr)_17.5rem]">
        <ArenaFiltersSidebar className="xl:sticky xl:top-20" />

        <div className="flex min-w-0 flex-col gap-4">
          <ArenaTasksTable
            tasks={MOCK_TASKS.slice(0, 10)}
            totalCount={MOCK_TOTAL_TASKS}
          />
          <ArenaPagination shown={10} total={MOCK_TOTAL_TASKS} />
        </div>

        <ArenaCollectionsSidebar
          collections={MOCK_COLLECTIONS}
          className="xl:sticky xl:top-20"
        />
      </div>

      <SiteFooter />
    </div>
  );
}
