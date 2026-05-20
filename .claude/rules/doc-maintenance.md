# Documentation maintenance

When you change something that touches one of these areas, update the
corresponding doc in the **same commit** — drift between code and docs is
the most common source of "the docs lie" papercuts.

## Update triggers

| If you change…                                                  | Update                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Domain entities, aggregates, value objects                      | `docs/ARCHITECTURE.md` → Data model section                           |
| API endpoints (new route, changed shape, removed)               | `docs/ARCHITECTURE.md` → API contract table                           |
| Adding a service (when Phase ≥ 4 splits the monolith)           | Root `CLAUDE.md` + `docs/ARCHITECTURE.md`                             |
| Adding a runner (TypeScript, Python, …)                         | `docs/ARCHITECTURE.md` → Abstractions / runners section; `ROADMAP.md` |
| Palette token, font, or typography rule                         | `docs/VISUAL.md`                                                      |
| New pixel-art slot or new asset folder                          | `docs/VISUAL.md` + `docs/art-style.md`                                |
| New rule, banned symbol, or convention                          | The relevant file in `.claude/rules/` (and root `CLAUDE.md` if it's a "hard rule") |
| New script in `scripts/`                                        | `docs/ops.md` → table of commands                                     |
| Phase status (a Phase-N box ships)                              | `docs/ROADMAP.md` (tick the box)                                      |

## When not to update docs

- Local debugging notes — these belong in your scratch space, not the repo.
- One-off TODOs scoped to a single PR — use the PR description.
- Internal refactors that don't change behavior, API, schema, or model.

## Style

- One sentence per line for prose-heavy files where possible — small diffs
  beat large reflows during reviews.
- Code blocks use language tags (`csharp`, `bash`, `json`, `tsx`).
- Tables for catalog-style content (API endpoints, slots, scripts), prose for
  the rest.
- When you remove a feature, **remove** the doc lines about it. Don't
  strikethrough or leave "deprecated" notes — that rots fast.
