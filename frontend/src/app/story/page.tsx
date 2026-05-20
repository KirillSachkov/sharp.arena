import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { Panel, PanelHeader, PanelBody, ProgressBar } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { MOCK_CHAPTERS } from "@/entities/chapter";

export const metadata: Metadata = {
  title: "История",
};

export default function StoryPage() {
  const totalProgress = Math.round(
    (MOCK_CHAPTERS.reduce((acc, c) => acc + c.tasksCompleted, 0) /
      MOCK_CHAPTERS.reduce((acc, c) => acc + c.tasksTotal, 0)) *
      100,
  );

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Режим истории"
          subtitle="Путь разработчика"
        />
        <PanelBody className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr]">
          <ul className="space-y-2">
            {MOCK_CHAPTERS.map((c) => {
              const isLocked = c.status === "locked";
              return (
                <li key={c.id}>
                  <Link
                    href={isLocked ? "#" : `/story/${c.slug}`}
                    aria-disabled={isLocked}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-md border bg-bg-elevated/60 px-4 py-3 transition-colors",
                      isLocked
                        ? "cursor-not-allowed border-border-subtle/60 opacity-60"
                        : c.status === "in-progress"
                          ? "border-primary/40 hover:border-primary/70"
                          : "border-border-subtle hover:border-primary/40",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                        Глава {c.index}
                      </p>
                      <p className="truncate text-sm font-semibold text-text">
                        {c.title}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 font-mono text-xs text-text-dim">
                      <span className="tabular-nums">
                        {c.tasksCompleted}/{c.tasksTotal}
                      </span>
                      {isLocked ? (
                        <Lock className="size-4 text-text-muted" aria-hidden />
                      ) : (
                        <ChevronRight
                          className="size-4 text-text-muted"
                          aria-hidden
                        />
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div
            role="img"
            aria-label="Story Map banner placeholder"
            className="relative grid min-h-[200px] place-items-center overflow-hidden rounded-md border border-border-subtle bg-bg-deep bg-[linear-gradient(45deg,var(--color-bg-elevated)_25%,transparent_25%),linear-gradient(-45deg,var(--color-bg-elevated)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--color-bg-elevated)_75%),linear-gradient(-45deg,transparent_75%,var(--color-bg-elevated)_75%)] bg-[length:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0]"
          >
            <div className="relative z-10 rounded-md border border-border-subtle bg-bg-panel/80 px-5 py-4 backdrop-blur-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
                Chapter 3.2
              </p>
              <p className="text-base font-semibold text-text">Loops</p>
              <p className="mt-0.5 text-xs text-text-dim">Learn about loops</p>
              <Link
                href="/arena/tasks/two-sum"
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-primary-soft"
              >
                Continue
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </PanelBody>
        <div className="border-t border-border-subtle bg-bg-elevated/40 px-5 py-4">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            <span>Chapter Progress</span>
            <span className="tabular-nums text-text-dim">
              {totalProgress}%
            </span>
          </div>
          <ProgressBar value={totalProgress} tone="primary" className="mt-2" />
        </div>
      </Panel>
    </div>
  );
}
