import { cn } from "@/shared/lib/cn";
import type { TestStatus } from "@/shared/types";
import { TestStatusLabel } from "./status-pill";

type TestRowProps = {
  index: number;
  status: TestStatus;
  durationMs?: number;
  message?: string;
  className?: string;
};

export function TestRow({
  index,
  status,
  durationMs,
  message,
  className,
}: TestRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-border-subtle/70 px-4 py-2.5 font-mono text-xs last:border-b-0",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-text-dim">Test case {index}</span>
        {message ? (
          <span className="truncate text-text-muted">— {message}</span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <TestStatusLabel status={status} />
        {durationMs != null ? (
          <span className="tabular-nums text-text-muted">{durationMs}ms</span>
        ) : null}
      </div>
    </div>
  );
}
