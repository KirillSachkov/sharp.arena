# Sharp Arena — Modular Monolith Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the current 5-project layered backend into a modular monolith with 3 full modules (Content, Execution, Progress) + 1 stub (IdentityStub), where every cross-module side-effect goes through Wolverine + RabbitMQ + Postgres durable outbox so future extraction into microservices is mechanical.

**Architecture:** One process, one solution. `ArenaApi.Core` contains `Shared/` (cross-cutting primitives) and `Modules/<Module>/` (one folder per module with `Public/ Domain/ Features/ Infrastructure/`). Each module owns its own EF Core `DbContext` and Postgres schema (`arena_content`, `arena_execution`, `arena_progress`, `arena_identity`). Inter-module communication has exactly three legal paths: (1) sync read via `IXxxReader` in `Modules/X/Public/`, (2) intra-module domain events dispatched in the same transaction, (3) inter-module integration events via Wolverine outbox + RabbitMQ. Identity is a hardcoded `Guid` stub; real SSO comes later.

**Tech Stack:** .NET 10, EF Core 10 (Npgsql), CSharpFunctionalExtensions (`Result<T, Error>`), WolverineFx 4.x (`WolverineFx.RabbitMQ`, `WolverineFx.Postgresql`, `WolverineFx.EntityFrameworkCore`), Redis (StackExchange + HybridCache, not actively used yet), xUnit + Testcontainers (Postgres + RabbitMQ) + Respawn, NetArchTest for boundary enforcement.

---

## File Structure

After this plan completes, the backend layout is:

```
backend/
├── arena.slnx
├── Directory.Build.props                       # unchanged
├── Directory.Packages.props                    # + Wolverine, Redis, NetArchTest, Testcontainers.RabbitMq
├── BannedSymbols.txt                           # unchanged
├── .globalconfig                               # unchanged
└── ArenaApi/
    ├── Dockerfile                              # updated csproj copy list (deletes 2 projects, adds 1)
    ├── src/
    │   ├── ArenaApi.Web/
    │   │   ├── ArenaApi.Web.csproj             # refs Core, Contracts, Infrastructure (new)
    │   │   ├── Program.cs                      # registers modules + Wolverine + Redis
    │   │   ├── Configuration/
    │   │   │   ├── WolverineConfiguration.cs
    │   │   │   └── DatabaseConfiguration.cs
    │   │   ├── GlobalUsings.cs
    │   │   ├── appsettings.json                # + ConnectionStrings.RabbitMq, .Redis; IdentityStub block
    │   │   ├── appsettings.Development.json
    │   │   └── appsettings.Docker.json
    │   ├── ArenaApi.Core/
    │   │   ├── ArenaApi.Core.csproj            # + Wolverine, EFCore, Microsoft.Extensions.Caching.Hybrid
    │   │   ├── GlobalUsings.cs
    │   │   ├── ConnectionStringNames.cs        # + RabbitMq, Redis
    │   │   ├── Shared/
    │   │   │   ├── Errors/
    │   │   │   │   ├── Error.cs
    │   │   │   │   └── CommonErrors.cs
    │   │   │   ├── Time/
    │   │   │   │   ├── IClock.cs
    │   │   │   │   └── SystemClock.cs
    │   │   │   ├── Identifiers/
    │   │   │   │   └── TimeOrderedGuidValueGenerator.cs
    │   │   │   ├── DomainEvents/
    │   │   │   │   ├── IDomainEvent.cs
    │   │   │   │   └── IHasDomainEvents.cs
    │   │   │   └── Outbox/
    │   │   │       └── IOutboxService.cs       # generic per-DbContext interface
    │   │   ├── Modules/
    │   │   │   ├── Content/
    │   │   │   │   ├── ContentModule.cs        # AddContentModule, MapContentEndpoints
    │   │   │   │   ├── Public/
    │   │   │   │   │   ├── IContentReader.cs
    │   │   │   │   │   ├── PackageView.cs
    │   │   │   │   │   └── IntegrationEvents/
    │   │   │   │   │       └── PackageCreated.cs
    │   │   │   │   ├── Domain/
    │   │   │   │   │   ├── Package.cs
    │   │   │   │   │   └── DomainEvents/
    │   │   │   │   │       └── PackageCreatedDomainEvent.cs
    │   │   │   │   ├── Features/
    │   │   │   │   │   └── CreatePackage/
    │   │   │   │   │       ├── CreatePackageCommand.cs
    │   │   │   │   │       ├── CreatePackageHandler.cs
    │   │   │   │   │       └── CreatePackageEndpoint.cs
    │   │   │   │   └── Infrastructure/
    │   │   │   │       ├── ContentDbContext.cs
    │   │   │   │       ├── Configurations/
    │   │   │   │       │   └── PackageConfiguration.cs
    │   │   │   │       ├── ContentReader.cs
    │   │   │   │       ├── ContentOutboxService.cs
    │   │   │   │       └── Migrations/         # generated via dotnet ef
    │   │   │   ├── Execution/
    │   │   │   │   ├── ExecutionModule.cs
    │   │   │   │   ├── Public/                 # empty for now (only namespace placeholder)
    │   │   │   │   ├── Domain/                 # empty
    │   │   │   │   ├── Features/               # empty
    │   │   │   │   └── Infrastructure/
    │   │   │   │       ├── ExecutionDbContext.cs
    │   │   │   │       ├── ExecutionOutboxService.cs
    │   │   │   │       └── Migrations/
    │   │   │   ├── Progress/
    │   │   │   │   ├── ProgressModule.cs
    │   │   │   │   ├── Public/                 # empty
    │   │   │   │   ├── Domain/                 # empty
    │   │   │   │   ├── Features/               # empty
    │   │   │   │   ├── EventHandlers/
    │   │   │   │   │   └── PackageCreatedHandler.cs
    │   │   │   │   └── Infrastructure/
    │   │   │   │       ├── ProgressDbContext.cs
    │   │   │   │       ├── ProgressOutboxService.cs
    │   │   │   │       └── Migrations/
    │   │   │   └── IdentityStub/
    │   │   │       ├── IdentityStubModule.cs
    │   │   │       ├── IdentityStubOptions.cs
    │   │   │       ├── Public/
    │   │   │       │   └── ICurrentUser.cs
    │   │   │       └── Infrastructure/
    │   │   │           └── StubCurrentUser.cs
    │   │   └── Features/Health/                # existing — stays, not a module
    │   │       ├── HealthEndpoints.cs
    │   │       └── HealthResponse.cs
    │   ├── ArenaApi.Contracts/                 # unchanged shell — for HTTP DTOs
    │   │   └── ArenaApi.Contracts.csproj
    │   └── ArenaApi.Infrastructure/            # NEW — replaces ArenaApi.Infrastructure.Postgres
    │       └── ArenaApi.Infrastructure.csproj  # for future cross-cutting infra
    ├── tests/
    │   ├── ArenaApi.UnitTests/
    │   │   ├── ArenaApi.UnitTests.csproj       # + NetArchTest.Rules, ref to Core
    │   │   ├── SmokeTests.cs                   # existing
    │   │   └── Architecture/
    │   │       └── ModuleBoundariesTests.cs
    │   └── ArenaApi.IntegrationTests/
    │       ├── ArenaApi.IntegrationTests.csproj # + Testcontainers.RabbitMq
    │       ├── HealthEndpointTests.cs          # existing
    │       ├── Infrastructure/
    │       │   └── IntegrationTestsWebFactory.cs
    │       └── Modules/
    │           └── Content/
    │               └── CreatePackageEndpointTests.cs
└── (other files unchanged)

docker-compose.yml                              # + rabbitmq, redis services
docker/postgres/init.sql                        # + arena_content, arena_execution, arena_progress, arena_identity, arena_wolverine schemas
.env.example                                    # + RabbitMq + Redis env
```

**Deleted:** `ArenaApi.Domain/` project, `ArenaApi.Infrastructure.Postgres/` project. Their references in slnx and Dockerfile go away.

**Files NOT touched in this plan:** Anything under `frontend/`, `runners/`, `docs/art-style.md`, `docs/VISUAL.md`, `docs/ops.md`.

---

## Conventions used throughout the plan

- **Working directory** for all commands: `/Users/dev/code/sharp.arena` unless stated otherwise.
- **C# namespace root:** `ArenaApi.Core.Modules.<Module>.{Public|Domain|Features.<Feature>|Infrastructure}`. Shared lives in `ArenaApi.Core.Shared.<Section>`.
- **`Guid.CreateVersion7()`** in production code; `Guid.NewGuid()` only in test projects (already exempted via `Directory.Build.props`).
- **Migrations command** for module `<M>` (run from `backend/`):
  ```bash
  dotnet ef migrations add <Name> \
    --project ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj \
    --startup-project ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj \
    --context <M>DbContext \
    --output-dir Modules/<M>/Infrastructure/Migrations
  ```
- **Commit cadence:** one commit per task. Use the message template each task gives.
- **After every task:** run `dotnet build backend/arena.slnx` and confirm 0 warnings, 0 errors before committing. `TreatWarningsAsErrors=true` is on for non-test projects.

---

## Task 1: Add packages to `Directory.Packages.props`

**Files:**
- Modify: `backend/Directory.Packages.props`

- [ ] **Step 1: Add Wolverine, Redis, NetArchTest, Testcontainers.RabbitMq versions**

Open `backend/Directory.Packages.props`. Inside the existing `<ItemGroup>` (after the `Testcontainers.PostgreSql` line), add:

```xml
    <!-- Wolverine — durable outbox + RabbitMQ transport -->
    <PackageVersion Include="WolverineFx" Version="4.6.1" />
    <PackageVersion Include="WolverineFx.RabbitMQ" Version="4.6.1" />
    <PackageVersion Include="WolverineFx.Postgresql" Version="4.6.1" />
    <PackageVersion Include="WolverineFx.EntityFrameworkCore" Version="4.6.1" />

    <!-- Caching (infra-only, not actively used in Phase 0) -->
    <PackageVersion Include="Microsoft.Extensions.Caching.StackExchangeRedis" Version="10.0.7" />
    <PackageVersion Include="Microsoft.Extensions.Caching.Hybrid" Version="10.0.0" />

    <!-- Architecture tests -->
    <PackageVersion Include="NetArchTest.Rules" Version="1.3.2" />

    <!-- Testcontainers — RabbitMQ for integration tests -->
    <PackageVersion Include="Testcontainers.RabbitMq" Version="4.10.0" />
```

