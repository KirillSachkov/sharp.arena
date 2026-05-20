import { cn } from "@/shared/lib/cn";

type PixelArtSlotProps = {
  slot: string;
  size?: 32 | 48 | 64 | 96 | 128 | 256;
  aspect?: "square" | "banner";
  label?: string;
  className?: string;
  src?: string;
  alt?: string;
};

/**
 * Visual placeholder for a pixel-art asset that hasn't been generated yet.
 * Renders a deterministic checker pattern with the slot name overlaid so the
 * layout reads correctly during scaffolding. Replace by passing `src` once the
 * real asset lands in `frontend/public/art/<slot>/<name>.png`.
 */
export function PixelArtSlot({
  slot,
  size = 64,
  aspect = "square",
  label,
  className,
  src,
  alt,
}: PixelArtSlotProps) {
  const dims =
    aspect === "banner"
      ? { width: size * 2, height: size }
      : { width: size, height: size };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- pixel-art needs exact px sizing + `image-rendering: pixelated`; next/image's responsive scaling breaks the look.
      <img
        src={src}
        alt={alt ?? slot}
        className={cn("pixel-art block", className)}
        style={dims}
        width={dims.width}
        height={dims.height}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt ?? `${slot} placeholder`}
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-md border border-border-subtle bg-bg-elevated",
        "bg-[linear-gradient(45deg,var(--color-bg-elevated)_25%,transparent_25%),linear-gradient(-45deg,var(--color-bg-elevated)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--color-bg-elevated)_75%),linear-gradient(-45deg,transparent_75%,var(--color-bg-elevated)_75%)]",
        "bg-[length:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0]",
        "[background-color:var(--color-bg-deep)]",
        className,
      )}
      style={dims}
    >
      <span className="z-10 max-w-full truncate px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label ?? slot}
      </span>
    </div>
  );
}
