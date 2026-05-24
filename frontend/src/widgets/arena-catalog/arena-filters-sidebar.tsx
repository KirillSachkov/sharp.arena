"use client";

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Panel } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type FilterTone = "neutral" | "green" | "gold" | "red" | "purple" | "cyan";

type FilterRow = {
  id: string;
  label: string;
  count: number;
  marker?: string;
  tone?: FilterTone;
  defaultChecked?: boolean;
};

type FilterGroup = {
  id: string;
  title: string;
  rows: FilterRow[];
};

const TONE_DOT: Record<FilterTone, string> = {
  neutral: "bg-text-muted",
  green: "bg-accent-green",
  gold: "bg-accent-gold",
  red: "bg-accent-red",
  purple: "bg-primary",
  cyan: "bg-accent-cyan",
};

const GROUPS: FilterGroup[] = [
  {
    id: "difficulty",
    title: "Сложность",
    rows: [
      {
        id: "easy",
        label: "Лёгкая",
        count: 146,
        marker: "🟢",
        tone: "green",
        defaultChecked: true,
      },
      {
        id: "medium",
        label: "Средняя",
        count: 182,
        marker: "🟡",
        tone: "gold",
        defaultChecked: true,
      },
      {
        id: "hard",
        label: "Сложная",
        count: 98,
        marker: "🔴",
        tone: "red",
        defaultChecked: true,
      },
      {
        id: "expert",
        label: "Эксперт",
        count: 34,
        marker: "🟣",
        tone: "purple",
        defaultChecked: true,
      },
    ],
  },
  {
    id: "status",
    title: "Статус",
    rows: [
      { id: "not-started", label: "Новая", count: 312, marker: "○", tone: "neutral" },
      { id: "in-progress", label: "В процессе", count: 28, marker: "◔", tone: "cyan" },
      { id: "solved", label: "Решено", count: 120, marker: "✓", tone: "green" },
    ],
  },
  {
    id: "topics",
    title: "Темы",
    rows: [
      { id: "csharp", label: "C# Basics", count: 64, tone: "purple" },
      { id: "oop", label: "OOP", count: 48, tone: "gold" },
      { id: "collections", label: "Collections", count: 32, tone: "cyan" },
      { id: "linq", label: "LINQ", count: 28, tone: "purple" },
      { id: "async", label: "Async", count: 36, tone: "gold" },
      { id: "algorithms", label: "Algorithms", count: 72, tone: "cyan" },
      { id: "data-structures", label: "Data Structures", count: 54, tone: "purple" },
      { id: "aspnet", label: "ASP.NET Core", count: 44, tone: "cyan" },
      { id: "web-api", label: "Web API", count: 38, tone: "gold" },
      { id: "websockets", label: "WebSockets", count: 22, tone: "green" },
      { id: "ef-core", label: "EF Core", count: 28, tone: "purple" },
      { id: "sql", label: "SQL", count: 26, tone: "cyan" },
    ],
  },
  {
    id: "format",
    title: "Тип / Формат",
    rows: [
      { id: "single", label: "Одиночная", count: 264 },
      { id: "mini-quest", label: "Мини-квест", count: 34 },
      { id: "boss", label: "Босс", count: 10 },
      { id: "pack", label: "Подборка", count: 10 },
    ],
  },
];

export function ArenaFiltersSidebar({ className }: { className?: string }) {
  return (
    <Panel className={cn("h-fit overflow-hidden", className)}>
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h3 className="font-pixel text-[11px] uppercase tracking-[0.22em] text-text">
          Фильтры
        </h3>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted transition-colors hover:text-text"
        >
          <RotateCcw className="size-3" aria-hidden />
          Сбросить
        </button>
      </header>

      <div className="divide-y divide-border-subtle/70">
        {GROUPS.map((group) => (
          <FilterGroupBlock key={group.id} group={group} />
        ))}
      </div>
    </Panel>
  );
}

function FilterGroupBlock({ group }: { group: FilterGroup }) {
  return (
    <section className="px-4 py-4">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
        {group.title}
      </p>
      <ul className="space-y-1.5">
        {group.rows.map((row) => (
          <FilterRowItem key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}

function FilterRowItem({ row }: { row: FilterRow }) {
  const [checked, setChecked] = useState(Boolean(row.defaultChecked));
  return (
    <li>
      <label className="group flex h-7 cursor-pointer items-center gap-2 rounded-md px-1 text-[12px] text-text-dim transition-colors hover:bg-bg-elevated hover:text-text">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span
          aria-hidden
          className={cn(
            "grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors",
            checked
              ? "border-primary/70 bg-primary/30 text-text"
              : "border-border-subtle bg-bg-elevated",
          )}
        >
          {checked ? (
            <Check className="size-3" strokeWidth={3} aria-hidden />
          ) : null}
        </span>
        {row.tone ? (
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              TONE_DOT[row.tone],
            )}
          />
        ) : null}
        <span className="flex-1 truncate">{row.label}</span>
        <span className="font-mono text-[10px] tabular-nums text-text-muted">
          ({row.count})
        </span>
      </label>
    </li>
  );
}
