import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { PixelArtSlot } from "./pixel-art-slot";

type VictoryOverlayProps = {
  xpEarned?: number;
  title?: string;
  trophyAsset?: string;
  onClose?: () => void;
  className?: string;
};

export function VictoryOverlay({
  xpEarned = 25,
  title = "Victory!",
  trophyAsset,
  onClose,
  className,
}: VictoryOverlayProps) {
  return (
    <div
      role="dialog"
      aria-label="Victory"
      className={cn(
        "pointer-events-auto absolute inset-x-6 bottom-6 z-30 flex items-center justify-between gap-6 rounded-xl border border-accent-green/50 bg-bg-elevated/95 p-6 shadow-[0_0_80px_-30px_var(--color-primary)] backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center gap-5">
        <PixelArtSlot
          slot="trophy"
          src={trophyAsset}
          size={96}
          label="Trophy"
          className="bg-bg-deep"
        />
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent-green">
            ✓ {title}
          </p>
          <p className="font-pixel text-2xl uppercase tracking-[0.06em] text-text">
            +{xpEarned} XP Earned
          </p>
          <p className="text-xs text-text-dim">
            All tests passed — your streak just got longer.
          </p>
        </div>
      </div>
      {onClose ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-md text-text-muted transition-colors hover:bg-bg-panel hover:text-text"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
