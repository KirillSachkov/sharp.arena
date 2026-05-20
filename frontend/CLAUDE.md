# Frontend — service memory

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4. Strict FSD layout.

## Layers (top → bottom)

```
src/app        # Next.js App Router pages & layouts
src/widgets    # Composite UI blocks (e.g. VictoryOverlay, StoryMap)
src/features   # Use-case slices (run-code, browse-tasks)
src/entities   # Domain (task, package, user) — api.ts, types.ts, index.ts
src/shared     # UI kit, API client, utils
```

## Hard rules

- **No upward imports.** Lower layer never imports from upper. Enforced by
  `eslint-plugin-boundaries`. `npm run lint` fails on violation.
- **No cross-slice imports** in `features/`. If `features/A` needs something
  from `features/B`, lift it to `entities/` or `shared/`.
- **Public API via `index.ts`.** External consumers import from the slice
  barrel, not internal files.
- **No manual memoization.** React Compiler (React 19) handles it — no
  `useMemo` / `useCallback` / `React.memo` by hand.
- **Immutable updates.** Never mutate objects/arrays in place; return new refs.

## Patterns

- **Mutation hooks:** `use-{action}-{entity}.ts` per feature
  (e.g. `use-run-code.ts`, `use-submit-task.ts`).
- **Entity layer:** `api.ts` (query options factories for TanStack Query),
  `types.ts` (DTO/domain types), `index.ts` (barrel).
- **API URLs** always include a trailing slash — nginx returns `301` otherwise,
  which breaks CORS preflight.
- **Status enums** reused across `shared/ui/` components live in
  `shared/types/status.ts`, not in `entities/`, to avoid an upward
  `shared → entities` dependency.

## Styling

- Tailwind 4 with the design tokens defined in `src/app/globals.css` (`@theme`).
  See [/docs/VISUAL.md](../docs/VISUAL.md) for the full palette spec.
- shadcn/ui components, when added, live in `src/shared/ui/kit/`.
- `cn()` utility (planned in `src/shared/lib/cn.ts`) for conditional classes.

## Pixel-art assets

Live under `public/art/{avatar,banner,icon,trophy}/`. Render with
`<img class="pixel-art">` or any element with `data-pixel-art="true"` — CSS
forces `image-rendering: pixelated`.

## Pre-commit

`.husky/pre-commit` runs `lint-staged` on staged files in `frontend/`:
`eslint --fix --max-warnings=0` then `prettier --write`. `npm install`
in `frontend/` registers the hook via the `prepare` script.

## Phase 0 status

Landing page only (`src/app/page.tsx`). Empty FSD layer directories ready for
features in Phase 1.
