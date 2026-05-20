import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Filter,
  GraduationCap,
  Layers,
  ListChecks,
  Map,
  Swords,
  Trophy,
} from "lucide-react";
import { Panel, PixelArtSlot } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type ModeBullet = { icon: ReactNode; label: string };

type ModeCardProps = {
  title: string;
  subtitle: string;
  bullets: ModeBullet[];
  /** Slot key — drop a 512×256 png at `public/art/<slot>.png` to replace. */
  bannerSlot: string;
  bannerAsset?: string;
  href: string;
  cta: string;
  tone: "gold" | "purple";
};

function ModeCard({
  title,
  subtitle,
  bullets,
  bannerSlot,
  bannerAsset,
  href,
  cta,
  tone,
}: ModeCardProps) {
  const accent =
    tone === "gold"
      ? {
          frame: "border-accent-gold/60 hover:border-accent-gold/80",
          title: "text-accent-gold",
          cta: "bg-accent-gold text-bg-deep hover:bg-accent-gold/85",
        }
      : {
          frame: "border-primary/60 hover:border-primary/80",
          title: "text-primary-soft",
          cta: "bg-primary text-white hover:bg-primary-soft",
        };

  return (
    <Panel
      className={cn(
        "group relative isolate min-h-[260px] overflow-hidden border transition-colors",
        accent.frame,
      )}
    >
      {/* Art layer — full-bleed. Drop a 512×256 PNG at public/art/<slot>.png */}
      <div className="absolute inset-0 -z-10">
        <PixelArtSlot
          slot={bannerSlot}
          src={bannerAsset}
          size={128}
          aspect="banner"
          label={title}
          className="size-full rounded-none border-0"
        />
      </div>
      {/* Legibility gradient — dark on the left, transparent on the right. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-bg-panel via-bg-panel/85 to-transparent"
      />

      {/* Content */}
      <div className="relative flex h-full max-w-[58%] flex-col gap-3 p-5 sm:p-6">
        <div>
          <h3
            className={cn(
              "font-pixel text-3xl uppercase tracking-[0.06em] sm:text-4xl",
              accent.title,
            )}
          >
            {title}
          </h3>
          <p className="mt-1 text-sm text-text-dim">{subtitle}</p>
        </div>
        <ul className="space-y-1.5 text-sm text-text-dim">
          {bullets.map((b) => (
            <li key={b.label} className="flex items-center gap-2">
              <span className="text-text-muted">{b.icon}</span>
              <span>{b.label}</span>
            </li>
          ))}
        </ul>
        <Link
          href={href}
          className={cn(
            "mt-auto inline-flex h-10 w-fit items-center gap-2 rounded-md px-4 text-xs font-semibold uppercase tracking-[0.18em] transition-colors",
            accent.cta,
          )}
        >
          {cta}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </Panel>
  );
}

export function ActionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <ModeCard
        tone="gold"
        title="Арена"
        subtitle="Свободная практика. Выбери бой."
        href="/arena"
        cta="Войти в арену"
        bannerSlot="banner/arena"
        bullets={[
          { icon: <Layers className="size-4" />, label: "Подборки задач и фильтры" },
          { icon: <Filter className="size-4" />, label: "Уровни сложности" },
          { icon: <Trophy className="size-4" />, label: "Таблицы лидеров" },
          { icon: <ListChecks className="size-4" />, label: "Отслеживай прогресс" },
        ]}
      />
      <ModeCard
        tone="purple"
        title="История"
        subtitle="От нуля до героя."
        href="/story"
        cta="Продолжить путь"
        bannerSlot="banner/story"
        bullets={[
          { icon: <BookOpen className="size-4" />, label: "Обучение по главам" },
          { icon: <Map className="size-4" />, label: "Пошаговое освоение C#" },
          { icon: <Swords className="size-4" />, label: "Практические задания" },
          { icon: <GraduationCap className="size-4" />, label: "Стань уверенным разработчиком" },
        ]}
      />
    </div>
  );
}
