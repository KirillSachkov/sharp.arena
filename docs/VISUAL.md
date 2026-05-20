# Visual style

Tone: pixel-RPG hybrid. Dark surface, pixel-art accents inside an otherwise
clean modern UI. Not a retro game — the chrome is contemporary, the
illustrations are pixel.

## Palette

All tokens live in `frontend/src/app/globals.css` under `@theme` so Tailwind 4
generates the utilities (`bg-bg-deep`, `text-primary`, …) automatically.

```
bg-deep        #0d1424   base page background
bg-panel       #161b2e   card/panel surface
bg-elevated    #1f2640   modal, popover
border-subtle  #2a3050   1px borders inside panels

text           #e4e6f0   primary copy
text-dim       #8b91a8   secondary copy
text-muted     #5a6080   tertiary / disabled

primary        #a855f7   purple — brand accent
primary-soft   #c084fc
accent-gold    #fbbf24   wins, XP, trophy
accent-green   #22c55e   passing test, success
accent-red     #ef4444   failing test, error
accent-cyan    #06b6d4   info, hints
```

## Typography

- **UI body and labels:** `Inter`. Loaded via `next/font/google` in the root
  layout; CSS variable `--font-inter`.
- **Headings (large, hero):** same family. `font-weight: 600`,
  `text-transform: uppercase`, `letter-spacing: 0.05em` (tracking 5%). No
  pixel font.
- **Code (Monaco editor + code blocks):** `JetBrains Mono` via
  `--font-jetbrains-mono`.

Sizes (defaults; refine per page in design):

```
hero           48–60px   landing / story chapter title
h1             32–40px   page title
h2             22–26px   section title
body           14–16px   default copy
small          12–13px   secondary copy / metadata
code           13–14px   Monaco, snippets
```

## Pixel-art slots

CSS forces `image-rendering: pixelated` on any element with class
`pixel-art` or `data-pixel-art="true"` (see `globals.css`).

| Slot           | Source size       | Where it appears                          |
| -------------- | ----------------- | ----------------------------------------- |
| Avatar         | 64×64 / 128×128   | Header, profile, leaderboard              |
| Mode banner    | 512×256           | Arena & Story landing cards               |
| Story map node | 32×32 / 64×64     | Story-map nodes                           |
| Victory trophy | 128×128           | `VictoryOverlay` after a successful run   |
| Achievement    | 32×32 / 48×48     | Profile, achievement strip                |

Assets live under `frontend/public/art/{avatar,banner,icon,trophy}/`. See
[art-style.md](./art-style.md) for the AI prompt template used to generate them.

## Composition rules

- **Hero blocks** breathe — generous vertical padding (≥ 64px), max-width
  ~640px text columns.
- **Cards** use `bg-bg-panel` + `border-border-subtle` + 8–12px radius;
  pixel-art assets sit flush at the top and the text starts below.
- **Code editor frame** uses `bg-bg-elevated` and a 1px `border-border-subtle`.
  Below the editor: Run button (primary), tests strip (rows colored by
  accent-green / accent-red).
- **Overlays** (`VictoryOverlay`, modals): `bg-bg-elevated/95` with a soft
  primary-purple glow (`box-shadow` ~ `0 0 60px -20px var(--color-primary)`).
- **Iconography** in chrome (lucide-react) stays vector, not pixel — pixel
  is reserved for illustrations.

## Don'ts

- No pixel font in body text. It reads poorly at long lengths and dates the
  product within months.
- No skeuomorphic 16-bit UI chrome. The chrome is modern.
- No drop-shadows below ~20% opacity — the deep base swallows them.
- No more than one purple accent per visible region (we have only one brand
  hue).
