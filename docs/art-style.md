# Pixel-art style guide

Sharp Arena uses pixel-art illustrations against a modern dark UI. This file
documents the visual language and the AI-generation prompt template.

## Visual language

- **Resolution:** sprite-native sizes — 32×32, 64×64, 128×128, 256×256, 512×256.
  Render upscaled in the UI; CSS `image-rendering: pixelated` keeps edges crisp.
- **Palette:** stay within the Sharp Arena palette (see `VISUAL.md`). Use the
  accent colors (gold for victory, green for success, red for failure) inside
  illustrations sparingly — they are signals.
- **Style references:** late-Genesis / SNES / early CRPG. Limited palette per
  sprite (≤ 12 colors), readable silhouette, 1-px outlines optional but
  consistent within a set.
- **Don't:** anti-aliasing on outlines, soft drop-shadows on the sprite
  itself, modern flat-design illustrations that happen to be small —
  the texture must be pixel.

## Slots & sizes

| Slot              | Native size | Notes                                                  |
| ----------------- | ----------- | ------------------------------------------------------ |
| Avatar            | 64×64       | Optional 128×128 hi-res for profile                    |
| Mode banner       | 512×256     | Arena / Story landing cards                            |
| Story map node    | 32×32       | Two states: locked (dim), unlocked (lit)               |
| Victory trophy    | 128×128     | Center of `VictoryOverlay`                             |
| Achievement icon  | 32×32       | Profile strip; 48×48 hover state                       |
| Language emblem   | 64×64       | One per supported language (C# avatar, TS avatar, …)   |

## AI generation prompt template

Use this as the base prompt for the first pass; iterate on details, but keep
the **fixed clauses** verbatim — they encode the palette and constraints.

```
Subject:        {what to draw, one sentence}
Size:           {pixel dimensions, e.g. 128×128}
Slot:           {Avatar | Mode banner | Story map node | Victory trophy | Achievement | Language emblem}

[FIXED CLAUSES — do not edit]
Style: pixel art, sprite-native resolution, limited 12-color palette, 1-px
outline if present must be consistent, no anti-aliasing on edges, no soft
drop-shadow on the sprite itself, no modern flat-design / vector look.
Color palette to draw from: #0d1424 (deep navy), #161b2e (panel),
#1f2640 (elevated), #2a3050 (border), #e4e6f0 (light text),
#a855f7 (purple primary), #c084fc (purple soft), #fbbf24 (gold accent),
#22c55e (green accent), #ef4444 (red accent), #06b6d4 (cyan accent).
Background: transparent unless the slot is a banner.
Reference era: late-Genesis / SNES / early CRPG pixel art.
Subject must read clearly at 1× scale (silhouette test).
```

## Curating outputs

1. Generate 4 candidates. Reject any that anti-alias the outline or stray
   from the palette.
2. Check silhouette at 1× — if the shape isn't readable, reject.
3. Final asset goes to `frontend/public/art/<slot>/<name>.png` in its native
   size. The UI scales up via CSS; do not pre-scale.
4. Commit with a note in the PR describing the prompt seed and which engine
   (Midjourney / SDXL / etc.) was used — for reproducibility when we want
   a matching follow-up sprite.

## Asset filename convention

```
frontend/public/art/avatar/c-sharp-default.png
frontend/public/art/banner/arena.png
frontend/public/art/banner/story.png
frontend/public/art/icon/story-node-locked.png
frontend/public/art/icon/story-node-unlocked.png
frontend/public/art/trophy/victory-default.png
```

kebab-case, no spaces, native pixel size implied by the slot.