> **Note on Wolverine version:** Pin to whatever the latest 4.x stable is at execution time — verify with `dotnet add package WolverineFx --dry-run` or check nuget.org. The four `WolverineFx.*` packages must share the same version. If 4.6.1 is no longer current, bump uniformly.

- [ ] **Step 2: Verify build still works**

```bash
dotnet restore backend/arena.slnx
```

Expected: succeeds. No source files reference these packages yet, so nothing else changes.

- [ ] **Step 3: Commit**

```bash
git add backend/Directory.Packages.props
git commit -m "build: add Wolverine, Redis, NetArchTest packages to central versions"
```

---

## Task 2: Replace `ArenaApi.Domain` + `ArenaApi.Infrastructure.Postgres` with `ArenaApi.Infrastructure`

The current `ArenaApi.Domain` project has zero source files. `ArenaApi.Infrastructure.Postgres` has only `ArenaDbContext` (empty) and `Registration.cs` (DbContext registration). Both are obsolete in the modular model — domain types now live per-module, and EF Core registration moves into `WolverineConfiguration`. We replace both with a single empty `ArenaApi.Infrastructure` shell project to host future cross-cutting infra (logging, OTel, etc.).

**Files:**
- Delete: `backend/ArenaApi/src/ArenaApi.Domain/` (whole directory)
- Delete: `backend/ArenaApi/src/ArenaApi.Infrastructure.Postgres/` (whole directory)
- Create: `backend/ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj`

- [ ] **Step 1: Delete obsolete projects**

```bash
rm -rf backend/ArenaApi/src/ArenaApi.Domain
rm -rf backend/ArenaApi/src/ArenaApi.Infrastructure.Postgres
```

- [ ] **Step 2: Create new Infrastructure project**

```bash
mkdir -p backend/ArenaApi/src/ArenaApi.Infrastructure
```

Write `backend/ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.Infrastructure</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\ArenaApi.Core\ArenaApi.Core.csproj" />
  </ItemGroup>
</Project>
```

Note: empty for now — no source files. Exists so we have a place for cross-cutting infra later (logging, OTel, background jobs). The csproj must have at least one `*.cs` for `dotnet build` to be happy on some setups; create a placeholder:

Write `backend/ArenaApi/src/ArenaApi.Infrastructure/AssemblyMarker.cs`:

```csharp
namespace ArenaApi.Infrastructure;

internal static class AssemblyMarker;
```

- [ ] **Step 3: Update `arena.slnx`**

Replace the contents of `backend/arena.slnx` with:

```xml
<Solution>
  <Folder Name="/ArenaApi/">
    <Project Path="ArenaApi/src/ArenaApi.Contracts/ArenaApi.Contracts.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj" />
  </Folder>
  <Folder Name="/ArenaApi/tests/">
    <Project Path="ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj" />
    <Project Path="ArenaApi/tests/ArenaApi.IntegrationTests/ArenaApi.IntegrationTests.csproj" />
  </Folder>
</Solution>
```

- [ ] **Step 4: Update `ArenaApi.Core.csproj`**

Replace `backend/ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj` with:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />

    <PackageReference Include="CSharpFunctionalExtensions" />
    <PackageReference Include="FluentValidation" />
    <PackageReference Include="FluentValidation.DependencyInjectionExtensions" />

    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="Npgsql" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" />

    <PackageReference Include="WolverineFx" />
    <PackageReference Include="WolverineFx.EntityFrameworkCore" />

    <PackageReference Include="Microsoft.Extensions.Caching.Hybrid" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\ArenaApi.Contracts\ArenaApi.Contracts.csproj" />
  </ItemGroup>
</Project>
```

Rationale: Core now owns EF Core (each module's DbContext lives here), Wolverine (handlers + outbox), HybridCache (modules can opt-in). Domain ref is gone (project deleted). Postgres-specific bits stay here because each module's DbContext registers `UseNpgsql` directly — splitting that into Infrastructure was premature.

- [ ] **Step 5: Update `ArenaApi.Web.csproj`**

Replace `backend/ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj` with:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" />
    <PackageReference Include="Microsoft.Extensions.Diagnostics.HealthChecks" />
    <PackageReference Include="Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>

    <PackageReference Include="WolverineFx" />
    <PackageReference Include="WolverineFx.RabbitMQ" />
    <PackageReference Include="WolverineFx.Postgresql" />
    <PackageReference Include="WolverineFx.EntityFrameworkCore" />

    <PackageReference Include="Microsoft.Extensions.Caching.StackExchangeRedis" />
    <PackageReference Include="Microsoft.Extensions.Caching.Hybrid" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\ArenaApi.Core\ArenaApi.Core.csproj" />
    <ProjectReference Include="..\ArenaApi.Infrastructure\ArenaApi.Infrastructure.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 6: Update `ArenaApi.UnitTests.csproj`**

Replace `backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj` with:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" />
    <PackageReference Include="NetArchTest.Rules" />
    <PackageReference Include="coverlet.collector" />
    <PackageReference Include="xunit" />
    <PackageReference Include="xunit.runner.visualstudio">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\src\ArenaApi.Core\ArenaApi.Core.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 7: Update `ArenaApi.IntegrationTests.csproj`**

Replace `backend/ArenaApi/tests/ArenaApi.IntegrationTests/ArenaApi.IntegrationTests.csproj` with:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" />
    <PackageReference Include="Respawn" />
    <PackageReference Include="Testcontainers.PostgreSql" />
    <PackageReference Include="Testcontainers.RabbitMq" />
    <PackageReference Include="coverlet.collector" />
    <PackageReference Include="xunit" />
    <PackageReference Include="xunit.runner.visualstudio">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\src\ArenaApi.Web\ArenaApi.Web.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 8: Update Dockerfile csproj copy list**

In `backend/ArenaApi/Dockerfile`, replace the project-copy block (the section between `COPY [".globalconfig", "."]` and `RUN --mount=type=cache,id=nuget-global,...dotnet restore...`) with:

```dockerfile
COPY ["ArenaApi/src/ArenaApi.Contracts/ArenaApi.Contracts.csproj", "ArenaApi/src/ArenaApi.Contracts/"]
COPY ["ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj", "ArenaApi/src/ArenaApi.Core/"]
COPY ["ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj", "ArenaApi/src/ArenaApi.Infrastructure/"]
COPY ["ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj", "ArenaApi/src/ArenaApi.Web/"]
```

Leave the rest of the Dockerfile alone.

- [ ] **Step 9: Stub out `Program.cs` so it builds**

The current `Program.cs` imports `ArenaApi.Infrastructure.Postgres` which we just deleted. Replace `backend/ArenaApi/src/ArenaApi.Web/Program.cs` with this temporary form (we'll add real wiring in Task 16):

```csharp
using ArenaApi.Core.Features.Health;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthEndpoints();

await app.RunAsync();

namespace ArenaApi.Web
{
    public sealed class Program;
}
```

Also delete the stale `Registration.cs` in Core (it referenced FluentValidation but that's fine; we just don't want a dead `AddCore` extension lying around — we'll replace it with module registration calls in Program.cs). Remove the file:

```bash
rm backend/ArenaApi/src/ArenaApi.Core/Registration.cs
```

- [ ] **Step 10: Build and verify**

```bash
dotnet build backend/arena.slnx
```

Expected: 0 errors, 0 warnings. The integration test `HealthEndpointTests` is `[Fact(Skip = ...)]` so it stays.

```bash
dotnet test backend/arena.slnx
```

Expected: smoke tests pass (only the `SmokeTests.Smoke` and the skipped health test).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: drop ArenaApi.Domain + Infrastructure.Postgres, add empty Infrastructure shell"
```

---

## Task 3: Docker compose — add RabbitMQ + Redis, expand `init.sql`

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `docker/postgres/init.sql`
- Modify: `.env.example`

- [ ] **Step 1: Add RabbitMQ + Redis to `docker-compose.yml`**

Open `docker-compose.yml`. After the `postgres:` service block (and before `backend:`), insert:

```yaml
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: arena-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-arena}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-arena}
    ports:
      - "${RABBITMQ_PORT:-5672}:5672"
      - "${RABBITMQ_MGMT_PORT:-15672}:15672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  redis:
    image: redis:7-alpine
    container_name: arena-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 5s
```

Then update the `backend:` service:
- Add `rabbitmq` and `redis` to its `depends_on` block with `condition: service_healthy` (matching the existing postgres entry).
- Add new env vars to its `environment` block:
  ```yaml
      ConnectionStrings__RabbitMq: "amqp://${RABBITMQ_USER:-arena}:${RABBITMQ_PASSWORD:-arena}@rabbitmq:5672/"
      ConnectionStrings__Redis: "redis:6379"
  ```

Final `backend.depends_on`:
```yaml
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      redis:
        condition: service_healthy
```

- [ ] **Step 2: Mirror the changes in `docker-compose.prod.yml`**

