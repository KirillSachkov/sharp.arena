# Pixel-art slot map

Every spot on the UI that expects pixel art is wired through
`<PixelArtSlot slot="..." />`. Until you drop a real PNG in, the slot renders
a checker-pattern placeholder with the slot key visible — so you always know
which asset goes where.

## How to replace a placeholder

1. Generate a PNG at the **native pixel size** listed below (no upscaling —
   CSS handles that via `image-rendering: pixelated`).
2. Save it to the exact path under `frontend/public/art/<slot>.png`.
3. Either:
   - **Convention path** — the slot key already maps to that path, so the
     placeholder picks it up automatically once you reload. Recommended.
   - **Explicit** — pass `src="/art/.../file.png"` to the `PixelArtSlot` or
     set the `*Asset` field on the entity mock (`avatarAsset`,
     `emblemAsset`, `nodeAsset`, `iconAsset`).

Always follow the rules in [`docs/art-style.md`](../../docs/art-style.md) for
palette, outline, and silhouette.

## Slot inventory (Phase 0 dashboard)

| Slot key                          | Native size | Where it appears                                  |
| --------------------------------- | ----------- | ------------------------------------------------- |
| `brand/sharp-arena-logo`          | 32×32 / 48×48 | Top nav brand mark, footer                      |
| `avatar/code-ninja`               | 64×64       | Current player avatar (top nav, hero, leaderboard) |
| `avatar/devmaster`                | 32×32       | Top players row                                   |
| `avatar/sharpy`                   | 32×32       | Top players row                                   |
| `avatar/bytebender`               | 32×32       | Top players row                                   |
| `avatar/nullpointer`              | 32×32       | Top players row                                   |
| `banner/arena`                    | 512×256     | Arena action card banner                          |
| `banner/story`                    | 512×256     | Story action card banner                          |
| `emblem/platinum-ii`              | 64×64       | Division emblem in player strip                   |
| `icon/daily-challenge`            | 48×48       | Daily Challenge card icon                         |
| `icon/story-node-castle`          | 32×32       | Story map — Chapter 1 (Getting Started)           |
| `icon/story-node-hexagon`         | 32×32       | Story map — Chapter 2 (Variables & Types)         |
| `icon/story-node-warrior`         | 32×32       | Story map — Chapter 3 (Control Flow, current)     |
| `icon/story-node-locked`          | 32×32       | Story map — locked chapters (Methods, DS, OOP, Adv) |
| `icon/story-node-boss`            | 64×64       | Story map — Chapter 8 (Mastery, boss node)        |
| `icon/achievement-streak`         | 32×32       | Achievements — Streak Master                      |
| `icon/achievement-solver`         | 32×32       | Achievements — Problem Solver                     |
| `icon/achievement-warrior`        | 32×32       | Achievements — Code Warrior                       |
| `trophy/victory-default`          | 128×128     | VictoryOverlay on the task page                   |

## Where the slot keys live in code

- **Top nav brand**: `src/widgets/top-nav/top-nav.tsx` — `slot="brand/sharp-arena-logo"`
- **Avatars**: `src/entities/player/ui/player-avatar.tsx` (current player),
  `src/entities/leaderboard/types.ts` (`avatarSlot` field per row)
- **Action banners**: `src/widgets/dashboard/action-cards.tsx`
  (`bannerSlot` prop on each `ModeCard`)
- **Division emblem**: `src/widgets/dashboard/player-strip.tsx` — slot derived
  from `player.division.id`
- **Story map nodes**: `src/entities/chapter/types.ts` (`nodeSlot` field per chapter)
- **Achievement icons**: `src/entities/achievement/types.ts` (`iconSlot` field)
- **Victory trophy**: `src/shared/ui/victory-overlay.tsx`

## Adding a new slot

1. Pick a path under `public/art/<group>/<name>` — match the existing groups
   (`avatar`, `banner`, `brand`, `emblem`, `icon`, `trophy`).
2. Use `<PixelArtSlot slot="<group>/<name>" size={...} label="..." />` in the
   component. The `label` shows in the placeholder until you drop a real PNG.
3. Add a row to this table.

The placeholder will keep working as long as the slot exists — you can ship
features without art and slot real PNGs in incrementally.
