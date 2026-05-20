# Sharp Arena — project memory

Standalone game-style platform for programming challenges. C# first, multi-language
ready by design via `IRunner` / `ITestFormat` / `IContentLoader` abstractions.

## What this codebase is

- **Two modes, one engine.** A single `tasks` table backs both **Arena**
  (free practice, packages) and **Story** (chapters with gating).
  Difference is navigation/UI, not data model.
- **Multi-language from day 1.** New language = new `runners/<lang>/Dockerfile`
  + `IRunner` implementation. Core engine unchanged.
- **Modular monolith.** One backend process, but code inside
  `ArenaApi.Core/Modules/<Content|Execution|Progress|IdentityStub>/` is
  isolated by NetArchTest rules. Cross-module communication: sync read via
  `I<Module>Reader`, side-effects via Wolverine + RabbitMQ + Postgres
  durable outbox. Each module owns its own `DbContext` + Postgres schema.
  Identity is a hardcoded stub; real SSO comes later.
- **RabbitMQ + Redis in infra.** Wolverine routes integration events
  through RabbitMQ even when the consumer is in-process, so extracting a
  module into its own service later is mechanical. Redis is registered
  (StackExchange + HybridCache) but not actively used in Phase 0 — it will
  back caching and sessions later.
- **Anti-scope MVP.** No AI tutor, no WebSockets, no Judge0, no Kubernetes,
  no integration with external auth yet. Single backend, single VPS.

## Layout

| Path                                            | Owns                                                            |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `backend/ArenaApi/src/ArenaApi.Web/`            | Host: `Program.cs`, Wolverine configuration, endpoint mapping   |
| `backend/ArenaApi/src/ArenaApi.Core/`           | Shared primitives + per-module code (`Modules/<Name>/`)         |
| `backend/ArenaApi/src/ArenaApi.Contracts/`      | HTTP DTOs (request/response records, no Domain dependency)      |
| `backend/ArenaApi/src/ArenaApi.Infrastructure/` | Reserved shell for cross-cutting infra (OTel, logging, jobs)    |
| `frontend/`                                     | Next.js 16 App Router, FSD layers, Tailwind 4                   |
| `runners/<lang>/`                               | One Dockerfile per supported language. Phase 0 = TODO           |
| `docker/postgres/`                              | DB init SQL (per-module schemas + extensions)                   |
| `docs/`                                         | Architecture, visual style, roadmap                             |
| `.claude/rules/`                                | Conventions auto-loaded by Claude Code                          |

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
- **Module boundaries are enforced via `NetArchTest`.** Cross-module
  references must go through `Modules/<Module>/Public/`. Direct references
  to `<Other>DbContext`, `<Other>.Domain`, `<Other>.Features`, or
  `<Other>.Infrastructure` will fail the architecture test suite.
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
- Real-browser tests (jsdom is enough)
- Microservices (one backend — modular monolith is the answer for now)
- OIDC / external auth integration (IdentityStub holds until SSO lands)
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
