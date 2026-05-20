import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  trailing?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  trailing,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-4 border-b border-border-subtle px-6 py-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-dim transition-colors hover:text-text"
          >
            <ChevronLeft className="size-4" aria-hidden />
            <span>{backLabel ?? "Back"}</span>
          </Link>
        ) : null}
        <h1 className="truncate text-sm font-semibold uppercase tracking-[0.22em] text-text">
          {title}
        </h1>
        {subtitle != null ? (
          <span className="truncate text-xs uppercase tracking-[0.18em] text-text-muted">
            <span aria-hidden className="mx-1 text-text-muted/70">
              ›
            </span>
            {subtitle}
          </span>
        ) : null}
      </div>
      {trailing != null ? (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      ) : null}
    </header>
  );
}
