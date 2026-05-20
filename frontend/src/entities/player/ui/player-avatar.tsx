import { PixelArtSlot } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type PlayerAvatarProps = {
  src?: string;
  alt?: string;
  size?: 32 | 48 | 64 | 96 | 128;
  className?: string;
};

export function PlayerAvatar({
  src,
  alt = "Player avatar",
  size = 48,
  className,
}: PlayerAvatarProps) {
  return (
    <PixelArtSlot
      slot="avatar"
      src={src}
      alt={alt}
      size={size}
      label="AVA"
      className={cn("rounded-md border border-primary/40", className)}
    />
  );
}
