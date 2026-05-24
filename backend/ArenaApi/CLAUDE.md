# ArenaApi — service memory

Single .NET 10 service powering Sharp Arena, structured as a **modular
monolith with modules as projects**. Layout:

| Project                                                                                | Owns                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/ArenaApi.Web`                                                                     | Minimal API host, `Program.cs`, `appsettings.*.json`, Wolverine + module wiring       |
| `src/ArenaApi.SharedKernel`                                                            | Cross-cutting primitives (Error, IClock, IDomainEvent, IOutboxService, ConnectionStringNames) |
| `src/ArenaApi.Contracts`                                                               | HTTP DTOs (per-module subfolders)                                                     |
| `src/Modules/<Name>/ArenaApi.Modules.<Name>.Public/`                                   | Cross-module surface: `I<Name>Reader`, view DTOs, integration events                  |
| `src/Modules/<Name>/ArenaApi.Modules.<Name>.Domain/`                                   | Aggregates, value objects, domain events                                              |
| `src/Modules/<Name>/ArenaApi.Modules.<Name>.Application/`                              | `<Name>DbContext`, EF configurations, command/query handlers, endpoints, `<Name>OutboxService` |
| `src/Modules/<Name>/ArenaApi.Modules.<Name>.Infrastructure.Postgres/`                  | Migrations, DesignTimeFactory, `<Name>Reader` (Public impl), `Add<Name>Module` extension |

**DbContext in Application** — vertical-slice convention: keeps the
Application layer self-contained (Domain, Public, and SharedKernel are
its only upstream dependencies) and avoids an Application→Infrastructure
reference. Infrastructure.Postgres references Application to access the
`DbContext` and generate migrations.

**Registration extension in Infrastructure.Postgres** — `Add<Name>Module`
lives there because it needs visibility into both the Application layer
(to register `DbContext`, handlers, endpoints) and the Postgres layer
(to add migrations, register the `<Name>Reader` implementation).

**Module count summary:**
- **Content** — 4 projects: Public + Domain + Application + Infrastructure.Postgres (full module)
- **Execution** — 3 projects: Public + Application + Infrastructure.Postgres (no Domain yet — skeleton)
- **Progress** — 3 projects: Public + Application + Infrastructure.Postgres (no Domain yet — skeleton)
- **IdentityStub** — 3 projects: Public + Application + Infrastructure (no Postgres — no DB)

## Phase 0 status

- **Content** is fully wired: `Package` aggregate, `ContentInitial`
  migration (table `arena_content.packages`), `POST /api/packages/`
  endpoint, integration-event publishing.
- **Execution** and **Progress** ship as skeletons — `DbContext` and
  `<Module>OutboxService` only, no entities or migrations yet.
- **Progress** has one Wolverine handler — `PackageCreatedHandler` — that
  consumes the smoke `PackageCreated` integration event from Content.
- **IdentityStub** binds `ICurrentUser` to a hardcoded `Guid` from
  `appsettings:IdentityStub:HardcodedUserId`. Currently unused by callers;
  it stays wired so SSO replacement is a single-implementation swap.

## Adding a new feature inside a module

Create a flat folder under the module's `Application` project's `Features/`:

```
src/Modules/<Module>/ArenaApi.Modules.<Module>.Application/Features/<Action><Name>/
├── <Action><Name>Command.cs           # or Query
├── <Action><Name>Handler.cs           # returns Result<T, Error>
└── <Action><Name>Endpoint.cs          # minimal API mapping
```

Wire the endpoint via the module's `Map<Module>Endpoints` aggregator (called
from `Program.cs`). Handlers depend on the module's `DbContext` for writes
and on `I<Other>Reader` (from another module's `Public` project) for
cross-module reads. Side effects that cross a module boundary go through the
concrete `<Module>OutboxService` so they ride the Wolverine + RabbitMQ +
Postgres durable outbox.

## Adding a new module

1. Create `ArenaApi/src/Modules/<New>/` with four csproj subprojects:
   `ArenaApi.Modules.<New>.Public`, `ArenaApi.Modules.<New>.Domain`,
   `ArenaApi.Modules.<New>.Application`, and
   `ArenaApi.Modules.<New>.Infrastructure.Postgres`.
2. Add `<New>DbContext` (in Application) with
   `public const string SchemaName = "arena_<new>"` and
   `modelBuilder.HasDefaultSchema(SchemaName)` in `OnModelCreating`.
3. Add `<New>OutboxService` (in Application) implementing `IOutboxService`
   over `IDbContextOutbox<<New>DbContext>`.
4. Add `Add<New>Module` extension method (in Infrastructure.Postgres) with
   `AddNewModule(IServiceCollection, IConfiguration)` and (if it owns
   endpoints) `MapNewEndpoints(IEndpointRouteBuilder)`.
5. Register the module in `Program.cs` and add the schema to
   `docker/postgres/init.sql`.
6. Generate the first migration with `--context <New>DbContext --output-dir
   Migrations` (run from the Infrastructure.Postgres project directory).
7. Add all four csproj files to `backend/arena.slnx`.

## Conventions

- **Module boundaries** are compiler-enforced via the `csproj` ProjectReference
  graph. Each module's internal layers (`Domain`, `Application`,
  `Infrastructure.Postgres`) are separate projects; modules cannot reference
  another module's internals at compile time. A forbidden cross-module type
  reference fails `dotnet build`. The only legal cross-module reference is to
  another module's `Public` project.
- **Per-module schemas:** `arena_content`, `arena_execution`,
  `arena_progress`, `arena_identity`. Wolverine envelopes live in
  `arena_wolverine`. There is no global `arena` schema.
- `Guid.CreateVersion7()` in domain factories. `Guid.NewGuid()` is banned
  (see `backend/BannedSymbols.txt`).
- `Result<T, Error>` for business outcomes — no exceptions.
- Never modify existing migrations. Add a corrective one. Each module owns
  its own `Migrations/` folder inside its `Infrastructure.Postgres` project.
- Connection-string keys are `Database`, `RabbitMq`, `Redis` — constants
  in `SharedKernel/ConnectionStringNames.cs`.
- Wolverine setup lives in `Web/Configuration/WolverineConfiguration.cs`
  and is invoked via `builder.UseArenaWolverine()` on
  `IHostApplicationBuilder`.
