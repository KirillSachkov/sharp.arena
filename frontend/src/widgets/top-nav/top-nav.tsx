"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Code2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { IconButton, PixelArtSlot } from "@/shared/ui";
import { MOCK_PLAYER, PlayerAvatar } from "@/entities/player";

type NavItem = {
  href: string;
  label: string;
  match: (path: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Арена",
    match: (p) => p === "/" || p.startsWith("/arena"),
  },
  { href: "/story", label: "История", match: (p) => p.startsWith("/story") },
  {
    href: "/leaderboard",
    label: "Рейтинг",
    match: (p) => p.startsWith("/leaderboard"),
  },
  {
    href: "/profile",
    label: "Профиль",
    match: (p) => p.startsWith("/profile"),
  },
];

export function TopNav() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg-deep/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:gap-6">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-text sm:tracking-[0.16em] lg:gap-3 lg:text-sm lg:tracking-[0.22em]"
        >
          {/*
           * Brand mark — drop a 48×48 pixel-art logo into
           * `public/art/brand/sharp-arena-logo.png` to replace the placeholder.
           */}
          <PixelArtSlot
            slot="brand/sharp-arena-logo"
            size={32}
            label="SA"
            className="rounded-md border-primary/60 [background-color:var(--color-primary)]/10"
          />
          <span className="hidden md:inline">Sharp Arena</span>
        </Link>

        <nav className="flex h-full min-w-0 flex-1 items-center justify-start gap-0 sm:justify-center md:flex-none md:justify-start md:gap-0.5 lg:gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-14 items-center px-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors sm:px-2.5 sm:tracking-[0.12em] lg:px-3 lg:text-xs lg:tracking-[0.16em]",
                  active
                    ? "text-text"
                    : "text-text-muted hover:text-text-dim",
                )}
              >
                {item.label}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-primary sm:inset-x-2.5 lg:inset-x-3"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <IconButton
            label="Открыть редактор"
            className="hidden sm:grid"
          >
            <Code2 className="size-4" aria-hidden />
          </IconButton>
          <IconButton label="Уведомления" badge className="hidden sm:grid">
            <Bell className="size-4" aria-hidden />
          </IconButton>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-panel/60 py-1 pl-1 pr-1.5 transition-colors hover:border-primary/40 sm:gap-3 sm:pr-2.5"
          >
            <PlayerAvatar src={MOCK_PLAYER.avatarAsset} size={32} />
            <div className="hidden min-w-0 leading-tight sm:block">
              <p className="text-xs font-semibold text-text">
                {MOCK_PLAYER.handle}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
                Уровень {MOCK_PLAYER.level}
              </p>
            </div>
            <ChevronDown
              className="hidden size-3.5 text-text-muted sm:block"
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
