# Local operations

How to run Sharp Arena on your machine. Production deploy lives in
[ROADMAP.md](./ROADMAP.md) and is intentionally simple (one VPS, docker
compose).

## Prerequisites

- Docker 24+ (Desktop, OrbStack, or engine + compose v2).
- .NET SDK 10.0.x — `dotnet --list-sdks`.
- Node 22+ — `node --version`.
- (Optional) `dotnet-ef` global tool — Phase 1+ for migrations:
  `dotnet tool install --global dotnet-ef --version 10.0.*`.

## First-time setup

```bash
cp .env.example .env
cd frontend && npm install && cd ..
./scripts/dev.sh up
```

Wait until the postgres healthcheck flips to `healthy` (≈ 5–10 s). Then:

- Backend health: <http://localhost:5000/health> → `{"status":"ok"}`
- Frontend landing: <http://localhost:3000/>

## scripts/dev.sh

| Command                | What it does                                                |
| ---------------------- | ----------------------------------------------------------- |
| `./scripts/dev.sh up`  | `docker compose up -d --build` — postgres + backend + frontend |
| `./scripts/dev.sh up-infra` | postgres only — useful when running backend/frontend on the host |
| `./scripts/dev.sh down`  | Stop + remove containers; volume persists                  |
| `./scripts/dev.sh nuke`  | Stop + remove containers AND the postgres data volume      |
| `./scripts/dev.sh logs [svc]` | `docker compose logs -f` — optionally one service     |
| `./scripts/dev.sh migrate` | `dotnet ef database update` against the local backend     |
| `./scripts/dev.sh psql`  | Open a `psql` shell inside the postgres container          |

## Running backend or frontend on the host

If you prefer to iterate on the backend or frontend outside Docker:

```bash
# Start postgres only
./scripts/dev.sh up-infra

# Backend (separate terminal)
cd backend/ArenaApi/src/ArenaApi.Web
ASPNETCORE_ENVIRONMENT=Development dotnet run

# Frontend (separate terminal)
cd frontend
npm run dev
```

`appsettings.Development.json` uses `localhost:5432` for the DB so it works
with `up-infra` (port 5432 is exposed by the postgres service).

## Postgres details

- DB name (default): `sharp_arena`
- User / password (default): `arena` / `arena`
- Schema for the app: `arena`
- Volume: `arena_postgres_data` — survives `down`, destroyed by `nuke`.
- Init SQL: `docker/postgres/init.sql` runs once on a fresh data dir. Add
  schemas / extensions there if you need them platform-wide; one-off
  changes belong in EF migrations.

## Migrations (Phase 1+)

Phase 0 ships no migrations. Once domain entities land in Phase 1:

```bash
dotnet ef migrations add InitialCreate \
  --project backend/ArenaApi/src/ArenaApi.Infrastructure.Postgres \
  --startup-project backend/ArenaApi/src/ArenaApi.Web

./scripts/dev.sh migrate
```

Never modify a migration once it has been committed — add a new corrective
migration instead. See [`.claude/rules/`](../.claude/rules/) for the project
rule.

## Troubleshooting

- **`pg_isready` healthcheck never goes healthy** — usually port 5432 already
  bound on your host. Override `POSTGRES_PORT` in `.env`.
- **Backend can't connect to Postgres** — confirm the connection string
  inside `appsettings.Docker.json` uses host `postgres` (the compose service
  name), not `localhost`.
- **Frontend lint fails with `boundaries/dependencies`** — you're importing
  upward across FSD layers. Move the shared bit down to `entities/` or
  `shared/` and re-import.
- **`docker compose up` rebuilds everything on each run** — that's `up
  --build`. Use `docker compose up -d` after the first build to skip the
  build phase when nothing changed.