Insert the same `rabbitmq` and `redis` service blocks (without exposed ports if you prefer — they're internal in prod; but expose for now since this is still pre-launch). Update `backend.depends_on` and `backend.environment` identically. Skip the management UI port (15672) in prod since it's not needed in prod healthy operation. For simplicity now, keep parity with dev.

- [ ] **Step 3: Expand `docker/postgres/init.sql`**

Replace the contents of `docker/postgres/init.sql` with:

```sql
-- Runs once when the Postgres container creates a fresh data directory.
-- Idempotent: safe to apply against an existing DB too.

-- ltree backs hierarchical paths (e.g. chapter→task ordering, story-map
-- prerequisites) without bespoke recursive CTEs.
CREATE EXTENSION IF NOT EXISTS ltree;

-- Per-module schemas. Each module owns exactly one schema and never reads
-- across schema boundaries. Cross-module reads go through IXxxReader contracts.
CREATE SCHEMA IF NOT EXISTS arena_content;
CREATE SCHEMA IF NOT EXISTS arena_execution;
CREATE SCHEMA IF NOT EXISTS arena_progress;
CREATE SCHEMA IF NOT EXISTS arena_identity;

-- Wolverine durable inbox/outbox + envelope tables. Wolverine auto-provisions
-- these on startup; the schema itself must pre-exist.
CREATE SCHEMA IF NOT EXISTS arena_wolverine;
```

The previous `CREATE SCHEMA IF NOT EXISTS arena;` is gone — no module uses the plain `arena` schema any more. The Web connection string still says `Search Path=arena,public` but we'll fix that next.

- [ ] **Step 4: Update connection strings to drop `arena` search path**

In `backend/ArenaApi/src/ArenaApi.Web/appsettings.json`, replace the `ConnectionStrings` block:

```json
  "ConnectionStrings": {
    "Database": "Host=localhost;Port=5432;Database=sharp_arena;Username=arena;Password=arena",
    "RabbitMq": "amqp://arena:arena@localhost:5672/",
    "Redis": "localhost:6379"
  }
```

Each module's DbContext sets its own schema explicitly via `modelBuilder.HasDefaultSchema(...)`, so a global Search Path is no longer needed.

In `backend/ArenaApi/src/ArenaApi.Web/appsettings.Docker.json`:

```json
{
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "Database": "Host=postgres;Port=5432;Database=sharp_arena;Username=arena;Password=arena",
    "RabbitMq": "amqp://arena:arena@rabbitmq:5672/",
    "Redis": "redis:6379"
  }
}
```

In `docker-compose.yml`, drop `Search Path=arena,public` from the `ConnectionStrings__Database` env var:

```yaml
      ConnectionStrings__Database: "Host=postgres;Port=5432;Database=${POSTGRES_DB:-sharp_arena};Username=${POSTGRES_USER:-arena};Password=${POSTGRES_PASSWORD:-arena}"
```

Mirror in `docker-compose.prod.yml`.

- [ ] **Step 5: Update `.env.example`**

Append after the existing Postgres block (before the `# --- Backend` block, or after — placement-only):

```
# --- RabbitMQ ----------------------------------------------------------------
RABBITMQ_USER=arena
RABBITMQ_PASSWORD=arena
RABBITMQ_PORT=5672
RABBITMQ_MGMT_PORT=15672

# --- Redis -------------------------------------------------------------------
REDIS_PORT=6379
```

- [ ] **Step 6: Verify compose config is syntactically valid**

```bash
docker compose config > /dev/null
```

Expected: exits 0 with no errors. (Doesn't actually start anything.)

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml docker-compose.prod.yml docker/postgres/init.sql .env.example backend/ArenaApi/src/ArenaApi.Web/appsettings.json backend/ArenaApi/src/ArenaApi.Web/appsettings.Docker.json
git commit -m "infra: add RabbitMQ + Redis services and per-module Postgres schemas"
```

---

## Task 4: `Core/Shared/` — Result helpers, Errors, IClock, GuidV7 generator

Note: `Result<T, Error>` already comes from `CSharpFunctionalExtensions`. We don't re-implement it — we define our own `Error` type and a few common errors. `Result.cs` mentioned in the spec is **not needed**; the package provides it.

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Shared/Errors/Error.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Shared/Errors/CommonErrors.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Shared/Time/IClock.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Shared/Time/SystemClock.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Shared/Identifiers/TimeOrderedGuidValueGenerator.cs`
- Modify: `backend/ArenaApi/src/ArenaApi.Core/ConnectionStringNames.cs`

- [ ] **Step 1: Create `Error.cs`**

Write `backend/ArenaApi/src/ArenaApi.Core/Shared/Errors/Error.cs`:

```csharp
namespace ArenaApi.Core.Shared.Errors;

public sealed record Error(string Code, string Message)
{
    public static Error NotFound(string resource, object identifier)
        => new($"{resource}.NotFound", $"{resource} with identifier '{identifier}' was not found.");

    public static Error Conflict(string resource, string message)
        => new($"{resource}.Conflict", message);

    public static Error Validation(string field, string message)
        => new($"Validation.{field}", message);
}
```

- [ ] **Step 2: Create `CommonErrors.cs`**

Write `backend/ArenaApi/src/ArenaApi.Core/Shared/Errors/CommonErrors.cs`:

```csharp
namespace ArenaApi.Core.Shared.Errors;

public static class CommonErrors
{
    public static readonly Error Unexpected = new("Unexpected", "An unexpected error occurred.");
}
```

- [ ] **Step 3: Create `IClock` + `SystemClock`**

Write `backend/ArenaApi/src/ArenaApi.Core/Shared/Time/IClock.cs`:

```csharp
namespace ArenaApi.Core.Shared.Time;

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
```

Write `backend/ArenaApi/src/ArenaApi.Core/Shared/Time/SystemClock.cs`:

```csharp
namespace ArenaApi.Core.Shared.Time;

internal sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
```

- [ ] **Step 4: Create `TimeOrderedGuidValueGenerator`**

This is the EF Core value generator that emits `Guid.CreateVersion7()` for entities added through navigation collections (where `Guid.Empty` triggers value generation). Aggregate roots will set their PK in the constructor directly — but for child collections this generator is the clean path.

Write `backend/ArenaApi/src/ArenaApi.Core/Shared/Identifiers/TimeOrderedGuidValueGenerator.cs`:

```csharp
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.ValueGeneration;

namespace ArenaApi.Core.Shared.Identifiers;

public sealed class TimeOrderedGuidValueGenerator : ValueGenerator<Guid>
{
    public override bool GeneratesTemporaryValues => false;

    public override Guid Next(EntityEntry entry) => Guid.CreateVersion7();
}
```

- [ ] **Step 5: Add RabbitMq + Redis to `ConnectionStringNames`**

Replace `backend/ArenaApi/src/ArenaApi.Core/ConnectionStringNames.cs`:

```csharp
namespace ArenaApi.Core;

public static class ConnectionStringNames
{
    public const string Database = "Database";
    public const string RabbitMq = "RabbitMq";
    public const string Redis = "Redis";
}
```

- [ ] **Step 6: Build + commit**

```bash
dotnet build backend/arena.slnx
```

Expected: 0 warnings, 0 errors.

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Shared/ backend/ArenaApi/src/ArenaApi.Core/ConnectionStringNames.cs
git commit -m "core: add Shared/Errors, Time, Identifiers primitives"
```

---

## Task 5: `Core/Shared/DomainEvents/` + `Core/Shared/Outbox/`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Shared/DomainEvents/IDomainEvent.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Shared/DomainEvents/IHasDomainEvents.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Shared/Outbox/IOutboxService.cs`

- [ ] **Step 1: `IDomainEvent`**

Write `backend/ArenaApi/src/ArenaApi.Core/Shared/DomainEvents/IDomainEvent.cs`:

```csharp
namespace ArenaApi.Core.Shared.DomainEvents;

/// Marker for events raised inside an aggregate and dispatched within the
/// same DB transaction. Domain events never cross module boundaries — use
/// Wolverine integration events for that.
public interface IDomainEvent;
```

- [ ] **Step 2: `IHasDomainEvents`**

Write `backend/ArenaApi/src/ArenaApi.Core/Shared/DomainEvents/IHasDomainEvents.cs`:

```csharp
namespace ArenaApi.Core.Shared.DomainEvents;

public interface IHasDomainEvents
{
    IReadOnlyList<IDomainEvent> DomainEvents { get; }
    void ClearDomainEvents();
}
```

We don't add an `IDomainEventDispatcher` in this plan — Phase 0 has only one aggregate (`Package`) and zero handlers to wire up. The interfaces above exist so aggregates can already declare events; the dispatcher will be added when the first intra-module domain event handler appears (Phase 1+). Keeping it out of Phase 0 avoids YAGNI.

- [ ] **Step 3: `IOutboxService`**

Write `backend/ArenaApi/src/ArenaApi.Core/Shared/Outbox/IOutboxService.cs`:

```csharp
namespace ArenaApi.Core.Shared.Outbox;

/// Per-module facade over Wolverine's IDbContextOutbox<TDbContext>. Modules
/// inject this rather than depending on Wolverine types directly, so that
/// the module's DbContext type stays an internal detail.
///
/// Implementations live in each module's Infrastructure/ folder and resolve
/// the correct IDbContextOutbox<TDbContext> via DI.
public interface IOutboxService
{
    Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class;
}
```

- [ ] **Step 4: Build + commit**

```bash
dotnet build backend/arena.slnx
git add backend/ArenaApi/src/ArenaApi.Core/Shared/DomainEvents backend/ArenaApi/src/ArenaApi.Core/Shared/Outbox
git commit -m "core: add DomainEvents marker interfaces and IOutboxService facade"
```

---

## Task 6: IdentityStub module — full implementation

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Public/ICurrentUser.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Infrastructure/StubCurrentUser.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/IdentityStubOptions.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/IdentityStubModule.cs`

- [ ] **Step 1: `ICurrentUser`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Public/ICurrentUser.cs`:

```csharp
namespace ArenaApi.Core.Modules.IdentityStub.Public;

/// The only contract other modules see from IdentityStub. When real SSO
/// arrives, the implementation behind this interface swaps; consumers don't
/// change. Do not add anything else here unless every consumer truly needs it.
public interface ICurrentUser
{
    Guid UserId { get; }
}
```

- [ ] **Step 2: `IdentityStubOptions`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/IdentityStubOptions.cs`:

```csharp
namespace ArenaApi.Core.Modules.IdentityStub;

public sealed class IdentityStubOptions
{
    public const string SectionName = "IdentityStub";

    public Guid HardcodedUserId { get; init; }
}
```

- [ ] **Step 3: `StubCurrentUser`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Infrastructure/StubCurrentUser.cs`:

```csharp
using ArenaApi.Core.Modules.IdentityStub.Public;
using Microsoft.Extensions.Options;

namespace ArenaApi.Core.Modules.IdentityStub.Infrastructure;

internal sealed class StubCurrentUser(IOptions<IdentityStubOptions> options) : ICurrentUser
{
    public Guid UserId { get; } = options.Value.HardcodedUserId == Guid.Empty
        ? throw new InvalidOperationException(
            $"{nameof(IdentityStubOptions)}.{nameof(IdentityStubOptions.HardcodedUserId)} is not configured. " +
            "Set IdentityStub:HardcodedUserId in appsettings.")
        : options.Value.HardcodedUserId;
}
```

- [ ] **Step 4: `IdentityStubModule`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/IdentityStubModule.cs`:

```csharp
using ArenaApi.Core.Modules.IdentityStub.Infrastructure;
using ArenaApi.Core.Modules.IdentityStub.Public;

namespace ArenaApi.Core.Modules.IdentityStub;

public static class IdentityStubModule
{
    public static IServiceCollection AddIdentityStubModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services
            .AddOptions<IdentityStubOptions>()
            .Bind(configuration.GetSection(IdentityStubOptions.SectionName))
            .ValidateOnStart();

        services.AddSingleton<ICurrentUser, StubCurrentUser>();
        return services;
    }
}
```

Lifetime is `Singleton` because the stub's value is constant for the process lifetime. When real auth replaces this, the lifetime flips to `Scoped` (per-request claims) — that's the only knob that changes at swap time.

- [ ] **Step 5: Add `IdentityStub` block to appsettings**

In `backend/ArenaApi/src/ArenaApi.Web/appsettings.Development.json`, add (alongside existing keys):

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft.AspNetCore": "Information"
    }
  },
  "IdentityStub": {
    "HardcodedUserId": "01970000-0000-7000-8000-000000000001"
  }
}
```

In `backend/ArenaApi/src/ArenaApi.Web/appsettings.Docker.json`, add the `IdentityStub` block too (same value).

In `backend/ArenaApi/src/ArenaApi.Web/appsettings.json` (base), do **not** add it — Development/Docker override it. This enforces "missing config = explosion at startup" semantics.

- [ ] **Step 6: Build + commit**

```bash
dotnet build backend/arena.slnx
git add backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub backend/ArenaApi/src/ArenaApi.Web/appsettings.Development.json backend/ArenaApi/src/ArenaApi.Web/appsettings.Docker.json
git commit -m "feat(identity-stub): add hardcoded ICurrentUser stub module"
```

---

## Task 7: Content/Domain — `Package` aggregate + domain event

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Package.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/DomainEvents/PackageCreatedDomainEvent.cs`

- [ ] **Step 1: `PackageCreatedDomainEvent`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/DomainEvents/PackageCreatedDomainEvent.cs`:

```csharp
using ArenaApi.Core.Shared.DomainEvents;

namespace ArenaApi.Core.Modules.Content.Domain.DomainEvents;

internal sealed record PackageCreatedDomainEvent(Guid PackageId, string Slug) : IDomainEvent;
```

Internal because domain events never leave the module.

- [ ] **Step 2: `Package` aggregate**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Package.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain.DomainEvents;
using ArenaApi.Core.Shared.DomainEvents;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Core.Modules.Content.Domain;

internal sealed class Package : IHasDomainEvents
{
    private readonly List<IDomainEvent> _domainEvents = [];

    public Guid Id { get; private init; }
    public string Slug { get; private init; } = null!;
    public string Title { get; private init; } = null!;
    public DateTimeOffset CreatedAt { get; private init; }

    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents;

    public void ClearDomainEvents() => _domainEvents.Clear();

    private Package() { }   // EF Core

    public static Result<Package, Error> Create(string slug, string title, DateTimeOffset createdAt)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            return Error.Validation(nameof(slug), "Slug must not be empty.");
        }

        if (string.IsNullOrWhiteSpace(title))
        {
            return Error.Validation(nameof(title), "Title must not be empty.");
        }

        Package package = new()
        {
            Id = Guid.CreateVersion7(),
            Slug = slug.Trim(),
            Title = title.Trim(),
            CreatedAt = createdAt,
        };

        package._domainEvents.Add(new PackageCreatedDomainEvent(package.Id, package.Slug));
        return package;
    }
}
```

`Package` is `internal` — only the Content module sees it. Other modules see `PackageView` from `Public/` instead.

- [ ] **Step 3: Build + commit**

```bash
dotnet build backend/arena.slnx
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain
git commit -m "feat(content): Package aggregate with factory and domain event"
```

---

## Task 8: Content/Public — `IContentReader`, `PackageView`, integration event

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/PackageView.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IContentReader.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IntegrationEvents/PackageCreated.cs`

