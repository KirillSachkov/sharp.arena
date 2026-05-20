import { Terminal } from "lucide-react";
import { Panel, PixelArtSlot } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type LanguageChip = {
  id: string;
  label: string;
  active?: boolean;
};

const LANGUAGES: LanguageChip[] = [
  { id: "csharp", label: "C#", active: true },
  { id: "typescript", label: "TypeScript" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
];

export function SiteFooter() {
  return (
    <Panel className="overflow-hidden">
      <div className="grid grid-cols-1 items-center gap-4 px-5 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="flex items-center gap-3">
          <PixelArtSlot
            slot="brand/sharp-arena-logo"
            size={32}
            label="SA"
            className="rounded-md border-primary/40 [background-color:var(--color-primary)]/5"
          />
          <div>
            <p className="font-pixel text-xs uppercase tracking-[0.18em] text-text">
              Sharp Arena <span className="text-text-muted">v1.0.0</span>
            </p>
            <p className="text-xs text-text-dim">Код. Практика. Покорение.</p>
          </div>
        </div>

        <p className="hidden text-center text-[11px] uppercase tracking-[0.16em] text-text-muted md:block">
          Сделано с любовью к коду{" "}
          <span className="text-accent-red" aria-hidden>
            ♥
          </span>
        </p>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            <Terminal className="mr-1 inline size-3" aria-hidden />
            Языки
          </span>
          {LANGUAGES.map((l) => (
            <span
              key={l.id}
              className={cn(
                "inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-semibold uppercase tracking-[0.12em]",
                l.active
                  ? "border-primary/50 bg-primary/15 text-primary-soft"
                  : "border-border-subtle text-text-muted",
              )}
            >
              {l.label}
            </span>
          ))}
          <span className="font-mono text-xs text-text-muted">…</span>
        </div>
      </div>
    </Panel>
  );
}
