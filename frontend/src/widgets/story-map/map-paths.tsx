import type { ChapterSummary } from "@/entities/chapter";
import type { MapPath } from "@/entities/campaign";

type Props = {
  paths: MapPath[];
  chapters: ChapterSummary[];
};

export function MapPaths({ paths, chapters }: Props) {
  const byId = new Map(chapters.map((c) => [c.id, c]));
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {paths.map((p) => {
        const from = byId.get(p.fromChapterId);
        const to = byId.get(p.toChapterId);
        if (!from || !to) return null;
        const stroke =
          p.style === "dashed" ? "var(--color-text-muted)" : "var(--color-primary)";
        return (
          <line
            key={p.id}
            x1={from.mapPosition.x}
            y1={from.mapPosition.y}
            x2={to.mapPosition.x}
            y2={to.mapPosition.y}
            stroke={stroke}
            strokeOpacity={p.style === "dashed" ? 0.5 : 0.7}
            strokeWidth={0.45}
            strokeDasharray={p.style === "dashed" ? "1.2 0.8" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