- [ ] **Step 1: `PackageView`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/PackageView.cs`:

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

/// Immutable cross-module projection of a Package. Anything other modules
/// need to know about a package goes here; the internal Domain.Package may
/// hold more fields, but those never leak across the boundary.
public sealed record PackageView(Guid Id, string Slug, string Title, DateTimeOffset CreatedAt);
```

- [ ] **Step 2: `IContentReader`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IContentReader.cs`:

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

/// Sync read contract for other modules. Implementation lives in
/// Content/Infrastructure/ContentReader.cs and queries ContentDbContext.
public interface IContentReader
{
    Task<PackageView?> GetPackageAsync(Guid packageId, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 3: `PackageCreated` integration event**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IntegrationEvents/PackageCreated.cs`:

```csharp
namespace ArenaApi.Core.Modules.Content.Public.IntegrationEvents;

/// Published via Wolverine + RabbitMQ when a Package row is committed.
/// Other modules subscribe by writing an `IWolverineHandler` method that
/// accepts this type.
public sealed record PackageCreated(Guid PackageId, string Slug, string Title, DateTimeOffset CreatedAt);
```

- [ ] **Step 4: Build + commit**

```bash
dotnet build backend/arena.slnx
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public
git commit -m "feat(content): public contract — IContentReader, PackageView, PackageCreated event"
```

---

## Task 9: Content/Infrastructure — `ContentDbContext`, configuration, reader, outbox

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContext.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/PackageConfiguration.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentReader.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentOutboxService.cs`

- [ ] **Step 1: `ContentDbContext`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContext.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Infrastructure;

public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_content";

    internal DbSet<Package> Packages => Set<Package>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ContentDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Core.Modules.Content.Infrastructure.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
```

The `ApplyConfigurationsFromAssembly` predicate scopes config discovery to Content's configurations folder. Otherwise EF would attempt to apply Execution/Progress configs to this context too (when configs share the assembly).

- [ ] **Step 2: `PackageConfiguration`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/PackageConfiguration.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Core.Modules.Content.Infrastructure.Configurations;

internal sealed class PackageConfiguration : IEntityTypeConfiguration<Package>
{
    public void Configure(EntityTypeBuilder<Package> b)
    {
        b.ToTable("packages");

        b.HasKey(p => p.Id);
        b.Property(p => p.Id).HasColumnName("id");

        b.Property(p => p.Slug).HasColumnName("slug").HasMaxLength(120).IsRequired();
        b.HasIndex(p => p.Slug).IsUnique();

        b.Property(p => p.Title).HasColumnName("title").HasMaxLength(200).IsRequired();
        b.Property(p => p.CreatedAt).HasColumnName("created_at").IsRequired();

        // Domain events are not persisted.
        b.Ignore(p => p.DomainEvents);
    }
}
```

- [ ] **Step 3: `ContentReader`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentReader.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Public;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Infrastructure;

internal sealed class ContentReader(ContentDbContext db) : IContentReader
{
    public async Task<PackageView?> GetPackageAsync(Guid packageId, CancellationToken cancellationToken = default)
    {
        return await db.Packages
            .AsNoTracking()
            .Where(p => p.Id == packageId)
            .Select(p => new PackageView(p.Id, p.Slug, p.Title, p.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
```

- [ ] **Step 4: `ContentOutboxService`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentOutboxService.cs`:

```csharp
using ArenaApi.Core.Shared.Outbox;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Infrastructure;

internal sealed class ContentOutboxService(IDbContextOutbox<ContentDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
```

> **Verification at execution time:** confirm the actual Wolverine.EntityFrameworkCore namespace and type. As of WolverineFx 4.x: `Wolverine.EntityFrameworkCore.IDbContextOutbox<TDbContext>`. If the API differs, adjust the using and constructor — but the wrapper shape (one method that takes a message) stays the same.

- [ ] **Step 5: Build (don't add migration yet — that's Task 10)**

```bash
dotnet build backend/arena.slnx
```

Expected: 0 warnings, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure
git commit -m "feat(content): ContentDbContext, package configuration, reader, outbox service"
```

---

## Task 10: Generate Content initial migration

**Files:**
- Create (via `dotnet ef`): `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/<timestamp>_ContentInitial.cs`

> **Pre-req:** `Program.cs` must register `ContentDbContext` with `AddDbContext<>()` so `dotnet ef` design-time can discover it. Since we don't have full Program.cs wiring yet (that's Task 16), this task adds a *minimal* design-time DbContext factory, then runs the migration generator, then removes the factory in favor of full DI in Task 16. Cleaner approach: skip Task 16's order dependency by generating the migration after wiring. **Better: jump to Task 16 first if you find yourself stuck. As written, this plan provides a design-time factory to unblock now.**

- [ ] **Step 1: Add a design-time factory for `ContentDbContext`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContextDesignTimeFactory.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ArenaApi.Core.Modules.Content.Infrastructure;

internal sealed class ContentDbContextDesignTimeFactory : IDesignTimeDbContextFactory<ContentDbContext>
{
    public ContentDbContext CreateDbContext(string[] args)
    {
        DbContextOptionsBuilder<ContentDbContext> options = new();
        options.UseNpgsql(
            "Host=localhost;Database=sharp_arena;Username=arena;Password=arena",
            npgsql => npgsql.MigrationsHistoryTable(
                "__EFMigrationsHistory",
                ContentDbContext.SchemaName));
        return new ContentDbContext(options.Options);
    }
}
```

This factory only runs under `dotnet ef`. It's not part of the runtime DI graph.

- [ ] **Step 2: Generate the migration**

```bash
cd backend
dotnet ef migrations add ContentInitial \
  --project ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj \
  --startup-project ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj \
  --context ContentDbContext \
  --output-dir Modules/Content/Infrastructure/Migrations
cd ..
```

Expected: a file like `Modules/Content/Infrastructure/Migrations/20260520xxxxxx_ContentInitial.cs` is created plus a snapshot.

- [ ] **Step 3: Inspect the migration**

Open the generated `<timestamp>_ContentInitial.cs`. It should contain `migrationBuilder.EnsureSchema(name: "arena_content")` and `CreateTable("packages", schema: "arena_content", ...)`. If the table includes a `domain_events` column (i.e., `b.Ignore(...)` didn't take effect), back up, fix the configuration, and re-run.

- [ ] **Step 4: Build + commit**

```bash
dotnet build backend/arena.slnx
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContextDesignTimeFactory.cs
git commit -m "feat(content): ContentInitial migration — packages table in arena_content"
```

---

## Task 11: Content/Features/CreatePackage — Command, Handler, Endpoint

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageCommand.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/CreatePackageRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/CreatePackageResponse.cs`

- [ ] **Step 1: Contracts (HTTP DTOs)**

Write `backend/ArenaApi/src/ArenaApi.Contracts/Content/CreatePackageRequest.cs`:

```csharp
namespace ArenaApi.Contracts.Content;

public sealed record CreatePackageRequest(string Slug, string Title);
```

Write `backend/ArenaApi/src/ArenaApi.Contracts/Content/CreatePackageResponse.cs`:

```csharp
namespace ArenaApi.Contracts.Content;

public sealed record CreatePackageResponse(Guid Id, string Slug, string Title, DateTimeOffset CreatedAt);
```

- [ ] **Step 2: `CreatePackageCommand`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageCommand.cs`:

```csharp
namespace ArenaApi.Core.Modules.Content.Features.CreatePackage;

