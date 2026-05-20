# Docker & CI conventions

## Dockerfiles

- **Multi-stage:** build (SDK / node:alpine) → runtime (aspnet / node:alpine).
  Keep the runtime layer minimal.
- **csproj-first restore layer** in the backend Dockerfile: copy `*.csproj`
  + `Directory.{Build,Packages}.props` + `BannedSymbols.txt` + `.globalconfig`
  before any source files, then `dotnet restore`. NuGet cache layer survives
  source changes; restore re-runs only when the project files change.
- **`--mount=type=cache`** for both NuGet (`/root/.nuget/packages`) and npm
  (`/root/.npm`). Cuts cold-cache builds dramatically.

## Healthchecks

- Backend: `curl -fsS http://localhost:5000/health || exit 1`. `curl` is
  installed in the runtime layer (~3 MB).
- Frontend: `wget -qO- http://localhost:3000/` — busybox `wget` ships with
  `node:22-alpine`.
- `start-period` is real — give .NET ~ 20 s and Next ~ 15 s before counting
  failures. A too-short start window fails CI on cold-start.

## NEXT_PUBLIC_* env vars are build-time

`NEXT_PUBLIC_*` is **baked into the build** by Next.js, not read at runtime.
They must be passed as `--build-arg` to `docker build`, not as runtime
env-vars. The frontend Dockerfile and `docker-compose.yml` already do this
via the `build.args` block.

## docker-compose

- `docker-compose.yml` is for **local dev** — has `build:` blocks pointing
  to the Dockerfiles and `pull_policy` defaults are fine.
- `docker-compose.prod.yml` has **no `build:` blocks** — all images come
  from a registry (`${DOCKER_REGISTRY}/...:${IMAGE_TAG}`) and use
  `pull_policy: always`. Production never builds on the box.
- The postgres `init.sql` is mounted read-only to
  `/docker-entrypoint-initdb.d/00-init.sql` so it runs exactly once on a
  fresh volume.

## CI (when it lands)

- Cache NuGet (`~/.nuget/packages`) and npm (`~/.npm`) between runs.
- Run `dotnet build backend/arena.slnx` with `TreatWarningsAsErrors=true`
  (already the default — don't override).
- Run `npm run lint` and `npm run build` in `frontend/`.
- Deploy via SSH + `docker compose pull && docker compose up -d` against
  the production compose file.
- `docker image prune -f` must run **after** the new image's healthcheck
  passes, otherwise a failed deploy will have already destroyed the
  rollback target.
