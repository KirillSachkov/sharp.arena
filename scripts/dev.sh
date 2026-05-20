#!/usr/bin/env bash
# Sharp Arena — dev orchestration.
#
# Usage:
#   ./scripts/dev.sh up            Start postgres + backend + frontend
#   ./scripts/dev.sh up-infra      Start postgres only (run backend/frontend locally)
#   ./scripts/dev.sh down          Stop and remove containers (keeps the volume)
#   ./scripts/dev.sh nuke          Stop, remove containers AND the postgres volume
#   ./scripts/dev.sh logs [svc]    Tail logs for one or all services
#   ./scripts/dev.sh migrate       Apply EF Core migrations (Phase 1+)
#   ./scripts/dev.sh psql          Open a psql shell in the postgres container

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .env ]; then
    # shellcheck disable=SC2046
    export $(grep -v '^[[:space:]]*#' .env | grep -v '^[[:space:]]*$' | xargs -0 echo | tr ' ' '\n' | xargs)
fi

CMD=${1:-up}
shift || true

case "$CMD" in
up)
    docker compose up -d --build
    ;;
up-infra)
    docker compose up -d postgres
    ;;
down)
    docker compose down
    ;;
nuke)
    docker compose down -v
    ;;
logs)
    docker compose logs -f "${1:-}"
    ;;
migrate)
    dotnet ef database update \
        --project backend/ArenaApi/src/ArenaApi.Infrastructure.Postgres \
        --startup-project backend/ArenaApi/src/ArenaApi.Web
    ;;
psql)
    docker compose exec postgres \
        psql -U "${POSTGRES_USER:-arena}" -d "${POSTGRES_DB:-sharp_arena}"
    ;;
*)
    echo "Unknown command: $CMD" >&2
    echo "Usage: $0 {up|up-infra|down|nuke|logs [svc]|migrate|psql}" >&2
    exit 2
    ;;
esac
