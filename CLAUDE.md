# Sharp Arena — project memory

Standalone game-style platform for programming challenges. C# first, multi-language
ready by design via `IRunner` / `ITestFormat` / `IContentLoader` abstractions.

## What this codebase is

- **Two modes, one engine.** A single `tasks` table backs both **Arena**
  (free practice, packages) and **Story** (chapters with gating).
  Difference is navigation/UI, not data model.
- **Multi-language from day 1.** New language = new `runners/<lang>/Dockerfile`
  + `IRunner` implementation. Core engine unchanged.
- **Anti-scope MVP.** No AI tutor, no WebSockets, no Judge0, no Redis/RabbitMQ,
  no Kubernetes, no integration with external auth. Single backend, single VPS.

## Layout

| Path                  | Owns                                                        |
| --------------------- | ----------------------------------------------------------- |
| `backend/ArenaApi/`   | Single .NET 10 service (Web / Core / Domain / Contracts / Infrastructure.Postgres) |
| `backend/Shared/`     | Reserved for future cross-cutting code; empty in Phase 0    |
| `frontend/`           | Next.js 16 App Router, FSD layers, Tailwind 4               |
| `runners/<lang>/`     | One Dockerfile per supported language. Phase 0 = TODO       |
| `docker/postgres/`    | DB init SQL (schema + extensions)                           |
| `docs/`               | Architecture, visual style, roadmap                         |
| `.claude/rules/`      | Conventions auto-loaded by Claude Code                      |

## Phases

Detailed checklists in [docs/ROADMAP.md](docs/ROADMAP.md).

- **Phase 0 (current bootstrap)** — repo scaffold, health endpoint, landing page.
- **Phase 1** — Arena MVP: package catalog, task viewer, Monaco editor, working
  C# runner, anonymous cookie auth.
- **Phase 2** — Story mode: chapters, gating, story map.
- **Phase 3** — multi-language (TypeScript, then more).

## Conventions (auto-loaded from `.claude/rules/`)

- `backend-conventions.md` — vertical slice, `Result<T, Error>`, EF Core, migrations
- `frontend-fsd.md` — FSD layers (strict), React Compiler, hook naming
- `docker-ci.md` — Dockerfile, healthcheck, `NEXT_PUBLIC_*` are build-time
- `doc-maintenance.md` — when to update `docs/*`

## Hard rules

- **No upward imports** in `frontend/src/` — enforced by `eslint-plugin-boundaries`.
- **No cross-slice imports** in `frontend/src/features/` — communicate via `entities/` or `shared/`.
- **`Guid.CreateVersion7()`**, never `Guid.NewGuid()`, in production code. Banned via `BannedSymbols.txt`.
- **No `Console.Write*`** in production code — use `ILogger`. Banned.
- **`Result<T, Error>` for business outcomes**, not exceptions. Domain throws are bugs.
- **Never modify existing EF migrations.** Add a corrective migration.
- **API URLs always include trailing slash** (nginx returns 301 without).

## What NOT to add without explicit ask

(from the bootstrap brief)

- AI tutor / LLM integration
- WebSockets, SSE
- Judge0
- Redis, RabbitMQ, message queues
- Real-browser tests (jsdom is enough)
- Microservices (one backend)
- OIDC / external auth integration
- Kubernetes
- Real runner business logic (Phase 0 stub only)

## Skills useful in this repo

- `frontend-design` — page-level visual work (`/arena/tasks/[id]`, `VictoryOverlay`)
- `writing-plans` — detailed Phase plan before code
- `test-driven-development` — for `CSharpRunner` (Docker spawn + parse)
- `systematic-debugging` — Docker-runner failure modes are nontrivial
- `using-git-worktrees` — parallel phase work
- **NOT `brainstorming`** — design is fixed; do not re-debate.

## Docs index

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/VISUAL.md](docs/VISUAL.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)
- [docs/art-style.md](docs/art-style.md)
- [docs/ops.md](docs/ops.md)
