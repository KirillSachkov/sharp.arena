"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { Chip } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

const DIFFICULTIES = ["Все", "Лёгкая", "Средняя", "Сложная"];
const TOPICS = [
  "Массивы",
  "Строки",
  "Хеш-таблица",
  "Связный список",
  "ДП",
  "Графы",
];

export function ArenaFilterBar() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-border-subtle bg-bg-elevated px-3 text-sm text-text-dim focus-within:border-primary/50">
          <Search className="size-4 text-text-muted" aria-hidden />
          <input
            type="search"
            placeholder="Поиск задач…"
            className="h-full w-full bg-transparent text-text outline-none placeholder:text-text-muted"
          />
        </label>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border-subtle bg-bg-elevated px-3 text-xs font-semibold uppercase tracking-[0.14em] text-text-dim hover:text-text"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Фильтры
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Сложность
        </span>
        {DIFFICULTIES.map((d, i) => (
          <button
            key={d}
            type="button"
            className={cn(
              "inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
              i === 0
                ? "border-primary/50 bg-primary/15 text-primary-soft"
                : "border-border-subtle text-text-muted hover:text-text",
            )}
          >
            {d}
          </button>
        ))}
        <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Тема
        </span>
        {TOPICS.map((t) => (
          <Chip key={t} tone="neutral">
            {t}
          </Chip>
        ))}
      </div>
    </div>
  );
}