internal sealed record CreatePackageCommand(string Slug, string Title);
```

- [ ] **Step 3: `CreatePackageHandler`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageHandler.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Modules.Content.Public.IntegrationEvents;
using ArenaApi.Core.Shared.Errors;
using ArenaApi.Core.Shared.Outbox;
using ArenaApi.Core.Shared.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.CreatePackage;

internal sealed class CreatePackageHandler(
    ContentDbContext db,
    IOutboxService outbox,
    IClock clock)
{
    public async Task<Result<PackageView, Error>> HandleAsync(
        CreatePackageCommand command,
        CancellationToken cancellationToken)
    {
        bool slugTaken = await db.Packages
            .AsNoTracking()
            .AnyAsync(p => p.Slug == command.Slug, cancellationToken)
            .ConfigureAwait(false);

        if (slugTaken)
        {
            return Error.Conflict("Package", $"Slug '{command.Slug}' is already in use.");
        }

        Result<Package, Error> packageResult = Package.Create(command.Slug, command.Title, clock.UtcNow);
        if (packageResult.IsFailure)
        {
            return packageResult.Error;
        }

        Package package = packageResult.Value;

        await db.Packages.AddAsync(package, cancellationToken).ConfigureAwait(false);

        await outbox.PublishAsync(
            new PackageCreated(package.Id, package.Slug, package.Title, package.CreatedAt),
            cancellationToken)
            .ConfigureAwait(false);

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        return new PackageView(package.Id, package.Slug, package.Title, package.CreatedAt);
    }
}
```

> **Atomicity:** when Wolverine's `IDbContextOutbox<ContentDbContext>` is wired (Task 15), `outbox.PublishAsync` enrolls the outgoing envelope in the same EF SaveChanges transaction. Both the row and the envelope land in Postgres together, then Wolverine forwards to RabbitMQ asynchronously.

- [ ] **Step 4: `CreatePackageEndpoint`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageEndpoint.cs`:

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.CreatePackage;

internal static class CreatePackageEndpoint
{
    public static IEndpointRouteBuilder MapCreatePackage(this IEndpointRouteBuilder group)
    {
        group.MapPost("/", HandleAsync)
            .WithName("CreatePackage")
            .WithTags("Content");
        return group;
    }

    private static async Task<Results<Created<CreatePackageResponse>, Conflict<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        CreatePackageRequest request,
        CreatePackageHandler handler,
        CancellationToken cancellationToken)
    {
        Result<PackageView, Error> result = await handler
            .HandleAsync(new CreatePackageCommand(request.Slug, request.Title), cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            return result.Error.Code.EndsWith("Conflict", StringComparison.Ordinal)
                ? TypedResults.Conflict(payload)
                : TypedResults.BadRequest(payload);
        }

        PackageView view = result.Value;
        CreatePackageResponse body = new(view.Id, view.Slug, view.Title, view.CreatedAt);
        return TypedResults.Created($"/api/packages/{view.Id}/", body);
    }

    internal sealed record ErrorPayload(string Code, string Message);
}
```

- [ ] **Step 5: Build + commit**

```bash
dotnet build backend/arena.slnx
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features backend/ArenaApi/src/ArenaApi.Contracts/Content
git commit -m "feat(content): CreatePackage command, handler, endpoint, contracts"
```

---

## Task 12: `ContentModule.cs` — registration + endpoint mapping

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/ContentModule.cs`

- [ ] **Step 1: Module registration**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/ContentModule.cs`:

```csharp
using ArenaApi.Core.ConnectionStringNames;
using ArenaApi.Core.Modules.Content.Features.CreatePackage;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Shared.Outbox;
using ArenaApi.Core.Shared.Time;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content;

public static class ContentModule
{
    public static IServiceCollection AddContentModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ContentDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ArenaApi.Core.ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ContentDbContext.SchemaName)));

        services.AddScoped<IContentReader, ContentReader>();
        services.AddScoped<IOutboxService, ContentOutboxService>();
        services.AddScoped<CreatePackageHandler>();
        services.AddSingleton<IClock, SystemClock>();

        return services;
    }

    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder packages = app.MapGroup("/api/packages");
        packages.MapCreatePackage();
        return app;
    }
}
```

> **Note on IOutboxService registration:** We're registering one `IOutboxService` per module here. Because all three modules (Content/Execution/Progress) will end up registering different impls of the same interface in the same DI container, this looks wrong. **It is.** The fix: do not register `IOutboxService` as a flat service. Instead each handler injects its module's specific outbox service by concrete type, OR we use keyed services. See note below.

**Decision (locked):** Each module's handlers depend on `IOutboxService` resolved by *concrete type* via `services.AddScoped<ContentOutboxService>()`, and `CreatePackageHandler` takes `ContentOutboxService` directly (not `IOutboxService`). The interface exists for testability/documentation; handlers don't inject it generically. Update both files:

In `CreatePackageHandler.cs`, replace the `IOutboxService outbox` parameter with `ContentOutboxService outbox`. Drop the `using ArenaApi.Core.Shared.Outbox;` line.

In `ContentModule.cs`, replace:

```csharp
services.AddScoped<IOutboxService, ContentOutboxService>();
```

with:

```csharp
services.AddScoped<ContentOutboxService>();
```

`IOutboxService` stays in `Shared/` as a documented shape (and is implemented by each per-module outbox for parity), but injection points use the concrete type. This avoids DI collisions and keeps each module's outbox firmly within its own boundary.

- [ ] **Step 2: Build**

```bash
dotnet build backend/arena.slnx
```

Expected: 0 warnings, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/ContentModule.cs backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageHandler.cs
git commit -m "feat(content): ContentModule registers DbContext, handler, reader, outbox"
```

---

## Task 13: Execution module skeleton

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContext.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContextDesignTimeFactory.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionOutboxService.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/ExecutionModule.cs`

- [ ] **Step 1: `ExecutionDbContext`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContext.cs`:

```csharp
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Execution.Infrastructure;

