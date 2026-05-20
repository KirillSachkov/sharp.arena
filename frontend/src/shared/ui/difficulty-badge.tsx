import { cn } from "@/shared/lib/cn";
import { DIFFICULTY_LABEL, type Difficulty } from "@/shared/types";

const styles: Record<Difficulty, string> = {
  easy: "border-accent-green/40 bg-accent-green/10 text-accent-green",
  medium: "border-accent-gold/40 bg-accent-gold/10 text-accent-gold",
  hard: "border-accent-red/40 bg-accent-red/10 text-accent-red",
};

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.16em]",
        styles[difficulty],
        className,
      )}
    >
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}
