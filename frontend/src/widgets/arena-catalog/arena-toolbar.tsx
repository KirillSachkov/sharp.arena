"use client";

import { ChevronDown, LayoutGrid, LayoutList, Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/lib/cn";

type SelectField = {
  id: string;
  label: string;
  value: string;
};

const SELECTS: SelectField[] = [
  { id: "sort", label: "Сортировка", value: "По популярности" },
  { id: "difficulty", label: "Сложность", value: "Все" },
  { id: "status", label: "Статус", value: "Все" },
  { id: "topic", label: "Тема / Язык", value: "Все темы" },
];

const VIEW_TABS = [
  { id: "all", label: "Все задачи" },
  { id: "collections", label: "Подборки" },
  { id: "topics", label: "Темы" },
];

/**
 * Top control strip for the arena catalog. Split into two visual rows so the
 * page reads cleanly at the 1440px reference width without horizontal
 * crowding:
 *   row 1 (right side of hero):  view tabs + grid/list mode
 *   row 2 (full width below):    search + 4 dropdown filters
 *
 * State is purely visual in Phase 0 — wiring lands with the API in Phase 1.
 */
export function ArenaToolbar() {
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div
          role="tablist"
          className="inline-flex items-center gap-0.5 rounded-lg border border-border-subtle bg-bg-elevated p-1"
        >
          {VIEW_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "h-8 rounded-md px-3 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors",
                  isActive
                    ? "bg-primary/20 text-primary-soft shadow-[0_0_18px_-6px_var(--color-primary)]"
                    : "text-text-muted hover:text-text",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border-subtle bg-bg-elevated p-1">
          <ViewModeButton
            label="Сетка"
            active={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="size-3.5" aria-hidden />
          </ViewModeButton>
          <ViewModeButton
            label="Список"
            active={viewMode === "list"}
            onClick={() => setViewMode("list")}
          >
            <LayoutList className="size-3.5" aria-hidden />
          </ViewModeButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-11 min-w-[16rem] flex-1 items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-3.5 text-sm text-text-dim focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="size-4 text-text-muted" aria-hidden />
          <input
            type="search"
            placeholder="Поиск задач, тем или ключевых слов…"
            className="h-full w-full bg-transparent text-text outline-none placeholder:text-text-muted"
          />
        </label>
        {SELECTS.map((s) => (
          <FakeSelect key={s.id} label={s.label} value={s.value} />
        ))}
      </div>
    </div>
  );
}

function FakeSelect({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      className="group flex h-11 items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated pl-3 pr-2 text-left transition-colors hover:border-primary/40"
    >
      <span className="flex flex-col leading-tight">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
          {label}
        </span>
        <span className="text-[12px] font-semibold text-text">{value}</span>
      </span>
      <ChevronDown
        className="size-3.5 text-text-muted transition-transform group-hover:translate-y-px"
        aria-hidden
      />
    </button>
  );
}

function ViewModeButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-md transition-colors",
        active
          ? "bg-bg-panel text-text shadow-[0_0_0_1px_var(--color-border-subtle)]"
          : "text-text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