public sealed class ExecutionDbContext(DbContextOptions<ExecutionDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_execution";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ExecutionDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Core.Modules.Execution.Infrastructure.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
```

- [ ] **Step 2: Design-time factory**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContextDesignTimeFactory.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ArenaApi.Core.Modules.Execution.Infrastructure;

internal sealed class ExecutionDbContextDesignTimeFactory : IDesignTimeDbContextFactory<ExecutionDbContext>
{
    public ExecutionDbContext CreateDbContext(string[] args)
    {
        DbContextOptionsBuilder<ExecutionDbContext> options = new();
        options.UseNpgsql(
            "Host=localhost;Database=sharp_arena;Username=arena;Password=arena",
            npgsql => npgsql.MigrationsHistoryTable(
                "__EFMigrationsHistory",
                ExecutionDbContext.SchemaName));
        return new ExecutionDbContext(options.Options);
    }
}
```

- [ ] **Step 3: `ExecutionOutboxService`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionOutboxService.cs`:

```csharp
using ArenaApi.Core.Shared.Outbox;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Execution.Infrastructure;

internal sealed class ExecutionOutboxService(IDbContextOutbox<ExecutionDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
```

- [ ] **Step 4: `ExecutionModule`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/ExecutionModule.cs`:

```csharp
using ArenaApi.Core.Modules.Execution.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Execution;

public static class ExecutionModule
{
    public static IServiceCollection AddExecutionModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ExecutionDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ArenaApi.Core.ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ExecutionDbContext.SchemaName)));

        services.AddScoped<ExecutionOutboxService>();
        return services;
    }
}
```

No endpoints to map yet — Execution module exposes no HTTP surface in Phase 0.

- [ ] **Step 5: Build + commit**

```bash
dotnet build backend/arena.slnx
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution
git commit -m "feat(execution): module skeleton — DbContext, outbox service, registration"
```

---

## Task 14: Progress module skeleton + `PackageCreatedHandler`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/Infrastructure/ProgressDbContext.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/Infrastructure/ProgressDbContextDesignTimeFactory.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/Infrastructure/ProgressOutboxService.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/EventHandlers/PackageCreatedHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/ProgressModule.cs`

- [ ] **Step 1: `ProgressDbContext`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/Infrastructure/ProgressDbContext.cs`:

```csharp
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Progress.Infrastructure;

public sealed class ProgressDbContext(DbContextOptions<ProgressDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_progress";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ProgressDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Core.Modules.Progress.Infrastructure.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
```

- [ ] **Step 2: Design-time factory**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/Infrastructure/ProgressDbContextDesignTimeFactory.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ArenaApi.Core.Modules.Progress.Infrastructure;

internal sealed class ProgressDbContextDesignTimeFactory : IDesignTimeDbContextFactory<ProgressDbContext>
{
    public ProgressDbContext CreateDbContext(string[] args)
    {
        DbContextOptionsBuilder<ProgressDbContext> options = new();
        options.UseNpgsql(
            "Host=localhost;Database=sharp_arena;Username=arena;Password=arena",
            npgsql => npgsql.MigrationsHistoryTable(
                "__EFMigrationsHistory",
                ProgressDbContext.SchemaName));
        return new ProgressDbContext(options.Options);
    }
}
```

- [ ] **Step 3: `ProgressOutboxService`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/Infrastructure/ProgressOutboxService.cs`:

```csharp
using ArenaApi.Core.Shared.Outbox;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Progress.Infrastructure;

internal sealed class ProgressOutboxService(IDbContextOutbox<ProgressDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
```

- [ ] **Step 4: `PackageCreatedHandler`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/EventHandlers/PackageCreatedHandler.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Public.IntegrationEvents;

namespace ArenaApi.Core.Modules.Progress.EventHandlers;

/// Phase 0 stub. Listens to PackageCreated published by the Content module
/// and logs that it received it. In later phases this will write a row to
/// arena_progress.package_progress to track per-user enrollment, but the
/// listener wiring is identical — only the body grows.
internal static class PackageCreatedHandler
{
    public static void Handle(PackageCreated message, ILogger<PackageCreatedHandlerLogCategory> logger)
    {
        logger.LogInformation(
            "Progress module received PackageCreated for {PackageId} ({Slug})",
            message.PackageId,
            message.Slug);
    }

    internal sealed class PackageCreatedHandlerLogCategory;
}
```

> **Why a static handler?** Wolverine discovers handlers by convention: `public static void Handle(...)` (or `HandleAsync`) on any type. Static + nested log-category class gives a clean `ILogger<>` category without making the handler a service. If you prefer instance handlers, change to `internal sealed class PackageCreatedHandler { public void Handle(...) {} }` — Wolverine resolves the type from DI.

- [ ] **Step 5: `ProgressModule`**

Write `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/ProgressModule.cs`:

```csharp
using ArenaApi.Core.Modules.Progress.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Progress;

public static class ProgressModule
{
    public static IServiceCollection AddProgressModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ProgressDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ArenaApi.Core.ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ProgressDbContext.SchemaName)));

        services.AddScoped<ProgressOutboxService>();
        return services;
    }
}
```

- [ ] **Step 6: Build + commit**

```bash
dotnet build backend/arena.slnx
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Progress
git commit -m "feat(progress): module skeleton + PackageCreated listener"
```

---

## Task 15: WolverineConfiguration extension in Web

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Web/Configuration/WolverineConfiguration.cs`

- [ ] **Step 1: Write the extension**

Write `backend/ArenaApi/src/ArenaApi.Web/Configuration/WolverineConfiguration.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Modules.Execution.Infrastructure;
using ArenaApi.Core.Modules.Progress.Infrastructure;
using Wolverine;
using Wolverine.EntityFrameworkCore;
using Wolverine.Postgresql;
using Wolverine.RabbitMQ;

namespace ArenaApi.Web.Configuration;

public static class WolverineConfiguration
{
    public const string WolverineSchema = "arena_wolverine";

    public static IHostBuilder UseArenaWolverine(this IHostBuilder host)
    {
        host.UseWolverine((ctx, opts) =>
        {
            string pgConnection =
                ctx.Configuration.GetConnectionString(ArenaApi.Core.ConnectionStringNames.Database)
                ?? throw new InvalidOperationException("ConnectionStrings:Database is missing.");

            string rabbitConnection =
                ctx.Configuration.GetConnectionString(ArenaApi.Core.ConnectionStringNames.RabbitMq)
                ?? throw new InvalidOperationException("ConnectionStrings:RabbitMq is missing.");

            opts.PersistMessagesWithPostgresql(pgConnection, WolverineSchema);

            opts.UseRabbitMq(new Uri(rabbitConnection))
                .AutoProvision()
                .UseConventionalRouting();

            // Even when consumer is in-process, route messages through the broker so
            // future microservice extraction is mechanical (no code change at call site).
            opts.Policies.UseDurableInboxOnAllListeners();
            opts.Policies.UseDurableOutboxOnAllSendingEndpoints();

            // EF Core transactional outbox: enrolls each module's DbContext.
            // Order matters: AddDbContext<T> must already be registered when
            // UseEntityFrameworkCoreTransactions runs — which it is, because
            // Add<Module>Module() ran before host.UseWolverine() in Program.cs.
            opts.Services.AddDbContextWithWolverineIntegration<ContentDbContext>();
            opts.Services.AddDbContextWithWolverineIntegration<ExecutionDbContext>();
            opts.Services.AddDbContextWithWolverineIntegration<ProgressDbContext>();
        });

        return host;
    }
}
```

> **Important — verify Wolverine 4.x API at execution time:**
>
> The exact method names on `WolverineOptions` for EF Core integration evolved between Wolverine 2.x and 4.x. The current (4.x) idiom in the official docs is to call `opts.Services.AddDbContextWithWolverineIntegration<TDbContext>()` *inside* `UseWolverine` to wire up `IDbContextOutbox<T>` automatically. If that exact name is missing in the package, the alternatives are:
> 1. `services.AddDbContext<T>(...)` (already done in module registration) + `opts.UseEntityFrameworkCoreTransactions()`.
> 2. Replace `AddDbContextWithWolverineIntegration<T>()` calls with `opts.UseEntityFrameworkCoreTransactions()` once.
>
> Confirm with `dotnet add package WolverineFx.EntityFrameworkCore --dry-run` and Wolverine release notes. If you can't make `IDbContextOutbox<TDbContext>` resolve in handlers, fall back to injecting `IMessageBus` and publishing without per-context enrollment (atomicity guaranteed by Wolverine's listener-side dedup instead of EF transaction).

- [ ] **Step 2: Build**

```bash
dotnet build backend/arena.slnx
```

Expected: 0 errors. If a Wolverine type doesn't resolve, apply the verification note above and re-build.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Web/Configuration/WolverineConfiguration.cs
git commit -m "feat(web): Wolverine + RabbitMQ + Postgres outbox configuration"
```

---

## Task 16: Wire up `Program.cs` — modules, Wolverine, Redis, HybridCache

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Web/Program.cs`

- [ ] **Step 1: Final `Program.cs`**

Replace `backend/ArenaApi/src/ArenaApi.Web/Program.cs` with:

```csharp
using ArenaApi.Core.Features.Health;
using ArenaApi.Core.Modules.Content;
using ArenaApi.Core.Modules.Execution;
using ArenaApi.Core.Modules.IdentityStub;
using ArenaApi.Core.Modules.Progress;
using ArenaApi.Web.Configuration;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddIdentityStubModule(builder.Configuration)
    .AddContentModule(builder.Configuration)
    .AddExecutionModule(builder.Configuration)
    .AddProgressModule(builder.Configuration);

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString(ArenaApi.Core.ConnectionStringNames.Redis);
});

builder.Services.AddHybridCache();

builder.Host.UseArenaWolverine();

builder.Services.AddOpenApi();

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthEndpoints();
app.MapContentEndpoints();

await app.RunAsync();

namespace ArenaApi.Web
{
    public sealed class Program;
}
```

Order matters: modules register their DbContexts first, then `UseArenaWolverine` wraps each `DbContext` with outbox semantics. Redis is registered after modules so module code can opt-in to caching later.

- [ ] **Step 2: Update `appsettings.json` (base)** to keep `IdentityStub` undefined and connection strings sensible

It should already look like (from Task 3):

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "Database": "Host=localhost;Port=5432;Database=sharp_arena;Username=arena;Password=arena",
    "RabbitMq": "amqp://arena:arena@localhost:5672/",
    "Redis": "localhost:6379"
  }
}
```

No change needed if Task 3 was done correctly.

- [ ] **Step 3: Build**

```bash
dotnet build backend/arena.slnx
```

Expected: 0 warnings, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Web/Program.cs
git commit -m "feat(web): wire modules, Wolverine, Redis, HybridCache in Program.cs"
```

---

## Task 17: Architecture tests (NetArchTest)

**Files:**
- Create: `backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs`

- [ ] **Step 1: Write the boundary tests**

Write `backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs`:

```csharp
using System.Reflection;
using NetArchTest.Rules;
using Xunit;

namespace ArenaApi.UnitTests.Architecture;

public sealed class ModuleBoundariesTests
{
    private static Assembly CoreAssembly =>
        typeof(ArenaApi.Core.Modules.Content.ContentModule).Assembly;

    private const string ContentNs   = "ArenaApi.Core.Modules.Content";
    private const string ExecutionNs = "ArenaApi.Core.Modules.Execution";
    private const string ProgressNs  = "ArenaApi.Core.Modules.Progress";
    private const string IdentityNs  = "ArenaApi.Core.Modules.IdentityStub";

    [Fact]
    public void Content_internals_are_not_referenced_from_other_modules()
    {
        AssertNoCrossModuleInternalRef(sourceModule: ContentNs, otherModules: [ExecutionNs, ProgressNs]);
    }

    [Fact]
    public void Execution_internals_are_not_referenced_from_other_modules()
    {
        AssertNoCrossModuleInternalRef(sourceModule: ExecutionNs, otherModules: [ContentNs, ProgressNs]);
    }

    [Fact]
    public void Progress_internals_are_not_referenced_from_other_modules()
    {
        AssertNoCrossModuleInternalRef(sourceModule: ProgressNs, otherModules: [ContentNs, ExecutionNs]);
    }

    [Fact]
    public void IdentityStub_only_exposes_Public_namespace()
    {
        TestResult result = Types
            .InAssembly(CoreAssembly)
            .That()
            .ResideInNamespaceMatching($"^(?!{IdentityNs}).*")
            .ShouldNot()
            .HaveDependencyOn($"{IdentityNs}.Infrastructure")
            .GetResult();

        Assert.True(
            result.IsSuccessful,
            FailingTypesMessage("Non-IdentityStub code depends on IdentityStub.Infrastructure", result));
    }

    [Fact]
    public void DbContexts_are_not_referenced_outside_their_owning_module()
    {
        Assert.All(
            new (string Owner, string Type)[]
            {
                (ContentNs,   $"{ContentNs}.Infrastructure.ContentDbContext"),
                (ExecutionNs, $"{ExecutionNs}.Infrastructure.ExecutionDbContext"),
                (ProgressNs,  $"{ProgressNs}.Infrastructure.ProgressDbContext"),
            },
            x =>
            {
                TestResult result = Types
                    .InAssembly(CoreAssembly)
                    .That()
                    .ResideInNamespaceMatching($"^(?!{x.Owner}).*")
                    .And()
                    .DoNotResideInNamespace("ArenaApi.Core")  // top-level shared module-glue is exempt
                    .ShouldNot()
                    .HaveDependencyOn(x.Type)
                    .GetResult();

                Assert.True(
                    result.IsSuccessful,
                    FailingTypesMessage($"{x.Type} referenced outside {x.Owner}", result));
            });
    }

    private static void AssertNoCrossModuleInternalRef(string sourceModule, string[] otherModules)
    {
        foreach (string other in otherModules)
        {
            TestResult result = Types
                .InAssembly(CoreAssembly)
                .That()
                .ResideInNamespaceMatching($"^{other}\\.(?!Public).*")     // outside other's Public
                .ShouldNot()
                .HaveDependencyOnAny(
                    $"{sourceModule}.Domain",
                    $"{sourceModule}.Infrastructure",
                    $"{sourceModule}.Features")
                .GetResult();

            Assert.True(
                result.IsSuccessful,
                FailingTypesMessage($"{other} depends on {sourceModule} internals", result));
        }
    }

    private static string FailingTypesMessage(string title, TestResult result)
    {
        IEnumerable<string> failing = result.FailingTypeNames ?? [];
        return $"{title}: {string.Join(", ", failing)}";
    }
}
```

- [ ] **Step 2: Run only these tests**

```bash
dotnet test backend/arena.slnx --filter FullyQualifiedName~ModuleBoundariesTests
```

Expected: all four facts pass. If any fail, fix the source (don't relax the test). The most likely failure: `ContentModule.cs` references `ContentDbContext` from `ArenaApi.Core` (top-level glue) — that's why the `DbContexts_are_not_referenced_outside_their_owning_module` test excludes `ArenaApi.Core` namespace itself.

Reality-check the exclude: `ContentModule.cs` lives in `ArenaApi.Core.Modules.Content` not `ArenaApi.Core`, so it's *inside* the Content namespace; the exclusion above is for unforeseen glue code in the root `ArenaApi.Core` namespace. If tests still fail because `ArenaApi.Core.Modules.Content.ContentModule` references `ArenaApi.Core.Modules.Content.Infrastructure.ContentDbContext`, that's self-reference (Content → Content), which the regex `^(?!{x.Owner}).*` correctly excludes. Verify by running the test.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture
git commit -m "test(arch): NetArchTest rules for module boundaries"
```

---

## Task 18: Integration test — `POST /api/packages/` smoke

**Files:**
- Create: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs`
- Create: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/CreatePackageEndpointTests.cs`
- Modify: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/HealthEndpointTests.cs` (unskip)

- [ ] **Step 1: `IntegrationTestsWebFactory`**

Write `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Modules.Execution.Infrastructure;
using ArenaApi.Core.Modules.Progress.Infrastructure;
using ArenaApi.Web;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;
using Xunit;

namespace ArenaApi.IntegrationTests.Infrastructure;

public sealed class IntegrationTestsWebFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:17-alpine")
        .WithDatabase("sharp_arena")
        .WithUsername("arena")
        .WithPassword("arena")
        .Build();

    private readonly RabbitMqContainer _rabbit = new RabbitMqBuilder()
        .WithImage("rabbitmq:3.13-management-alpine")
        .Build();

    public string PostgresConnectionString => _postgres.GetConnectionString();
    public string RabbitConnectionString => _rabbit.GetConnectionString();

    public async ValueTask InitializeAsync()
    {
        await _postgres.StartAsync();
        await _rabbit.StartAsync();
        await CreateSchemasAsync();
    }

    public new async ValueTask DisposeAsync()
    {
        await _postgres.DisposeAsync();
        await _rabbit.DisposeAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Database", PostgresConnectionString);
        builder.UseSetting("ConnectionStrings:RabbitMq", RabbitConnectionString);
        // Redis is not used in tests — point it at the rabbit host (unused) to keep Program.cs happy.
        builder.UseSetting("ConnectionStrings:Redis", "localhost:6379");
        builder.UseSetting("IdentityStub:HardcodedUserId", Guid.CreateVersion7().ToString());

        builder.ConfigureServices(services =>
        {
            // Apply EF migrations on startup for each module.
            using ServiceProvider sp = services.BuildServiceProvider();
            using IServiceScope scope = sp.CreateScope();

            scope.ServiceProvider.GetRequiredService<ContentDbContext>().Database.Migrate();
            // Execution and Progress have no migrations yet; that's fine.
        });
    }

    private async Task CreateSchemasAsync()
    {
        await using NpgsqlConnection conn = new(PostgresConnectionString);
        await conn.OpenAsync();
        await using NpgsqlCommand cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE EXTENSION IF NOT EXISTS ltree;
            CREATE SCHEMA IF NOT EXISTS arena_content;
            CREATE SCHEMA IF NOT EXISTS arena_execution;
            CREATE SCHEMA IF NOT EXISTS arena_progress;
            CREATE SCHEMA IF NOT EXISTS arena_identity;
            CREATE SCHEMA IF NOT EXISTS arena_wolverine;
        """;
        await cmd.ExecuteNonQueryAsync();
    }
}
```

> **Verification:** the `RabbitMqContainer.GetConnectionString()` returns `amqp://...` form. Confirm against `Testcontainers.RabbitMq` 4.x docs. If not, build the URI manually with `_rabbit.Hostname` + `GetMappedPublicPort(5672)`.

- [ ] **Step 2: `CreatePackageEndpointTests`**

Write `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/CreatePackageEndpointTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using ArenaApi.Contracts.Content;
using ArenaApi.IntegrationTests.Infrastructure;
using Npgsql;
using Xunit;

namespace ArenaApi.IntegrationTests.Modules.Content;

[Collection(nameof(IntegrationTestsCollection))]
public sealed class CreatePackageEndpointTests : IClassFixture<IntegrationTestsWebFactory>
{
    private readonly IntegrationTestsWebFactory _factory;

    public CreatePackageEndpointTests(IntegrationTestsWebFactory factory) => _factory = factory;

    [Fact]
    public async Task CreatePackage_persists_row_and_publishes_envelope()
    {
        HttpClient client = _factory.CreateClient();
        string slug = $"smoke-{Guid.NewGuid():N}";

        HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/packages/",
            new CreatePackageRequest(slug, "Smoke Title"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        CreatePackageResponse? body = await response.Content.ReadFromJsonAsync<CreatePackageResponse>();
        Assert.NotNull(body);
        Assert.Equal(slug, body!.Slug);

        // 1. Row exists in arena_content.packages.
        await using NpgsqlConnection conn = new(_factory.PostgresConnectionString);
        await conn.OpenAsync();

        await using (NpgsqlCommand cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT COUNT(*) FROM arena_content.packages WHERE slug = @slug";
            cmd.Parameters.AddWithValue("slug", slug);
            object? count = await cmd.ExecuteScalarAsync();
            Assert.Equal(1L, Assert.IsType<long>(count));
        }

        // 2. Envelope exists in arena_wolverine.* and is eventually marked processed.
        await WaitForEnvelopeProcessedAsync(conn, slug);
    }

    private static async Task WaitForEnvelopeProcessedAsync(NpgsqlConnection conn, string slug)
    {
        // Wolverine tables: arena_wolverine.wolverine_outgoing_envelopes (or similar).
        // The exact table name depends on Wolverine version; query the schema first.
        DateTime deadline = DateTime.UtcNow.AddSeconds(15);
        while (DateTime.UtcNow < deadline)
        {
            await using NpgsqlCommand cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = 'arena_wolverine';
            """;
            object? count = await cmd.ExecuteScalarAsync();
            if (Convert.ToInt64(count) > 0)
            {
                return;
            }

            await Task.Delay(500);
        }

        Assert.Fail("Wolverine envelope tables were not auto-provisioned in arena_wolverine schema within 15s.");
    }
}

