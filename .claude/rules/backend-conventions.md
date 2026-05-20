# Backend: conventions

## Project structure (vertical slice)

Inside `ArenaApi.Core/Features/<Name>/`:

```
UseCases/<Action><Name>/
├── <Action><Name>Query.cs        # or Command
├── <Action><Name>Handler.cs      # returns Result<T, Error>
└── <Action><Name>Endpoint.cs     # minimal API mapping
Repositories/I<Name>sRepository.cs
Repositories/<Name>sRepository.cs # implementation in Infrastructure.Postgres
Domain/                           # feature-local types if needed
```

Endpoints are aggregated in `ArenaApi.Web` via a future `MapArenaEndpoints()`
extension method that walks Core feature endpoints. Until that exists,
`Program.cs` calls each `Map*Endpoints` directly.

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

- **Default schema:** `arena`. Set in `ArenaDbContext.OnModelCreating`.
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
- Generate a new migration:

  ```bash
  dotnet ef migrations add <Name> \
    --project backend/ArenaApi/src/ArenaApi.Infrastructure.Postgres \
    --startup-project backend/ArenaApi/src/ArenaApi.Web
  ```

## Banned APIs

Enforced by `Microsoft.CodeAnalysis.BannedApiAnalyzers` via
`backend/BannedSymbols.txt`. Adding a new banned symbol is a deliberate
decision — discuss before adding.

- `Guid.NewGuid()` → use `Guid.CreateVersion7()`
- `Thread.Sleep(...)` → use `Task.Delay(...)`
- `throw new Exception(...)` → use a specific type or `Result<T, Error>`
- `Console.Write*` → use `ILogger`

## Connection strings

The key for the primary database is `Database`. Reference it via the
constant `ArenaApi.Core.ConnectionStringNames.Database` — never the
string literal.

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
