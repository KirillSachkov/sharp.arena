# ArenaApi — service memory

Single .NET 10 service powering Sharp Arena, structured as a **modular
monolith**. Four projects:

| Project                                | Owns                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/ArenaApi.Web`                     | Minimal API host, `Program.cs`, `appsettings.*.json`, Wolverine + module wiring       |
| `src/ArenaApi.Core`                    | `Shared/` primitives and `Modules/<Name>/` (modular body) — Domain, Features, Infra   |
| `src/ArenaApi.Contracts`               | HTTP DTOs (request/response records). No Domain dependency                            |
| `src/ArenaApi.Infrastructure`          | Reserved shell for cross-cutting infra (OTel, logging, jobs). Empty in Phase 0        |

`ArenaApi.Domain` and `ArenaApi.Infrastructure.Postgres` no longer exist —
domain types and `DbContext`s live per-module under
`ArenaApi.Core/Modules/<M>/`.

## Modular layout inside `ArenaApi.Core`

```
ArenaApi.Core/
├── ConnectionStringNames.cs           # constants: Database, RabbitMq, Redis
├── Shared/                            # cross-cutting primitives
│   ├── Errors/                        # Error record, CommonErrors
│   ├── Time/                          # IClock, SystemClock
│   ├── Identifiers/                   # TimeOrderedGuidValueGenerator
│   ├── DomainEvents/                  # IDomainEvent, IHasDomainEvents (markers)
│   └── Outbox/                        # IOutboxService facade
├── Features/Health/                   # non-module slice — stays at top level
└── Modules/
    ├── Content/                       # full module
    │   ├── ContentModule.cs           # AddContentModule, MapContentEndpoints
    │   ├── Public/                    # only surface other modules import
    │   │   ├── IContentReader.cs
    │   │   ├── PackageView.cs
    │   │   └── IntegrationEvents/PackageCreated.cs
    │   ├── Domain/                    # internal aggregates + domain events
    │   ├── Features/<Action><Name>/   # vertical slice — Command + Handler + Endpoint
    │   └── Infrastructure/            # ContentDbContext, configurations, reader,
    │                                  # outbox service, Migrations/
    ├── Execution/                     # skeleton (DbContext + outbox only)
    ├── Progress/                      # skeleton + PackageCreatedHandler listener
    │   └── EventHandlers/
    └── IdentityStub/                  # ICurrentUser hardcoded Guid
        ├── Public/ICurrentUser.cs
        └── Infrastructure/StubCurrentUser.cs
```

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

Create a flat folder under the module's `Features/`:

```
ArenaApi.Core/Modules/<Module>/Features/<Action><Name>/
├── <Action><Name>Command.cs           # or Query
├── <Action><Name>Handler.cs           # returns Result<T, Error>
└── <Action><Name>Endpoint.cs          # minimal API mapping
```

Wire the endpoint via the module's `Map<Module>Endpoints` aggregator (called
from `Program.cs`). Handlers depend on the module's `DbContext` for writes
and on `I<Other>Reader` (from another module's `Public/`) for cross-module
reads. Side effects that cross a module boundary go through the concrete
`<Module>OutboxService` so they ride the Wolverine + RabbitMQ + Postgres
durable outbox.

## Adding a new module

1. Create `ArenaApi.Core/Modules/<New>/` with `Public/ Domain/ Features/ Infrastructure/`.
2. Add `<New>DbContext` with `public const string SchemaName = "arena_<new>"`
   and `modelBuilder.HasDefaultSchema(SchemaName)` in `OnModelCreating`.
3. Add `<New>OutboxService` implementing `IOutboxService` over
   `IDbContextOutbox<<New>DbContext>`.
4. Add `<New>Module` with `AddNewModule(IServiceCollection, IConfiguration)`
   and (if it owns endpoints) `MapNewEndpoints(IEndpointRouteBuilder)`.
5. Register the module in `Program.cs` and add the schema to
   `docker/postgres/init.sql`.
6. Generate the first migration with `--context <New>DbContext --output-dir
   Modules/<New>/Infrastructure/Migrations`.

## Conventions

- **Module boundaries** are compiler-enforced via the `csproj` ProjectReference
  graph. Each module's internal layers (`Domain`, `Application`,
  `Infrastructure.Postgres`) are separate projects; modules cannot reference
  another module's internals at compile time. A forbidden cross-module type
  reference fails `dotnet build`.
- **Per-module schemas:** `arena_content`, `arena_execution`,
  `arena_progress`, `arena_identity`. Wolverine envelopes live in
  `arena_wolverine`. There is no global `arena` schema.
- `Guid.CreateVersion7()` in domain factories. `Guid.NewGuid()` is banned
  (see `backend/BannedSymbols.txt`).
- `Result<T, Error>` for business outcomes — no exceptions.
- Never modify existing migrations. Add a corrective one. Each module owns
  its own `Migrations/` folder.
- Connection-string keys are `Database`, `RabbitMq`, `Redis` — constants
  in `Core/ConnectionStringNames.cs`.
- Wolverine setup lives in `Web/Configuration/WolverineConfiguration.cs`
  and is invoked via `builder.UseArenaWolverine()` on
  `IHostApplicationBuilder`.
