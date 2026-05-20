# Sharp Arena

Standalone gaming platform for programming challenges. C# first, more languages later.

Two modes:

- **Arena** — free practice. Catalog of task packages, leaderboards.
- **Story** — narrative progression. Chapters with gating, sequential unlock.

User writes code in a Monaco editor in the browser, hits **Run**, code executes
in an isolated Docker container, tests run, verdict comes back. Visual style:
pixel-RPG hybrid — dark UI with pixel-art accents.

## Tech stack

| Layer          | Technology                                                                             |
| -------------- | -------------------------------------------------------------------------------------- |
| Backend        | ASP.NET Core minimal API + .NET 10                                                     |
| ORM            | EF Core 10                                                                             |
| Database       | PostgreSQL 17 (schema `arena`)                                                         |
| Frontend       | Next.js 16 (App Router) + React 19 + TypeScript                                        |
| Styles         | Tailwind 4                                                                             |
| Code editor    | Monaco Editor (planned, Phase 0)                                                       |
| Code execution | Docker run per submission (`--rm --cpus=1 --memory=256m --network=none`) — Phase 0     |
| Auth (MVP)     | Anonymous cookie (UUID)                                                                |
| Deploy         | Docker Compose, single VPS                                                             |

## Quick start

Requires Docker, .NET SDK 10.0.x, Node 22+.

```bash
cp .env.example .env
./scripts/dev.sh up
```

Then:

- Backend health: <http://localhost:5000/health>
- Frontend landing: <http://localhost:3000/>

## Layout

```
sharp.arena/
├── backend/             # .NET 10 ArenaApi service (5 projects)
├── frontend/            # Next.js 16 (FSD layers)
├── runners/             # Per-language code-execution images (Phase 0)
├── docker/              # Postgres init scripts, runner Dockerfiles
├── docs/                # Architecture, visual, roadmap, ops
├── scripts/             # Dev orchestration (up, down, migrate, logs)
└── .claude/rules/       # Project conventions auto-loaded by Claude Code
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data model, abstractions, API contract
- [docs/VISUAL.md](docs/VISUAL.md) — palette, typography, pixel-art slots
- [docs/ROADMAP.md](docs/ROADMAP.md) — phases 0/1/2/3
- [docs/art-style.md](docs/art-style.md) — AI prompt template for pixel-art
- [docs/ops.md](docs/ops.md) — running locally

## Phase status

This commit is **Phase 0 bootstrap**: scaffolding only. No business logic, no
working code runner, no tasks in DB beyond the health endpoint. See
[ROADMAP.md](docs/ROADMAP.md).
