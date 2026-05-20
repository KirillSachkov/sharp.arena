import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Award, CheckCircle2, Flame } from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { MOCK_ACTIVITY, type ActivityEntry } from "@/entities/activity";

const toneByKind: Record<
  ActivityEntry["kind"],
  { icon: ReactNode; text: string; chip: string }
> = {
  "task-solved": {
    icon: <CheckCircle2 className="size-4" aria-hidden />,
    text: "text-accent-green",
    chip: "border-accent-green/30 bg-accent-green/10",
  },
  "chapter-completed": {
    icon: <Award className="size-4" aria-hidden />,
    text: "text-primary-soft",
    chip: "border-primary/30 bg-primary/10",
  },
  streak: {
    icon: <Flame className="size-4" aria-hidden />,
    text: "text-accent-gold",
    chip: "border-accent-gold/30 bg-accent-gold/10",
  },
};

export function RecentActivityCard() {
  return (
    <Panel className="h-full overflow-hidden">
      <PanelHeader title="Последняя активность" />
      <PanelBody className="flex h-[calc(100%-49px)] flex-col p-0">
        <ul className="flex-1">
          {MOCK_ACTIVITY.map((row) => {
            const tone = toneByKind[row.kind];
            return (
              <li
                key={row.id}
                className="flex items-center gap-3 border-b border-border-subtle/60 px-5 py-3 last:border-b-0"
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-md border",
                    tone.chip,
                    tone.text,
                  )}
                >
                  {tone.icon}
                </span>
                <p className="min-w-0 flex-1 text-sm text-text">
                  {row.title}{" "}
                  <span className="font-semibold">{row.highlight}</span>
                </p>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[11px] font-semibold",
                    tone.text,
                  )}
                >
                  +{row.xp} XP
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted sm:inline">
                  {row.whenRelative}
                </span>
              </li>
            );
          })}
        </ul>
        <Link
          href="/profile"
          className="flex items-center justify-center gap-1.5 border-t border-border-subtle bg-bg-elevated/30 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-primary-soft transition-colors hover:bg-bg-elevated/60 hover:text-primary"
        >
          Вся активность
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </PanelBody>
    </Panel>
  );
}
