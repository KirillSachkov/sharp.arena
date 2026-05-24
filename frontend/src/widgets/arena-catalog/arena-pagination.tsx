"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type ArenaPaginationProps = {
  shown: number;
  total: number;
  pageSize?: number;
};

/**
 * Bottom pagination strip: "1-N of total", page numbers (1, 2, 3, 4, 5, …, last),
 * prev/next arrows, and rows-per-page selector. Pure UI in Phase 0; state lives
 * locally so the active page is interactive even without data wiring.
 */
export function ArenaPagination({
  shown,
  total,
  pageSize = 10,
}: ArenaPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const [page, setPage] = useState(1);

  const pages = buildPages(page, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-bg-panel px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
        1–{shown} <span className="text-text-muted/70">из</span>{" "}
        <span className="text-text">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        <PageButton
          ariaLabel="Предыдущая"
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="size-3.5" aria-hidden />
        </PageButton>
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`ellipsis-${i}`}
              aria-hidden
              className="grid size-8 place-items-center font-mono text-[11px] text-text-muted"
            >
              …
            </span>
          ) : (
            <PageButton
              key={p}
              ariaLabel={`Страница ${p}`}
              active={p === page}
              onClick={() => setPage(p)}
            >
              {p}
            </PageButton>
          ),
        )}
        <PageButton
          ariaLabel="Следующая"
          disabled={page === pageCount}
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
        >
          <ChevronRight className="size-3.5" aria-hidden />
        </PageButton>
      </div>

      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
        <span>На странице</span>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border-subtle bg-bg-elevated px-2 text-[11px] font-semibold text-text"
        >
          {pageSize}
          <ChevronDown className="size-3 text-text-muted" aria-hidden />
        </button>
      </div>
    </div>
  );
}

type PageButtonProps = {
  children: React.ReactNode;
  ariaLabel: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

function PageButton({
  children,
  ariaLabel,
  active,
  disabled,
  onClick,
}: PageButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-md font-mono text-[11px] font-semibold tabular-nums transition-colors",
        active
          ? "bg-primary text-white shadow-[0_0_24px_-8px_var(--color-primary)]"
          : "border border-border-subtle bg-bg-elevated text-text-dim hover:border-primary/40 hover:text-text",
        disabled && "cursor-not-allowed opacity-40 hover:border-border-subtle hover:text-text-dim",
      )}
    >
      {children}
    </button>
  );
}

function buildPages(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const out: Array<number | "…"> = [];
  out.push(1);
  if (current > 4) out.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) out.push(i);
  if (current < total - 3) out.push("…");
  out.push(total);
  return out;
}