[CollectionDefinition(nameof(IntegrationTestsCollection))]
public sealed class IntegrationTestsCollection : ICollectionFixture<IntegrationTestsWebFactory>;
```

> **Refinement note:** the envelope-processed assertion above is a *weak* check — it confirms that Wolverine auto-provisioned its schema. A stronger check would query a specific Wolverine table (e.g., `wolverine_outgoing_envelopes` for not-yet-sent, or join against the message type). Locking that down requires knowing the exact table name in Wolverine 4.x. Acceptable for the smoke test; tighten later when adding more integration tests.

- [ ] **Step 3: Unskip `HealthEndpointTests`**

Replace the `[Fact(Skip = ...)]` attribute on `HealthReturnsOk` with a plain `[Fact]`, and make the test use the new factory:

```csharp
using System.Net;
using ArenaApi.IntegrationTests.Infrastructure;
using Xunit;

namespace ArenaApi.IntegrationTests;

[Collection(nameof(Modules.Content.IntegrationTestsCollection))]
public sealed class HealthEndpointTests : IClassFixture<IntegrationTestsWebFactory>
{
    private readonly IntegrationTestsWebFactory _factory;

    public HealthEndpointTests(IntegrationTestsWebFactory factory) => _factory = factory;

    [Fact]
    public async Task HealthReturnsOk()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

- [ ] **Step 4: Run integration tests**

```bash
dotnet test backend/arena.slnx --filter Category!=Skipped
```

Expected: all tests pass. Postgres + RabbitMQ containers spin up via Testcontainers; first run is slow because images pull (~30s).

If `WolverineFx` auto-provision throws because RabbitMQ isn't ready, add `WaitStrategy.UntilPortIsListening()` to the Rabbit container builder. Testcontainers' default health check usually handles this, but version drift is real.

- [ ] **Step 5: Commit**

```bash
git add backend/ArenaApi/tests/ArenaApi.IntegrationTests
git commit -m "test(integration): smoke for POST /api/packages/ via Testcontainers (PG + Rabbit)"
```

---

## Task 19: Documentation updates

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `.claude/rules/backend-conventions.md`
- Modify: `CLAUDE.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Rewrite `docs/ARCHITECTURE.md`**

Replace the "Service layout" + "Data model" + "API contract" sections with the modular layout. Insert (after the existing intro sections) the following:

```markdown
## Modular monolith

Single backend process. Inside `ArenaApi.Core`, code is organised by
**module**, not by technical layer. Each module owns:

- its own Postgres schema (`arena_<module>`),
- its own EF Core `DbContext` (never shared),
- its own folder under `ArenaApi.Core/Modules/<Name>/` with the layout
  `Public/ Domain/ Features/ Infrastructure/`.

A module's **Public** folder is the only surface other modules see — every
other folder is implementation detail, enforced by `NetArchTest` rules in
`tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs`.

| Module        | Schema             | Owns                                                 |
| ------------- | ------------------ | ---------------------------------------------------- |
| Content       | `arena_content`    | Packages, tasks, chapters, hints                     |
| Execution     | `arena_execution`  | Runners, run requests, results, Docker sandbox       |
| Progress      | `arena_progress`   | User attempts, completion, XP, scoreboard            |
| IdentityStub  | `arena_identity`   | `ICurrentUser` — hardcoded `Guid` (stub until SSO)   |

### Communication between modules

Three legal paths, in order of preference:

1. **Sync read via public contract.** A module exposes `I<Module>Reader`
   in its `Public/` folder; other modules inject the interface. Read-only.
   No mutations, no business logic — just projection.
2. **Domain events (intra-module).** Aggregates raise `IDomainEvent`
   inside themselves; handlers in the same module react in the same DB
   transaction. Never crosses a module boundary.
3. **Integration events (inter-module).** Side effects that cross modules
   travel through Wolverine + RabbitMQ with Postgres durable outbox.
   Even when the consumer is in the same process, the message goes
   through the broker — so extracting a module into its own service later
   is mechanical (no call-site changes).

Direct cross-module method calls for mutations are **forbidden**. Use an
integration event. Direct DB reads across schemas are **forbidden**. Use a
reader.

### Wolverine + durable outbox

- Schema: `arena_wolverine` (auto-provisioned at startup).
- Setup: `backend/ArenaApi/src/ArenaApi.Web/Configuration/WolverineConfiguration.cs`.
- Routing: `UseDurableInboxOnAllListeners()` + `UseDurableOutboxOnAllSendingEndpoints()`
  — every send is durable, every listener acks durably.
- Each module's `DbContext` is wrapped with `IDbContextOutbox<T>` so
  `SaveChangesAsync` and outbound envelopes commit atomically.
- Per-module wrapper: `<Module>OutboxService` in `Modules/<Module>/Infrastructure/`,
  implementing the shared `IOutboxService` shape. Handlers inject the
  concrete wrapper (not the interface) to avoid DI collisions.

### Identity is a stub

`Modules/IdentityStub/Public/ICurrentUser.cs` exposes one property:
`Guid UserId`. The implementation reads a hardcoded ID from
`appsettings:IdentityStub:HardcodedUserId`. When real SSO arrives, the
implementation behind `ICurrentUser` swaps; nothing else changes. Do not
add fields here unless every consumer truly needs them across SSO
migration — extra surface = extra rewrite.
```

Update the "API contract" table to keep only `/health` and `POST /api/packages/` for now (the rest of the endpoints listed there are Phase 1+).

Update the "Data model" section to note: tables live in per-module schemas, not the legacy `arena` schema. Each module's tables are scoped under `arena_<module>`.

- [ ] **Step 2: Update `.claude/rules/backend-conventions.md`**

After the existing "Project structure (vertical slice)" section, insert:

```markdown
## Module boundaries

`ArenaApi.Core/Modules/<Name>/` is the unit of isolation. Hard rules,
enforced by `tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs`:

- A module's `Domain/`, `Infrastructure/`, and `Features/` are **internal**.
  Other modules must not reference any type from these folders.
- A module's `Public/` is the only legal cross-module surface. Other
  modules import from `Modules/<Other>.Public.*` only.
- Each module owns exactly one `DbContext`. `<Other>DbContext` types
  are never injected outside their owning module.
- Each module owns exactly one Postgres schema (`arena_<module>`).
- Each module's `Infrastructure/Migrations/` is per-module. Never share.
- Inter-module side-effects go through Wolverine integration events
  (defined in `<Module>.Public.IntegrationEvents`), never direct calls.
- Inter-module reads go through `I<Module>Reader` (in `<Module>.Public`),
  never direct DbContext access.

### Generating a migration for a specific module

```bash
dotnet ef migrations add <Name> \
  --project ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj \
  --startup-project ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj \
  --context <Module>DbContext \
  --output-dir Modules/<Module>/Infrastructure/Migrations
```

Migrations are immutable: never delete/rename/modify a committed
migration. Add a corrective migration instead.
```

Also: update the "Connection strings" section — the only string-name key still relevant is `Database`, but two more were added (`RabbitMq`, `Redis`). Replace that section with:

```markdown
## Connection strings

Use the constants in `ArenaApi.Core.ConnectionStringNames`:

- `Database` — primary Postgres connection used by every module's DbContext
  *and* by Wolverine's `PersistMessagesWithPostgresql`.
- `RabbitMq` — AMQP URI for Wolverine's RabbitMQ transport.
- `Redis` — connection string for `AddStackExchangeRedisCache` /
  `HybridCache`. Redis is registered but not actively used in Phase 0.

Never reference the raw string literal.
```

- [ ] **Step 3: Update `CLAUDE.md` (root)**

Replace the "Layout" table and the "Hard rules" section to reflect modular structure. After "What this codebase is", expand the bullet that says "Two modes, one engine" with an additional bullet:

```markdown
- **Modular monolith.** One backend process, but code inside
  `ArenaApi.Core/Modules/<Content|Execution|Progress|IdentityStub>/` is
  isolated by NetArchTest rules. Cross-module communication: sync read
  via `IXxxReader`, side-effects via Wolverine + RabbitMQ + Postgres
  durable outbox. Each module owns its own DbContext + schema. Identity
  is a hardcoded stub; real SSO comes later.
- **RabbitMQ + Redis in infra.** Wolverine routes messages through
  Rabbit even when the consumer is in-process. Redis is wired but not
  actively used in Phase 0 (will back caching + sessions later).
```

Replace the Layout table:

```markdown
| Path                                       | Owns                                                            |
| ------------------------------------------ | --------------------------------------------------------------- |
| `backend/ArenaApi/src/ArenaApi.Web/`       | Host: Program.cs, configuration, endpoint mapping               |
| `backend/ArenaApi/src/ArenaApi.Core/`      | Shared primitives + per-module code (`Modules/<Name>/`)         |
| `backend/ArenaApi/src/ArenaApi.Contracts/` | HTTP DTOs (request/response records, no domain dependency)      |
| `backend/ArenaApi/src/ArenaApi.Infrastructure/` | Reserved for cross-cutting infra (OTel, logging, jobs)     |
| `frontend/`                                | Next.js 16 App Router, FSD layers, Tailwind 4                   |
| `runners/<lang>/`                          | One Dockerfile per supported language. Phase 0 = TODO           |
| `docker/postgres/`                         | DB init SQL (schemas + extensions)                              |
| `docs/`                                    | Architecture, visual style, roadmap                             |
| `.claude/rules/`                           | Conventions auto-loaded by Claude Code                          |
```

Add a "Hard rules" bullet:

```markdown
- **Module boundaries** are enforced via `NetArchTest`. Cross-module
  references must go through `Modules/<Module>/Public/`. Direct
  references to `<Other>DbContext`, `<Other>.Domain`, `<Other>.Features`,
  or `<Other>.Infrastructure` will fail the architecture test suite.
```

- [ ] **Step 4: Tick the relevant ROADMAP box**

In `docs/ROADMAP.md`, in the "Phase 0 — bootstrap" section, add (at the end of the checklist):

```markdown
- [x] Modular monolith — 3 modules (Content/Execution/Progress) + IdentityStub.
- [x] Wolverine + RabbitMQ + Postgres durable outbox wired end-to-end.
- [x] Redis registered (not actively used yet).
```

- [ ] **Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md docs/ROADMAP.md CLAUDE.md .claude/rules/backend-conventions.md
git commit -m "docs: document modular monolith, Wolverine, IdentityStub"
```

---

## Task 20: Final verification — `docker compose up` end-to-end

This task does no code work — only manual verification that all acceptance criteria are met. Stop here and check each item.

- [ ] **Step 1: Full build with warnings-as-errors**

```bash
dotnet build backend/arena.slnx
```

Expected: `Build succeeded.` with `0 Warning(s)` and `0 Error(s)`.

- [ ] **Step 2: Full test run**

```bash
dotnet test backend/arena.slnx
```

Expected: all tests pass — `SmokeTests.Smoke`, all 4 `ModuleBoundariesTests`, `HealthEndpointTests.HealthReturnsOk`, `CreatePackageEndpointTests.CreatePackage_persists_row_and_publishes_envelope`.

- [ ] **Step 3: Start the stack**

```bash
docker compose up -d --build
```

Wait until all 5 services report `healthy`:

```bash
docker compose ps
```

Expected: `arena-postgres`, `arena-rabbitmq`, `arena-redis`, `arena-api`, `arena-frontend` — all `healthy` or `running`.

- [ ] **Step 4: Health check**

```bash
curl -fsS http://localhost:5000/health
```

Expected: `{"status":"ok"}`.

- [ ] **Step 5: Create a package**

```bash
curl -i -X POST http://localhost:5000/api/packages/ \
  -H 'Content-Type: application/json' \
  -d '{"slug":"smoke-test","title":"Smoke Test Package"}'
```

Expected: `HTTP/1.1 201 Created`, body containing `{"id":"...","slug":"smoke-test",...}`.

- [ ] **Step 6: Verify row in Postgres**

```bash
docker exec -it arena-postgres psql -U arena -d sharp_arena \
  -c "SELECT id, slug, title FROM arena_content.packages WHERE slug = 'smoke-test';"
```

Expected: one row.

- [ ] **Step 7: Verify Wolverine envelope tables and Progress log**

```bash
docker exec -it arena-postgres psql -U arena -d sharp_arena \
  -c "\dt arena_wolverine.*"
```

Expected: Wolverine's envelope tables are present.

```bash
docker logs arena-api 2>&1 | grep "received PackageCreated"
```

Expected: at least one log line `Progress module received PackageCreated for <guid> (smoke-test)`.

If the log line is missing within 30s of the POST, check:
1. `docker logs arena-rabbitmq` — broker is running?
2. `docker exec arena-postgres psql -U arena -d sharp_arena -c "SELECT * FROM arena_wolverine.wolverine_outgoing_envelopes;"` — is the envelope stuck `pending`?
3. `docker logs arena-api 2>&1 | grep -i wolverine` — any startup errors?

- [ ] **Step 8: Tear down**

```bash
docker compose down -v
```

- [ ] **Step 9: Final commit (if any docs or fixes accumulated)**

```bash
git status
```

If clean, you're done. If there are last-minute fixups:

```bash
git add -A
git commit -m "chore: final modular monolith verification fixups"
```

- [ ] **Step 10: Optional — push branch**

If working on a feature branch:

```bash
git push -u origin <branch-name>
```

---

## Self-review summary

- **Spec coverage:** Each of the user's acceptance criteria has a verification step in Task 20. Each module described in the spec has a creation task. The three communication patterns (public contracts, domain events, integration events) all have concrete files in the plan. Wolverine + RabbitMQ + Postgres outbox configuration has Task 15. Redis infrastructure-only registration has Task 16. IdentityStub has Task 6. NetArchTest rules have Task 17.
- **Placeholders:** None — every code step has full source. Wolverine version pin is explicit ("4.6.1, adjust uniformly if stale"). Two callouts ("verify Wolverine 4.x API" in Tasks 9, 15) are honest about needing API confirmation at execution time but provide fallback paths.
- **Type consistency:** `ContentDbContext.SchemaName == "arena_content"` is used in `ContentModule`, design-time factory, and integration test SQL — all consistent. `ICurrentUser`, `IContentReader`, `IOutboxService`, `PackageCreated` (integration event) names are unique and consistent across tasks. The `IOutboxService` design pivot in Task 12 — handlers inject concrete `<Module>OutboxService` not the interface — is applied to `CreatePackageHandler` in the same task.
- **Known fragile spots flagged:** Wolverine EF integration method name (Task 15), RabbitMQ Testcontainers connection string format (Task 18), Wolverine envelope table names (Task 18 weak assertion). Each has a documented workaround in-place.

---

## Execution choice

Plan complete and saved to `docs/superpowers/plans/2026-05-20-modular-monolith-migration.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration. Best for this plan because tasks 15/18 have verification points that benefit from an independent reviewer.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
