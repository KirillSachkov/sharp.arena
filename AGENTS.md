# Sharp Arena — agent instructions

Mirror of `CLAUDE.md` in a tool-neutral format for non-Claude agents.

## TL;DR

- Standalone game-style platform for programming challenges.
- Single backend (`backend/ArenaApi/`), single frontend (`frontend/`).
- C# first, multi-language ready by design.
- Two modes — Arena (free practice) and Story (chapters with gating) — share
  one `tasks` table.
- This commit is **Phase 0 bootstrap**. No business logic yet.

## Stack

- Backend: ASP.NET Core minimal API, .NET 10, EF Core 10, PostgreSQL 17.
- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4.
- Editor: Monaco. Execution: Docker per-submission. Auth (MVP): anon UUID cookie.

## Layout

| Path                | Owns                                                                |
| ------------------- | ------------------------------------------------------------------- |
| `backend/ArenaApi/` | 5-project service (Web / Core / Domain / Contracts / Infra.Postgres) |
| `frontend/`         | Next.js 16, FSD layers, Tailwind                                    |
| `runners/<lang>/`   | Per-language exec container (Phase 0: stub)                         |
| `docker/postgres/`  | DB init SQL                                                         |
| `docs/`             | Architecture, visual, roadmap, ops                                  |

## Hard rules

- FSD layers: app → pages → widgets → features → entities → shared, **no upward
  imports**, no cross-slice imports inside `features/`. Enforced by ESLint.
- `Guid.CreateVersion7()` only — `Guid.NewGuid()` banned in production code.
- `Result<T, Error>` for business outcomes; do not throw for expected failures.
- Never edit existing EF migrations; add a corrective one.
- API URLs always include the trailing slash.

## Conventions

Detailed rules live under `.claude/rules/`:

- `backend-conventions.md`
- `frontend-fsd.md`
- `docker-ci.md`
- `doc-maintenance.md`

## Anti-scope

Do not add without an explicit request: AI tutor, WebSockets/SSE, Judge0,
Redis/RabbitMQ, microservices, OIDC, Kubernetes, real runner business logic.

## Docs

- `docs/ARCHITECTURE.md`
- `docs/VISUAL.md`
- `docs/ROADMAP.md`
- `docs/art-style.md`
- `docs/ops.md`
