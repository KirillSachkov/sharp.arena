import { cn } from "@/shared/lib/cn";

type Tone = "primary" | "cyan" | "gold" | "green" | "red";

const toneClasses: Record<Tone, { ring: string; label: string }> = {
  primary: { ring: "stroke-primary", label: "text-primary-soft" },
  cyan: { ring: "stroke-accent-cyan", label: "text-accent-cyan" },
  gold: { ring: "stroke-accent-gold", label: "text-accent-gold" },
  green: { ring: "stroke-accent-green", label: "text-accent-green" },
  red: { ring: "stroke-accent-red", label: "text-accent-red" },
};

type CircularProgressProps = {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  tone?: Tone;
  label?: string;
  className?: string;
};

/**
 * SVG ring with a percentage in the center. Tone maps to a token color so the
 * ring + label share the same accent (purple / cyan / gold / green / red).
 *
 * Used in the Progress Overview dials and any future skill-mastery readout.
 */
export function CircularProgress({
  value,
  max = 100,
  size = 80,
  strokeWidth = 6,
  tone = "primary",
  label,
  className,
}: CircularProgressProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const tones = toneClasses[tone];

  return (
    <div
      role="img"
      aria-label={label ?? `${Math.round(pct)} percent`}
      className={cn(
        "relative inline-grid place-items-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-border-subtle"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset]", tones.ring)}
        />
      </svg>
      <span
        className={cn(
          "absolute font-pixel text-base tabular-nums",
          tones.label,
        )}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}
