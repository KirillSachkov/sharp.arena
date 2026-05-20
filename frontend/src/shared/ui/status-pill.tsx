import { cn } from "@/shared/lib/cn";
import type { TaskStatus, TestStatus } from "@/shared/types";

const taskStyles: Record<TaskStatus, { label: string; className: string }> = {
  "not-started": {
    label: "Новая",
    className: "border-border-subtle bg-bg-elevated text-text-muted",
  },
  "in-progress": {
    label: "В процессе",
    className: "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan",
  },
  solved: {
    label: "Решено",
    className: "border-accent-green/40 bg-accent-green/10 text-accent-green",
  },
  perfect: {
    label: "Идеально",
    className: "border-accent-gold/40 bg-accent-gold/15 text-accent-gold",
  },
};

const testStyles: Record<TestStatus, { label: string; className: string }> = {
  passed: { label: "Пройден", className: "text-accent-green" },
  failed: { label: "Не пройден", className: "text-accent-red" },
  pending: { label: "Ожидание", className: "text-text-muted" },
};

export function TaskStatusPill({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const s = taskStyles[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.16em]",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}

export function TestStatusLabel({
  status,
  className,
}: {
  status: TestStatus;
  className?: string;
}) {
  const s = testStyles[status];
  return (
    <span
      className={cn(
        "font-mono text-xs font-semibold",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}
