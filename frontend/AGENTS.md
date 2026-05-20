# Sharp Arena frontend — agent instructions

Next.js 16 App Router + React 19 + TypeScript + Tailwind 4. Strict Feature-Sliced
Design layout. Detailed rules in `CLAUDE.md` (same directory) and the root
`.claude/rules/frontend-fsd.md`.

## Quick rules

- Layers (top → bottom, no upward imports, no cross-slice imports):
  `app` → `widgets` → `features` → `entities` → `shared`.
- React Compiler handles memoization — do not write `useMemo` / `useCallback` /
  `React.memo` by hand. Treat state updates as immutable.
- Public API of every slice is `index.ts`. External consumers import from the
  barrel.
- API URLs always end with a slash.
- shadcn/ui components live under `src/shared/ui/kit/`. Use the `cn()` helper
  for conditional classes.
- Design tokens are in `src/app/globals.css` under `@theme`. See
  `/docs/VISUAL.md` for palette.
