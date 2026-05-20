"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";

export type SegmentedTabsItem = {
  id: string;
  label: string;
};

type SegmentedTabsProps = {
  items: SegmentedTabsItem[];
  defaultActiveId?: string;
  onChange?: (id: string) => void;
  size?: "sm" | "md";
  variant?: "underline" | "pill";
  className?: string;
};

export function SegmentedTabs({
  items,
  defaultActiveId,
  onChange,
  size = "md",
  variant = "underline",
  className,
}: SegmentedTabsProps) {
  const [active, setActive] = useState(defaultActiveId ?? items[0]?.id);

  const select = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  if (variant === "pill") {
    return (
      <div
        role="tablist"
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-elevated p-1",
          className,
        )}
      >
        {items.map((it) => {
          const isActive = it.id === active;
          return (
            <button
              key={it.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(it.id)}
              className={cn(
                "rounded-md font-semibold uppercase tracking-[0.16em] transition-colors",
                size === "sm" ? "h-7 px-3 text-[10px]" : "h-8 px-4 text-[11px]",
                isActive
                  ? "bg-bg-panel text-text shadow-[0_0_0_1px_var(--color-border-subtle)]"
                  : "text-text-muted hover:text-text",
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-6 border-b border-border-subtle",
        className,
      )}
    >
      {items.map((it) => {
        const isActive = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => select(it.id)}
            className={cn(
              "relative -mb-px border-b-2 px-1 font-semibold uppercase tracking-[0.18em] transition-colors",
              size === "sm" ? "h-9 text-[10px]" : "h-10 text-xs",
              isActive
                ? "border-primary text-text"
                : "border-transparent text-text-muted hover:text-text-dim",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
