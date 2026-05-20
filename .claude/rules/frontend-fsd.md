# Frontend: Feature-Sliced Design (FSD)

## Layer hierarchy (top → bottom)

```
app → widgets → features → entities → shared
```

## Hard rules

- **No upward imports** — a lower layer must never import from a higher one.
  Mechanically enforced by `eslint-plugin-boundaries` in
  `frontend/eslint.config.mjs`. `npm run lint` fails on violation.
- **No cross-slice imports** — `features/A` must not import from `features/B`.
  Communicate via `entities/` or `shared/`. If two features need to share
  logic, lift it to `entities/`.
- **Public API via `index.ts`** — external consumers import from the slice
  barrel, not from internal files.
- **Status types in `shared/types/`** — any status enum reused across multiple
  `shared/ui/` components (`StatusBadge`, …) lives in `shared/types/status.ts`.
  Keeping it in `entities/` creates an upward `shared → entities` dependency
  and breaks the lint gate.

## React Compiler (React 19)

- Do **not** use `useCallback`, `useMemo`, `React.memo` manually — React
  Compiler handles memoization.
- Do **not** mutate objects / arrays in place — always return new references.
- Avoid `useRef` to store render-affecting data.

## Patterns

- **Composition / Slot pattern for pages:** a page composes widgets as slots,
  it does not import widget internals.
- **Mutation hooks:** one per feature, named `use-{action}-{entity}.ts`
  (e.g., `use-run-code.ts`, `use-submit-task.ts`).
- **Entity layer:** `api.ts` (query options factories for TanStack Query),
  `types.ts` (DTO/domain types), `index.ts` (barrel). One folder per entity.
- **API URLs:** always include the trailing slash. nginx returns `301`
  without it, which breaks CORS preflight.

## Styling

- Tailwind 4 with design tokens in `src/app/globals.css` (`@theme`). The
  Sharp Arena palette is documented in [`/docs/VISUAL.md`](../../docs/VISUAL.md).
- shadcn/ui components, when added, go to `src/shared/ui/kit/`.
- `cn()` utility (planned in `src/shared/lib/cn.ts`) for conditional classes.

## Pre-commit

`frontend/.husky/pre-commit` runs `npx lint-staged` against staged files
under `frontend/`:

- `**/*.{ts,tsx,js,jsx}`: `eslint --fix --max-warnings=0` then `prettier --write`.
- `**/*.{json,md,yml,yaml,css}`: `prettier --write`.

`npm install` in `frontend/` registers the hook (the `prepare` script in
`package.json`).
