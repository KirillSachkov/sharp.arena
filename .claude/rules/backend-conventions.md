# Backend: conventions

## Project structure (vertical slice)

Inside a module, each feature is a flat folder under `Features/`:

```
ArenaApi.Core/Modules/<Module>/Features/<Action><Name>/
├── <Action><Name>Command.cs       # or Query
├── <Action><Name>Handler.cs       # returns Result<T, Error>
└── <Action><Name>Endpoint.cs      # minimal API mapping
```

No `Repositories/` layer — handlers read directly from the module's
`DbContext` and write through it (or through the module's outbox service
for cross-module side effects). Cross-module reads go through
`I<Module>Reader` in the producer module's `Public/` folder.

Each module exposes one `MapXxxEndpoints` extension; `Program.cs` calls them
through the module's `<Module>Module.MapXxx(...)` aggregator.

## Module boundaries

`ArenaApi.Core/Modules/<Name>/` is the unit of isolation. Hard rules,
enforced by `tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs`:

- A module's `Domain/`, `Infrastructure/`, and `Features/` are **internal**.
  Other modules must not reference any type from these folders.
- A module's `Public/` is the only legal cross-module surface. Other modules
  import from `ArenaApi.Core.Modules.<Other>.Public.*` only.
- Each module owns exactly one `DbContext`. `<Other>DbContext` types are
  never injected outside their owning module.
- Each module owns exactly one Postgres schema (`arena_<module>`).
- Each module's `Infrastructure/Migrations/` is per-module. Never share.
- Inter-module side-effects go through Wolverine integration events
  (defined in `<Module>.Public.IntegrationEvents`), never direct calls.
- Inter-module reads go through `I<Module>Reader` (in `<Module>.Public`),
  never direct `DbContext` access.
- `IdentityStub.Infrastructure` is reachable only from the IdentityStub
  module itself; other modules see only `IdentityStub.Public.ICurrentUser`.

## `Result<T, Error>` over exceptions

Business outcomes return `Result<T, Error>` from `CSharpFunctionalExtensions`.
Throwing is for **bugs** (`ArgumentNullException`, contract violations), not
expected failures.

```csharp
// good
public async Task<Result<TaskDto, Error>> Handle(GetTaskQuery q, CancellationToken ct)
{
    Result<TaskEntity, Error> task = await _tasks.GetByAsync(t => t.Id == q.Id, ct);
    if (task.IsFailure) return task.Error;
    return TaskDto.From(task.Value);
}

// bad — never throw for business outcomes
if (task is null) throw new NotFoundException("task");
```

## EF Core

- **Per-module schema:** each module's `DbContext` sets its own default
  schema via `modelBuilder.HasDefaultSchema(<Module>DbContext.SchemaName)`.
  Schema names are `arena_content`, `arena_execution`, `arena_progress`,
  `arena_identity` (plus the Wolverine-owned `arena_wolverine`). There is
  no global `arena` schema.
- **Primary keys:** `Guid.CreateVersion7()` in domain factories. `Guid.NewGuid()`
  is banned by `BannedSymbols.txt` outside test code.
- **Child entities in nav-collections:** if a child is added via
  `parent.Children.Add(child)`, the child PK must come from a
  `ValueGenerator` (`Id = Guid.Empty` in the ctor). Otherwise EF treats the
  entity as existing and emits `UPDATE` instead of `INSERT`. Aggregate
  roots added via `DbSet.AddAsync` use `Guid.CreateVersion7()` directly.
- **Eager-load child collections explicitly** in repository methods with
  `.Include(...)` — don't rely on `AutoInclude` alone.

## Migrations

- **Immutable.** Never delete, rename, or modify an existing migration. To
  fix a mistake, add a **new** corrective migration.
- **No `CREATE INDEX CONCURRENTLY`** — EF Core wraps migrations in a transaction,
  which is incompatible. Use `migrationBuilder.Sql()` for composite / filtered /
  partial indexes that aren't expressible via Fluent API.
- **Generate a new migration for a specific module** (run from `backend/`):

  ```bash
  dotnet ef migrations add <Name> \
    --project ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj \
    --startup-project ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj \
    --context <Module>DbContext \
    --output-dir Modules/<Module>/Infrastructure/Migrations
  ```

  Pass the right `--context` (e.g. `ContentDbContext`) so EF picks the
  correct module. The output directory keeps migrations co-located with
  their owning module.

## Banned APIs

Enforced by `Microsoft.CodeAnalysis.BannedApiAnalyzers` via
`backend/BannedSymbols.txt`. Adding a new banned symbol is a deliberate
decision — discuss before adding.

- `Guid.NewGuid()` → use `Guid.CreateVersion7()`
- `Thread.Sleep(...)` → use `Task.Delay(...)`
- `throw new Exception(...)` → use a specific type or `Result<T, Error>`
- `Console.Write*` → use `ILogger`

## Connection strings

Use the constants in `ArenaApi.Core.ConnectionStringNames` — never reference
the raw string literal:

- `Database` — primary Postgres connection used by every module's `DbContext`
  *and* by Wolverine's `PersistMessagesWithPostgresql` (envelopes live in
  `arena_wolverine`).
- `RabbitMq` — AMQP URI for Wolverine's RabbitMQ transport.
- `Redis` — connection string for `AddStackExchangeRedisCache` /
  `HybridCache`. Redis is registered but not actively used in Phase 0.

## Endpoint conventions

- Minimal API only — no MVC controllers.
- Group routes with `RouteGroupBuilder` (one group per feature).
- **Trailing slash** in route templates: `/api/packages/`, not `/api/packages`.
  nginx returns `301` without it, which breaks CORS preflight.
- Permissions / roles: Phase 0 has none. When auth lands, do not hardcode
  role strings — wrap them in a `Permissions` static class.

## Tests

- **Unit tests:** xUnit, target the Domain and Handler classes directly.
- **Integration tests:** `WebApplicationFactory<Program>` + Testcontainers
  (`Testcontainers.PostgreSql`) + Respawn for inter-test cleanup.
- `Guid.NewGuid()` is OK in tests (banned-symbols suppressed for test
  projects via `Directory.Build.props`).
