# Phase 1.0 Module Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the backend from the single-`ArenaApi.Core` layout (one csproj holds every module's Domain/Features/Infrastructure with NetArchTest-policed boundaries) to the new **Clean-Architecture-per-module** layout where each module owns four csproj projects (`Contracts / Domain / Core / Infrastructure.Postgres`) and module isolation is enforced by the compiler via the ProjectReference graph. Add infrastructure abstractions — `IRepository<TAggregate>` (defined per-aggregate in the owning module's `Domain`), `ITransactionManager` (one impl per module wrapping its `DbContext.SaveChangesAsync`), `IValidator<T>` (sync, `Result<Unit,Error>`-returning), and `IEndpoint` (auto-discovered by reflection via Scrutor) — so handlers depend on interfaces, not concrete DbContexts, and endpoints are wired by convention rather than by hand-rolled `Map<Module>Endpoints` calls.

**Architecture:**
- **Per-module csproj quadruple.** For each module `<M>`:
  - `ArenaApi.Modules.<M>.Contracts` — pure-POCO surface (reader interface, view records, integration events, HTTP request/response DTOs). References `ArenaApi.SharedKernel` only.
  - `ArenaApi.Modules.<M>.Domain` — aggregates, value objects, domain events, repository interfaces (`I<Aggregate>Repository`). References `ArenaApi.SharedKernel` + own `Contracts`.
  - `ArenaApi.Modules.<M>.Core` — handlers, commands, queries, validators. References `ArenaApi.SharedKernel` + own `Domain` + own `Contracts` + every other module's `Contracts` (for cross-module reads).
  - `ArenaApi.Modules.<M>.Infrastructure.Postgres` — `DbContext`, EF configurations, migrations, repository implementations, `ITransactionManager` impl, `IEndpoint` impls, `Add<M>Module()` registration. References own `Core` + own `Domain` + own `Contracts` + Wolverine + EF Core.
- **`ArenaApi.SharedKernel`** is the only cross-cutting library — Errors, IClock, domain-event markers, `ITransactionManager`, `IValidator<T>`, `IEndpoint`, `IOutboxService`, `ConnectionStringNames`.
- **`ArenaApi.Web`** references every module's `Infrastructure.Postgres` (to call `Add<M>Module()`) and every module's `Contracts` (so `RequireAdminFilter` can resolve `ICurrentUser`). It hosts `Program.cs`, `Configuration/WolverineConfiguration.cs`, `Authorization/RequireAdminFilter.cs`, and `Endpoints/EndpointAutoDiscovery.cs` (the `app.MapEndpoints()` extension that resolves every registered `IEndpoint` from DI and calls `MapEndpoint(app)` on it).
- **`IRepository<TAggregate>` is per-aggregate-root, defined in the module's `Domain` project.** There is intentionally no generic `IRepository<T>` in SharedKernel — generic repositories leak DbSet semantics and force every aggregate to share the same query surface, which is the wrong abstraction for DDD. Each aggregate gets its own interface (e.g. `IPackageRepository`) with the exact operations its handlers need.
- **Handlers never see a `DbContext`.** They depend on `I<Aggregate>Repository` + `ITransactionManager` + `IValidator<TCommand>`. The transaction manager wraps `DbContext.SaveChangesAsync` so the handler ends with one `await tx.CommitAsync(ct)`.
- **Endpoint auto-discovery.** `Scrutor` (new dependency) scans every loaded `ArenaApi.Modules.*.Infrastructure.Postgres` assembly for `IEndpoint` implementations and registers them as singletons. `app.MapEndpoints()` resolves all of them and calls `MapEndpoint(app)`. The legacy `MapContentEndpoints` aggregator is deleted.
- **Compiler-enforced isolation.** `Modules.Progress.Infrastructure.Postgres` cannot reference `Modules.Content.Domain` because there's no ProjectReference and the types are in a different assembly. The NetArchTest suite shrinks to one regression sanity test ("no `Modules.*` project references another `Modules.*`'s Domain or Infrastructure.Postgres") because everything else is enforced at build time.

**Tech Stack:** .NET 10 (existing), Wolverine 5.x + RabbitMQ + Postgres outbox (existing), EF Core 10 + Npgsql 10 (existing), xUnit + Testcontainers (existing). One new package: `Scrutor` (for assembly scanning / endpoint auto-discovery).

**Conventions used throughout:**
- All entity primary keys: `Guid.CreateVersion7()`. `Guid.NewGuid()` is banned.
- All HTTP API URLs end with `/` (nginx 301-redirects otherwise).
- Handlers return `Result<T, Error>`. No throwing for business outcomes.
- Aggregates that are referenced across projects in the same module must be `public sealed` (not `internal`) — `internal` is per-assembly, and `Modules.Content.Infrastructure.Postgres` is a different assembly from `Modules.Content.Domain`.
- Repository implementations live in `Infrastructure.Postgres/Persistence/`. They take the module's `DbContext` and the module's outbox service in their constructor.
- Each module's `Add<M>Module(IServiceCollection, IConfiguration)` extension lives in its `Infrastructure.Postgres` project and registers DbContext + repositories + transaction manager + outbox service + handlers + validators. `IEndpoint` implementations are picked up automatically by Scrutor and need no per-module registration.
- Each commit is small and self-contained. Build + tests at marked checkpoints.

**Worktree:** This plan executes in the existing worktree at `/Users/dev/code/sharp.arena/.claude/worktrees/phase-1-1-content-catalog` (branch `worktree-phase-1-1-content-catalog`). Tasks 1-2 of Phase 1.1 (`a31edab` — `IsAdmin` on `ICurrentUser`; `aa16e8b` — `RequireAdminFilter` + admin client helpers) are already on this branch and stay in place. Phase 1.1 itself (Topics / ContentTask / Collections / seeders / public + admin endpoints — the meat of `2026-05-24-phase-1-1-content-catalog-backend.md`) is **not started**; it will be rewritten on top of this restructure after this plan lands.

**Out-of-scope (explicit):**
- Anything from Phase 1.1's Content catalog (`Topic`, `ContentTask`, `Collection`, asset/test rows, public/admin endpoints, seeder). Those land *after* this restructure, on top of the new layout.
- Runner / execution business logic.
- Frontend.
- Anti-abuse, observability, OTel.
- Real authorization beyond the existing `RequireAdminFilter`.

---

## File Structure

### New projects (created)

```
backend/ArenaApi/src/
├── ArenaApi.SharedKernel/                                ARCHITECTURE-CRITICAL
│   ├── ArenaApi.SharedKernel.csproj
│   ├── ConnectionStringNames.cs                          (moved from ArenaApi.Core)
│   ├── Errors/
│   │   ├── Error.cs                                      (moved from ArenaApi.Core/Shared/Errors)
│   │   └── CommonErrors.cs
│   ├── Time/
│   │   ├── IClock.cs
│   │   └── SystemClock.cs
│   ├── Identifiers/
│   │   └── TimeOrderedGuidValueGenerator.cs
│   ├── DomainEvents/
│   │   ├── IDomainEvent.cs
│   │   └── IHasDomainEvents.cs
│   ├── Persistence/
│   │   ├── ITransactionManager.cs                        (NEW)
│   │   └── IOutboxService.cs                             (moved from ArenaApi.Core/Shared/Outbox)
│   ├── Validation/
│   │   └── IValidator.cs                                 (NEW)
│   └── Endpoints/
│       └── IEndpoint.cs                                  (NEW)
│
├── Modules/
│   ├── IdentityStub/
│   │   ├── ArenaApi.Modules.IdentityStub.Contracts/
│   │   │   ├── ArenaApi.Modules.IdentityStub.Contracts.csproj
│   │   │   └── ICurrentUser.cs                           (moved)
│   │   └── ArenaApi.Modules.IdentityStub.Infrastructure/
│   │       ├── ArenaApi.Modules.IdentityStub.Infrastructure.csproj
│   │       ├── IdentityStubOptions.cs                    (moved)
│   │       ├── StubCurrentUser.cs                        (moved)
│   │       └── IdentityStubModule.cs                     (moved + renamed extension target)
│   │
│   ├── Content/
│   │   ├── ArenaApi.Modules.Content.Contracts/
│   │   │   ├── ArenaApi.Modules.Content.Contracts.csproj
│   │   │   ├── IContentReader.cs                         (moved)
│   │   │   ├── PackageView.cs                            (moved)
│   │   │   ├── IntegrationEvents/
│   │   │   │   └── PackageCreated.cs                     (moved)
│   │   │   └── Http/
│   │   │       ├── CreatePackageRequest.cs               (moved from ArenaApi.Contracts/Content)
│   │   │       └── CreatePackageResponse.cs
│   │   ├── ArenaApi.Modules.Content.Domain/
│   │   │   ├── ArenaApi.Modules.Content.Domain.csproj
│   │   │   ├── Package.cs                                (moved + public)
│   │   │   ├── DomainEvents/
│   │   │   │   └── PackageCreatedDomainEvent.cs          (moved)
│   │   │   └── Repositories/
│   │   │       └── IPackageRepository.cs                 (NEW)
│   │   ├── ArenaApi.Modules.Content.Core/
│   │   │   ├── ArenaApi.Modules.Content.Core.csproj
│   │   │   └── Features/
│   │   │       └── CreatePackage/
│   │   │           ├── CreatePackageCommand.cs           (moved)
│   │   │           ├── CreatePackageCommandValidator.cs  (NEW)
│   │   │           └── CreatePackageHandler.cs           (REFACTORED: IPackageRepository + ITransactionManager + IValidator)
│   │   └── ArenaApi.Modules.Content.Infrastructure.Postgres/
│   │       ├── ArenaApi.Modules.Content.Infrastructure.Postgres.csproj
│   │       ├── ContentDbContext.cs                       (moved)
│   │       ├── ContentDbContextDesignTimeFactory.cs      (moved + new namespace)
│   │       ├── Configurations/
│   │       │   └── PackageConfiguration.cs               (moved)
│   │       ├── Migrations/                               (moved as-is, namespace updated)
│   │       ├── Persistence/
│   │       │   ├── PackageRepository.cs                  (NEW: IPackageRepository impl)
│   │       │   └── ContentTransactionManager.cs          (NEW: ITransactionManager over ContentDbContext)
│   │       ├── ContentReader.cs                          (moved)
│   │       ├── ContentOutboxService.cs                   (moved)
│   │       ├── Endpoints/
│   │       │   └── CreatePackageEndpoint.cs              (NEW: IEndpoint impl — replaces extension-method MapCreatePackage)
│   │       └── ContentModule.cs                          (moved + renamed: AddContentModule lives here, no MapContentEndpoints)
│   │
│   ├── Execution/
│   │   ├── ArenaApi.Modules.Execution.Contracts/
│   │   │   └── ArenaApi.Modules.Execution.Contracts.csproj   (empty placeholder; only an AssemblyMarker.cs)
│   │   └── ArenaApi.Modules.Execution.Infrastructure.Postgres/
│   │       ├── ArenaApi.Modules.Execution.Infrastructure.Postgres.csproj
│   │       ├── ExecutionDbContext.cs                     (moved)
│   │       ├── ExecutionDbContextDesignTimeFactory.cs    (moved)
│   │       ├── ExecutionOutboxService.cs                 (moved)
│   │       └── ExecutionModule.cs                        (moved)
│   │
│   └── Progress/
│       ├── ArenaApi.Modules.Progress.Contracts/
│       │   └── ArenaApi.Modules.Progress.Contracts.csproj   (empty placeholder; only an AssemblyMarker.cs)
│       └── ArenaApi.Modules.Progress.Infrastructure.Postgres/
│           ├── ArenaApi.Modules.Progress.Infrastructure.Postgres.csproj
│           ├── ProgressDbContext.cs                      (moved)
│           ├── ProgressDbContextDesignTimeFactory.cs     (moved)
│           ├── ProgressOutboxService.cs                  (moved)
│           ├── EventHandlers/
│           │   └── PackageCreatedHandler.cs              (moved; consumes Content.Contracts.IntegrationEvents.PackageCreated)
│           └── ProgressModule.cs                         (moved)
│
└── ArenaApi.Web/                                         (existing; ProjectReferences + Program.cs rewritten)
    ├── ArenaApi.Web.csproj                               (rewritten ProjectReferences)
    ├── Program.cs                                        (rewritten: Add<M>Module + Scrutor + app.MapEndpoints)
    ├── Configuration/
    │   └── WolverineConfiguration.cs                     (updated: Discovery.IncludeAssembly for each new assembly)
    ├── Authorization/
    │   └── RequireAdminFilter.cs                         (namespace ref updated)
    ├── Endpoints/
    │   └── EndpointAutoDiscovery.cs                      (NEW: MapEndpoints() extension)
    ├── Features/Health/
    │   ├── HealthResponse.cs                             (moved from ArenaApi.Core)
    │   └── HealthEndpoint.cs                             (rewritten as IEndpoint)
    ├── GlobalUsings.cs                                   (unchanged)
    └── appsettings*.json                                 (unchanged)
```

### Deleted projects (after the moves land)

- `backend/ArenaApi/src/ArenaApi.Core/`            — every file moved out
- `backend/ArenaApi/src/ArenaApi.Contracts/`       — content moved to `Modules.Content.Contracts/Http/`
- `backend/ArenaApi/src/ArenaApi.Infrastructure/`  — empty shell project, never carried code

### Tests (project structure unchanged; references + namespaces updated)

- `backend/ArenaApi/tests/ArenaApi.UnitTests/`     — ProjectReferences point to each new module + SharedKernel. `Architecture/ModuleBoundariesTests.cs` slimmed to one regression test.
- `backend/ArenaApi/tests/ArenaApi.IntegrationTests/` — ProjectReferences add module Infrastructure.Postgres projects so `IntegrationTestsWebFactory` can resolve `ContentDbContext`. Test code namespace updates only.

### Solution file

- `backend/arena.slnx` — adds 11 new projects (1 SharedKernel + 9 module csprojs + Web stays + 2 test stays), removes 3 (Core, Contracts, Infrastructure).
- `backend/ArenaApi.sln` — does **not** exist. Confirmed by `ls backend/*.sln`. Only `.slnx` is in use. No dual-format work needed.

### Docs

- `backend/ArenaApi/CLAUDE.md` — full rewrite describing the new layout.

---

## Conventions used in tasks below

- Each task lists **Files** (Create / Modify / Delete / Move) and a series of `- [ ]` steps.
- For **pure file moves** (mechanical relocation with namespace renames) the step lists the move, the namespace change, and the verification — no separate "write failing test first" dance. The failing-test discipline is reserved for new abstractions (`ITransactionManager`, `IValidator<T>`, `IEndpoint` auto-discovery) where behavior is non-trivial.
- New code blocks are shown in **full**, not as diff hints. csproj files are reproduced complete because that's the most error-prone part of this restructure.
- `dotnet sln` does not operate on `.slnx`. Use `dotnet sln backend/arena.slnx add <path>` — the newer CLI handles both formats since .NET 9.0.200, and .NET 10 supports it natively.
- Build/run commands assume PWD = `/Users/dev/code/sharp.arena` unless stated.
- After each task with new code, **commit** with a Conventional Commits message scoped to the area.

---

## Pre-flight: verify the starting state

- [ ] **Step 1: Confirm working tree is clean and on the expected branch.**

```bash
git status
git rev-parse --abbrev-ref HEAD
git log --oneline -5
```

Expected:
- `nothing to commit, working tree clean`
- branch `worktree-phase-1-1-content-catalog`
- last commits include `aa16e8b feat(web): RequireAdminFilter and admin client helpers` and `a31edab feat(identity): add IsAdmin flag to ICurrentUser and IdentityStub`.

- [ ] **Step 2: Confirm the current build passes.**

```bash
dotnet build backend/arena.slnx -nologo
```

Expected: `Build succeeded` with 0 errors. Warnings about `RS0030` (banned `Guid.NewGuid()` in test fixtures) are not present because the analyzer is suppressed in test projects via `Directory.Build.props`.

- [ ] **Step 3: Confirm no `.sln` file exists (only `.slnx`).**

```bash
ls backend/*.sln 2>&1
```

Expected: `ls: backend/*.sln: No such file or directory`. The plan assumes `.slnx` only. If a `.sln` appears later, mirror the changes there too.

- [ ] **Step 4: Note baseline test counts for later comparison.**

```bash
dotnet test backend/arena.slnx --no-restore --nologo --logger "console;verbosity=minimal" 2>&1 | tail -20
```

Record the pass/fail counts somewhere (commit message scratch, scratch file, memory). The same counts must come back green after the restructure.

---

## Task 1: Create `ArenaApi.SharedKernel` project — primitives + new abstractions

**Goal:** Stand up the cross-cutting csproj. Move the existing `Shared/` primitives out of `ArenaApi.Core` and introduce the three new infra abstractions (`ITransactionManager`, `IValidator<T>`, `IEndpoint`). `IRepository<T>` is intentionally *not* added — see Task 1 README note below; aggregate-specific interfaces live in each module's `Domain` project.

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/ArenaApi.SharedKernel.csproj`
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/ConnectionStringNames.cs` (moved)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/Errors/Error.cs` (moved)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/Errors/CommonErrors.cs` (moved)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/Time/IClock.cs` (moved)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/Time/SystemClock.cs` (moved + made `public`)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/Identifiers/TimeOrderedGuidValueGenerator.cs` (moved)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/DomainEvents/IDomainEvent.cs` (moved)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/DomainEvents/IHasDomainEvents.cs` (moved)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/Persistence/IOutboxService.cs` (moved)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/Persistence/ITransactionManager.cs` (**NEW**)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/Validation/IValidator.cs` (**NEW**)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/Endpoints/IEndpoint.cs` (**NEW**)
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/GlobalUsings.cs`

- [ ] **Step 1: Create the csproj.**

`backend/ArenaApi/src/ArenaApi.SharedKernel/ArenaApi.SharedKernel.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.SharedKernel</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="CSharpFunctionalExtensions" />
    <PackageReference Include="Microsoft.EntityFrameworkCore" />
  </ItemGroup>
</Project>
```

EF Core is pulled in only because `TimeOrderedGuidValueGenerator` derives from `ValueGenerator<Guid>`. That's the only EF Core type SharedKernel touches; we accept the dependency rather than fork the generator. Wolverine is *not* referenced here — `IOutboxService` is a pure interface; implementations in each module's `Infrastructure.Postgres` carry the Wolverine dependency.

- [ ] **Step 2: `GlobalUsings.cs` for SharedKernel.**

`backend/ArenaApi/src/ArenaApi.SharedKernel/GlobalUsings.cs`:

```csharp
global using CSharpFunctionalExtensions;
```

- [ ] **Step 3: Move `ConnectionStringNames.cs` (namespace change).**

`backend/ArenaApi/src/ArenaApi.SharedKernel/ConnectionStringNames.cs`:

```csharp
namespace ArenaApi.SharedKernel;

public static class ConnectionStringNames
{
    public const string Database = "Database";
    public const string RabbitMq = "RabbitMq";
    public const string Redis = "Redis";
}
```

- [ ] **Step 4: Move `Errors/Error.cs` and `Errors/CommonErrors.cs`.**

`backend/ArenaApi/src/ArenaApi.SharedKernel/Errors/Error.cs`:

```csharp
namespace ArenaApi.SharedKernel.Errors;

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

`backend/ArenaApi/src/ArenaApi.SharedKernel/Errors/CommonErrors.cs`:

```csharp
namespace ArenaApi.SharedKernel.Errors;

public static class CommonErrors
{
    public static readonly Error Unexpected = new("Unexpected", "An unexpected error occurred.");
}
```

- [ ] **Step 5: Move `Time/IClock.cs` and `Time/SystemClock.cs`.** `SystemClock` becomes `public` (it must be visible to Web's DI registration in any module, and it's referenced from Content.Infrastructure.Postgres `AddContentModule`).

`backend/ArenaApi/src/ArenaApi.SharedKernel/Time/IClock.cs`:

```csharp
namespace ArenaApi.SharedKernel.Time;

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
```

`backend/ArenaApi/src/ArenaApi.SharedKernel/Time/SystemClock.cs`:

```csharp
namespace ArenaApi.SharedKernel.Time;

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
```

- [ ] **Step 6: Move `Identifiers/TimeOrderedGuidValueGenerator.cs`.**

`backend/ArenaApi/src/ArenaApi.SharedKernel/Identifiers/TimeOrderedGuidValueGenerator.cs`:

```csharp
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.ValueGeneration;

namespace ArenaApi.SharedKernel.Identifiers;

public sealed class TimeOrderedGuidValueGenerator : ValueGenerator<Guid>
{
    public override bool GeneratesTemporaryValues => false;

    public override Guid Next(EntityEntry entry) => Guid.CreateVersion7();
}
```

- [ ] **Step 7: Move `DomainEvents/IDomainEvent.cs` and `DomainEvents/IHasDomainEvents.cs`.**

`backend/ArenaApi/src/ArenaApi.SharedKernel/DomainEvents/IDomainEvent.cs`:

```csharp
namespace ArenaApi.SharedKernel.DomainEvents;

/// Marker for events raised inside an aggregate and dispatched within the
/// same DB transaction. Domain events never cross module boundaries — use
/// Wolverine integration events for that.
public interface IDomainEvent;
```

`backend/ArenaApi/src/ArenaApi.SharedKernel/DomainEvents/IHasDomainEvents.cs`:

```csharp
namespace ArenaApi.SharedKernel.DomainEvents;

public interface IHasDomainEvents
{
    IReadOnlyList<IDomainEvent> DomainEvents { get; }
    void ClearDomainEvents();
}
```

- [ ] **Step 8: Move `Outbox/IOutboxService.cs` into the new `Persistence/` folder.**

The folder rename groups it with `ITransactionManager`. Both are persistence concerns; "Outbox" was an outlier folder.

`backend/ArenaApi/src/ArenaApi.SharedKernel/Persistence/IOutboxService.cs`:

```csharp
namespace ArenaApi.SharedKernel.Persistence;

/// Per-module facade over Wolverine's IDbContextOutbox<TDbContext>. Modules
/// inject this rather than depending on Wolverine types directly, so that
/// the module's DbContext type stays an Infrastructure-only detail.
///
/// Implementations live in each module's Infrastructure.Postgres project
/// and resolve the correct IDbContextOutbox<TDbContext> via DI.
public interface IOutboxService
{
    Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class;
}
```

- [ ] **Step 9: NEW — `Persistence/ITransactionManager.cs`.**

Each module's `Infrastructure.Postgres` ships one concrete implementation that wraps its own `DbContext.SaveChangesAsync`. Handlers depend on the interface only.

`backend/ArenaApi/src/ArenaApi.SharedKernel/Persistence/ITransactionManager.cs`:

```csharp
namespace ArenaApi.SharedKernel.Persistence;

/// Abstracts "commit the unit of work" away from the concrete DbContext.
/// One implementation per module: ContentTransactionManager wraps
/// ContentDbContext.SaveChangesAsync, ExecutionTransactionManager wraps
/// ExecutionDbContext.SaveChangesAsync, etc.
///
/// Handlers depend on this rather than the DbContext so they cannot
/// accidentally peek at DbSets or change-tracker state from another aggregate.
/// They use I<Aggregate>Repository to mutate state, then call
/// tx.CommitAsync(ct) once at the end.
public interface ITransactionManager
{
    Task<int> CommitAsync(CancellationToken cancellationToken = default);
}
```

The `int` return mirrors `DbContext.SaveChangesAsync`'s row count for the rare caller that cares; handlers usually ignore it. Returning `Result<Unit, Error>` was considered but rejected — a SaveChanges failure is a true exception (constraint violation, transient DB error), not a business outcome.

- [ ] **Step 10: NEW — `Validation/IValidator.cs`.**

Sync, `Result<Unit, Error>`-returning. Lives in `SharedKernel/Validation/`. One validator per command/query, co-located with its target in the module's `Features/` folder. The codebase already references `FluentValidation` (in `Directory.Packages.props`) but that's an async, exception-throwing abstraction that doesn't compose with `Result<T, Error>`. We define our own minimal interface and keep FluentValidation available for any module that wants its richer rule API as a backing implementation — the validator class just exposes the `Result`-shaped surface.

`backend/ArenaApi/src/ArenaApi.SharedKernel/Validation/IValidator.cs`:

```csharp
using ArenaApi.SharedKernel.Errors;

namespace ArenaApi.SharedKernel.Validation;

/// Synchronous validator that returns Result instead of throwing.
/// Handlers call validator.Validate(command) before mutating state.
///
/// Implementations are registered per command/query in the owning module's
/// Add<Module>Module(): services.AddSingleton<IValidator<CreatePackageCommand>, CreatePackageCommandValidator>().
public interface IValidator<in T>
{
    Result<Unit, Error> Validate(T instance);
}
```

The `Unit` type comes from `CSharpFunctionalExtensions` (already globally used; brought in via `GlobalUsings.cs`). `in T` makes the interface contravariant so a validator for `CreatePackageCommand` is assignable to `IValidator<CreatePackageCommand>` directly.

- [ ] **Step 11: NEW — `Endpoints/IEndpoint.cs`.**

`backend/ArenaApi/src/ArenaApi.SharedKernel/Endpoints/IEndpoint.cs`:

```csharp
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.SharedKernel.Endpoints;

/// Contract for an auto-discovered minimal-API endpoint.
///
/// Implementations are registered automatically via Scrutor scanning
/// every Modules.*.Infrastructure.Postgres assembly. The Web host's
/// app.MapEndpoints() extension resolves every IEndpoint from DI and
/// calls MapEndpoint(app) on each.
///
/// Implementations are typically sealed classes that take their
/// dependencies (handlers, current-user, etc.) via constructor injection
/// or resolve them from RouteHandlerBuilder delegates per request.
public interface IEndpoint
{
    void MapEndpoint(IEndpointRouteBuilder app);
}
```

The contract is deliberately tiny — a single `void` method. Anything more (e.g. forcing each endpoint to declare its HTTP verb and route as properties) would couple `IEndpoint` to minimal-API specifics and complicate testing.

- [ ] **Step 12: Build SharedKernel in isolation.**

```bash
dotnet build backend/ArenaApi/src/ArenaApi.SharedKernel -nologo
```

Expected: `Build succeeded` with 0 errors and 0 warnings. The project is not yet referenced from anywhere else, so this is a pure standalone compile.

- [ ] **Step 13: Add SharedKernel to the solution.**

```bash
dotnet sln backend/arena.slnx add backend/ArenaApi/src/ArenaApi.SharedKernel/ArenaApi.SharedKernel.csproj --solution-folder ArenaApi
```

Verify:

```bash
grep ArenaApi.SharedKernel backend/arena.slnx
```

Expected: one line matching `<Project Path="ArenaApi/src/ArenaApi.SharedKernel/ArenaApi.SharedKernel.csproj" />`.

- [ ] **Step 14: Commit.**

```bash
git add backend/ArenaApi/src/ArenaApi.SharedKernel backend/arena.slnx
git commit -m "feat(sharedkernel): scaffold SharedKernel project + new persistence/validation/endpoint abstractions"
```

> NOTE — the old files under `ArenaApi.Core/Shared/` are still on disk; deletion happens in Task 17 once every reference has migrated. Keeping both around temporarily means the build stays green while the per-module migration progresses; the duplicate definitions are in different namespaces so there's no symbol clash.

---

## Task 2: Add Scrutor + write `EndpointAutoDiscovery` extension (TDD)

**Goal:** Land the reflection-based endpoint registration *before* any module produces an `IEndpoint`. The discovery extension is small but its semantics — "scan a list of assemblies for `IEndpoint`, register each as a singleton, then resolve and map them all on the app" — are the foundation everything else relies on. A focused unit test pins the contract.

**Files:**
- Modify: `backend/Directory.Packages.props` — add `Scrutor` 5.x PackageVersion.
- Modify: `backend/ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj` — add Scrutor + SharedKernel reference.
- Create: `backend/ArenaApi/src/ArenaApi.Web/Endpoints/EndpointAutoDiscovery.cs` (**NEW**).
- Create: `backend/ArenaApi/tests/ArenaApi.UnitTests/Endpoints/EndpointAutoDiscoveryTests.cs` (**NEW**).
- Modify: `backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj` — add Web ProjectReference + Microsoft.AspNetCore.App framework reference (already transitively present via the existing Core ref; will be re-confirmed once Core is gone).

- [ ] **Step 1: Add Scrutor to `Directory.Packages.props`.**

In `backend/Directory.Packages.props`, after the `WolverineFx.EntityFrameworkCore` line, add:

```xml
    <!-- Assembly scanning / endpoint auto-discovery -->
    <PackageVersion Include="Scrutor" Version="5.0.2" />
```

Verify:

```bash
grep -n Scrutor backend/Directory.Packages.props
```

Expected: one match.

- [ ] **Step 2: Reference Scrutor + SharedKernel in `ArenaApi.Web.csproj`.**

Replace the entire `backend/ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj` with:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" />
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

    <PackageReference Include="Scrutor" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <!-- ArenaApi.Core / ArenaApi.Infrastructure remain ref'd here for now;
         they get removed in Task 11 once every module is migrated. -->
    <ProjectReference Include="..\ArenaApi.Core\ArenaApi.Core.csproj" />
    <ProjectReference Include="..\ArenaApi.Infrastructure\ArenaApi.Infrastructure.csproj" />
  </ItemGroup>
</Project>
```

Build:

```bash
dotnet build backend/ArenaApi/src/ArenaApi.Web -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 3: Write the failing test first.**

`backend/ArenaApi/tests/ArenaApi.UnitTests/Endpoints/EndpointAutoDiscoveryTests.cs`:

```csharp
using System.Reflection;
using ArenaApi.SharedKernel.Endpoints;
using ArenaApi.Web.Endpoints;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ArenaApi.UnitTests.Endpoints;

public sealed class EndpointAutoDiscoveryTests
{
    [Fact]
    public void AddEndpointsFromAssemblies_registers_every_IEndpoint_as_singleton()
    {
        ServiceCollection services = new();

        services.AddEndpointsFromAssemblies(typeof(EndpointAutoDiscoveryTests).Assembly);

        ServiceProvider provider = services.BuildServiceProvider();
        IEndpoint[] resolved = provider.GetServices<IEndpoint>().ToArray();

        Assert.Contains(resolved, e => e is FakeEndpoint);
        Assert.Contains(resolved, e => e is AnotherFakeEndpoint);

        // Singleton lifetime — resolving twice returns the same instance.
        IEndpoint[] secondResolution = provider.GetServices<IEndpoint>().ToArray();
        FakeEndpoint first = (FakeEndpoint)resolved.Single(e => e is FakeEndpoint);
        FakeEndpoint second = (FakeEndpoint)secondResolution.Single(e => e is FakeEndpoint);
        Assert.Same(first, second);
    }

    [Fact]
    public void MapEndpoints_calls_MapEndpoint_on_every_registered_IEndpoint()
    {
        WebApplicationBuilder builder = WebApplication.CreateBuilder();
        builder.Services.AddEndpointsFromAssemblies(typeof(EndpointAutoDiscoveryTests).Assembly);

        WebApplication app = builder.Build();
        app.MapEndpoints();

        // Both fakes mount one route apiece. Walking the EndpointDataSource
        // is the cheapest way to assert they were invoked.
        EndpointDataSource ds = app.Services.GetRequiredService<EndpointDataSource>();
        IReadOnlyList<string?> patterns = ds.Endpoints
            .OfType<RouteEndpoint>()
            .Select(e => e.RoutePattern.RawText)
            .ToList();

        Assert.Contains("/__fake/one", patterns);
        Assert.Contains("/__fake/two", patterns);
    }

    private sealed class FakeEndpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app)
            => app.MapGet("/__fake/one", () => "one");
    }

    private sealed class AnotherFakeEndpoint : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app)
            => app.MapGet("/__fake/two", () => "two");
    }
}
```

The two fakes are nested types so they're picked up by the scanner via `typeof(EndpointAutoDiscoveryTests).Assembly`.

- [ ] **Step 4: Update the test project to reference Web + SharedKernel.**

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
    <!-- During the migration we ref both the legacy Core (for StubCurrentUserTests
         and ModuleBoundariesTests) and the new SharedKernel + Web (for the new
         endpoint-discovery test). The Core ref drops in Task 11. -->
    <ProjectReference Include="..\..\src\ArenaApi.Core\ArenaApi.Core.csproj" />
    <ProjectReference Include="..\..\src\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\..\src\ArenaApi.Web\ArenaApi.Web.csproj" />
  </ItemGroup>
</Project>
```

Run the test — it must fail because `EndpointAutoDiscovery` doesn't exist yet:

```bash
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~EndpointAutoDiscoveryTests" --nologo 2>&1 | tail -10
```

Expected: compile error — `'ArenaApi.Web.Endpoints' does not exist` or `'AddEndpointsFromAssemblies' is not defined`.

- [ ] **Step 5: Implement `EndpointAutoDiscovery`.**

`backend/ArenaApi/src/ArenaApi.Web/Endpoints/EndpointAutoDiscovery.cs`:

```csharp
using System.Reflection;
using ArenaApi.SharedKernel.Endpoints;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Web.Endpoints;

/// Scrutor-backed scanner + Map helper for IEndpoint implementations.
/// The scanner is called once per module-Infrastructure.Postgres assembly
/// inside Program.cs; MapEndpoints() is called once on the app to mount
/// every discovered endpoint.
public static class EndpointAutoDiscovery
{
    /// Registers every IEndpoint implementation found in the supplied
    /// assemblies as a singleton. Order of assemblies doesn't matter —
    /// each IEndpoint gets its own DI registration.
    public static IServiceCollection AddEndpointsFromAssemblies(
        this IServiceCollection services,
        params Assembly[] assemblies)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(assemblies);

        services.Scan(scan => scan
            .FromAssemblies(assemblies)
            .AddClasses(c => c.AssignableTo<IEndpoint>(), publicOnly: false)
            .AsImplementedInterfaces()
            .WithSingletonLifetime());

        return services;
    }

    /// Resolves every registered IEndpoint and calls MapEndpoint(app) on each.
    /// Call once on the built WebApplication, after AddEndpointsFromAssemblies
    /// has been invoked for every module Infrastructure.Postgres assembly.
    public static IEndpointRouteBuilder MapEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        IEnumerable<IEndpoint> endpoints = app.ServiceProvider.GetServices<IEndpoint>();
        foreach (IEndpoint endpoint in endpoints)
        {
            endpoint.MapEndpoint(app);
        }

        return app;
    }
}
```

`publicOnly: false` matters because the fake test endpoints are nested private classes; production `IEndpoint` impls will be `public sealed`, but the scanner has to handle both. `AsImplementedInterfaces()` registers the type against every interface it implements — for `FakeEndpoint : IEndpoint`, that's just `IEndpoint`, which is what we want.

- [ ] **Step 6: Re-run the test — must pass.**

```bash
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~EndpointAutoDiscoveryTests" --nologo
```

Expected: `Passed!  - Failed: 0, Passed: 2, Skipped: 0`.

- [ ] **Step 7: Confirm the full test suite still passes.**

```bash
dotnet test backend/arena.slnx --nologo --logger "console;verbosity=minimal" 2>&1 | tail -10
```

Expected: baseline pass count + 2 new (one per new test). No regressions.

- [ ] **Step 8: Commit.**

```bash
git add backend/Directory.Packages.props \
        backend/ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj \
        backend/ArenaApi/src/ArenaApi.Web/Endpoints/EndpointAutoDiscovery.cs \
        backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj \
        backend/ArenaApi/tests/ArenaApi.UnitTests/Endpoints/EndpointAutoDiscoveryTests.cs
git commit -m "feat(web): add Scrutor + EndpointAutoDiscovery (IEndpoint registration + MapEndpoints)"
```

---

## Task 3: Split `IdentityStub` into Contracts + Infrastructure csprojs

**Goal:** Smallest live module — easy to verify the new pattern end-to-end. `Contracts` holds `ICurrentUser` (already lived under `Public/`). `Infrastructure` holds `IdentityStubOptions`, `StubCurrentUser`, and the `AddIdentityStubModule` extension. The existing unit test in `StubCurrentUserTests` keeps working with a one-line namespace update.

**Files:**
- Create: `backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Contracts/ArenaApi.Modules.IdentityStub.Contracts.csproj`
- Create: `backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Contracts/ICurrentUser.cs` (moved)
- Create: `backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/ArenaApi.Modules.IdentityStub.Infrastructure.csproj`
- Create: `backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/IdentityStubOptions.cs` (moved)
- Create: `backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/StubCurrentUser.cs` (moved)
- Create: `backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/IdentityStubModule.cs` (moved)
- Modify: `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/IdentityStub/StubCurrentUserTests.cs` — namespace updates only.
- Modify: `backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj` — add ProjectReferences.
- Delete (later, in Task 17): `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/*` once everything points at the new projects.

- [ ] **Step 1: `Contracts` csproj.**

`backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Contracts/ArenaApi.Modules.IdentityStub.Contracts.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.Modules.IdentityStub.Contracts</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Move `ICurrentUser.cs`.**

`backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Contracts/ICurrentUser.cs`:

```csharp
namespace ArenaApi.Modules.IdentityStub.Contracts;

/// The only contract other modules see from IdentityStub. When real SSO
/// arrives, the implementation behind this interface swaps; consumers don't
/// change. Do not add anything else here unless every consumer truly needs it.
public interface ICurrentUser
{
    Guid UserId { get; }

    /// True when the current request is acting as an administrator. Backed
    /// today by IdentityStubOptions.IsAdmin (single-tenant local dev). When
    /// real SSO lands, this is driven by claims/roles instead.
    bool IsAdmin { get; }
}
```

- [ ] **Step 3: `Infrastructure` csproj.**

`backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/ArenaApi.Modules.IdentityStub.Infrastructure.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.Modules.IdentityStub.Infrastructure</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.Configuration.Abstractions" />
    <PackageReference Include="Microsoft.Extensions.Configuration.Binder" />
    <PackageReference Include="Microsoft.Extensions.Hosting" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\ArenaApi.Modules.IdentityStub.Contracts\ArenaApi.Modules.IdentityStub.Contracts.csproj" />
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
  </ItemGroup>
</Project>
```

`Microsoft.Extensions.Hosting` is pulled in for `IServiceCollection` (it transitively brings `DependencyInjection.Abstractions`). `Configuration.Binder` is what backs `.Bind(...)`.

- [ ] **Step 4: Move `IdentityStubOptions.cs`.**

`backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/IdentityStubOptions.cs`:

```csharp
namespace ArenaApi.Modules.IdentityStub.Infrastructure;

public sealed class IdentityStubOptions
{
    public const string SectionName = "IdentityStub";

    public Guid HardcodedUserId { get; init; }

    /// Single global admin flag. In local dev this is `true`; in production
    /// (when SSO doesn't exist yet) it stays `false`. Replaced by real role
    /// checks once SSO ships.
    public bool IsAdmin { get; init; }
}
```

- [ ] **Step 5: Move `StubCurrentUser.cs`.**

`backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/StubCurrentUser.cs`:

```csharp
using ArenaApi.Modules.IdentityStub.Contracts;
using Microsoft.Extensions.Options;

namespace ArenaApi.Modules.IdentityStub.Infrastructure;

internal sealed class StubCurrentUser(IOptions<IdentityStubOptions> options) : ICurrentUser
{
    public Guid UserId { get; } = options.Value.HardcodedUserId == Guid.Empty
        ? throw new InvalidOperationException(
            $"{nameof(IdentityStubOptions)}.{nameof(IdentityStubOptions.HardcodedUserId)} is not configured. " +
            "Set IdentityStub:HardcodedUserId in appsettings.")
        : options.Value.HardcodedUserId;

    public bool IsAdmin { get; } = options.Value.IsAdmin;
}
```

Class stays `internal sealed`. Tests reach it via `[InternalsVisibleTo("ArenaApi.UnitTests")]` (added in Step 9).

- [ ] **Step 6: Move `IdentityStubModule.cs`.**

`backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/IdentityStubModule.cs`:

```csharp
using ArenaApi.Modules.IdentityStub.Contracts;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Modules.IdentityStub.Infrastructure;

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

- [ ] **Step 7: Wire `[InternalsVisibleTo]` for tests.**

Add to the `Infrastructure` csproj (inside a new `<ItemGroup>`):

```xml
  <ItemGroup>
    <AssemblyAttribute Include="System.Runtime.CompilerServices.InternalsVisibleTo">
      <_Parameter1>ArenaApi.UnitTests</_Parameter1>
    </AssemblyAttribute>
  </ItemGroup>
```

- [ ] **Step 8: Build both new projects standalone.**

```bash
dotnet build backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Contracts -nologo
dotnet build backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure -nologo
```

Both must succeed.

- [ ] **Step 9: Add both projects to the solution.**

```bash
dotnet sln backend/arena.slnx add \
  backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Contracts/ArenaApi.Modules.IdentityStub.Contracts.csproj \
  backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/ArenaApi.Modules.IdentityStub.Infrastructure.csproj \
  --solution-folder ArenaApi/Modules/IdentityStub
```

- [ ] **Step 10: Update `StubCurrentUserTests` namespaces and references.**

Replace `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/IdentityStub/StubCurrentUserTests.cs` with:

```csharp
using ArenaApi.Modules.IdentityStub.Infrastructure;
using Microsoft.Extensions.Options;
using Xunit;

namespace ArenaApi.UnitTests.Modules.IdentityStub;

public sealed class StubCurrentUserTests
{
    private static readonly Guid SampleUserId = Guid.Parse("01970000-0000-7000-8000-000000000099");

    [Fact]
    public void UserId_is_taken_from_options()
    {
        StubCurrentUser sut = new(Options.Create(new IdentityStubOptions
        {
            HardcodedUserId = SampleUserId,
            IsAdmin = false,
        }));

        Assert.Equal(SampleUserId, sut.UserId);
    }

    [Fact]
    public void IsAdmin_is_false_by_default_when_options_default()
    {
        StubCurrentUser sut = new(Options.Create(new IdentityStubOptions
        {
            HardcodedUserId = SampleUserId,
        }));

        Assert.False(sut.IsAdmin);
    }

    [Fact]
    public void IsAdmin_is_true_when_configured_true()
    {
        StubCurrentUser sut = new(Options.Create(new IdentityStubOptions
        {
            HardcodedUserId = SampleUserId,
            IsAdmin = true,
        }));

        Assert.True(sut.IsAdmin);
    }

    [Fact]
    public void Throws_when_HardcodedUserId_empty()
    {
        Assert.Throws<InvalidOperationException>(() =>
            new StubCurrentUser(Options.Create(new IdentityStubOptions
            {
                HardcodedUserId = Guid.Empty,
                IsAdmin = true,
            })));
    }
}
```

The only change vs. the existing file is the `using` line at the top — `ArenaApi.Core.Modules.IdentityStub.{Infrastructure,...}` becomes `ArenaApi.Modules.IdentityStub.Infrastructure`.

- [ ] **Step 11: Add ProjectReferences in `ArenaApi.UnitTests.csproj`.**

In `backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj`, **inside the existing `<ItemGroup>` that holds `ProjectReference` items**, add:

```xml
    <ProjectReference Include="..\..\src\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Contracts\ArenaApi.Modules.IdentityStub.Contracts.csproj" />
    <ProjectReference Include="..\..\src\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Infrastructure\ArenaApi.Modules.IdentityStub.Infrastructure.csproj" />
```

- [ ] **Step 12: Build the test project and run the moved tests.**

```bash
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~StubCurrentUserTests" --nologo
```

Expected: `Passed: 4`.

> **About `Program.cs` and the legacy `ArenaApi.Core` IdentityStub registration:**
> the old `using ArenaApi.Core.Modules.IdentityStub;` in `Program.cs` still resolves because the legacy types are still present on disk. The Web ProjectReference to the new IdentityStub.Infrastructure isn't added until Task 11; until then the build picks the legacy `AddIdentityStubModule`. This is intentional — small, reversible steps. The legacy files are removed in Task 17.

- [ ] **Step 13: Full build.**

```bash
dotnet build backend/arena.slnx -nologo
```

Expected: `Build succeeded`. Some warnings (`CS0436` — type defined in multiple assemblies) may appear if both the legacy `ArenaApi.Core.Modules.IdentityStub.Public.ICurrentUser` and the new `ArenaApi.Modules.IdentityStub.Contracts.ICurrentUser` are in scope of `RequireAdminFilter`. They aren't — `RequireAdminFilter` still uses the legacy `using`. No warnings expected.

- [ ] **Step 14: Commit.**

```bash
git add backend/ArenaApi/src/Modules/IdentityStub/ \
        backend/arena.slnx \
        backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj \
        backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/IdentityStub/StubCurrentUserTests.cs
git commit -m "feat(identity): split IdentityStub into Contracts + Infrastructure csprojs"
```

---

## Task 4: Create `ArenaApi.Modules.Content.Contracts` project

**Goal:** Stand up the public surface of the Content module: reader interface, view records, integration events, and HTTP DTOs.

**Files:**
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/ArenaApi.Modules.Content.Contracts.csproj`
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/IContentReader.cs` (moved)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/PackageView.cs` (moved)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/IntegrationEvents/PackageCreated.cs` (moved)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/Http/CreatePackageRequest.cs` (moved from `ArenaApi.Contracts/Content`)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/Http/CreatePackageResponse.cs` (moved)

- [ ] **Step 1: csproj.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/ArenaApi.Modules.Content.Contracts.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.Modules.Content.Contracts</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Move `PackageView.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/PackageView.cs`:

```csharp
namespace ArenaApi.Modules.Content.Contracts;

/// Immutable cross-module projection of a Package. Anything other modules
/// need to know about a package goes here; the internal Domain.Package may
/// hold more fields, but those never leak across the boundary.
public sealed record PackageView(Guid Id, string Slug, string Title, DateTimeOffset CreatedAt);
```

- [ ] **Step 3: Move `IContentReader.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/IContentReader.cs`:

```csharp
namespace ArenaApi.Modules.Content.Contracts;

/// Sync read contract for other modules. Implementation lives in
/// ArenaApi.Modules.Content.Infrastructure.Postgres.ContentReader and
/// queries ContentDbContext.
public interface IContentReader
{
    Task<PackageView?> GetPackageAsync(Guid packageId, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 4: Move `IntegrationEvents/PackageCreated.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/IntegrationEvents/PackageCreated.cs`:

```csharp
namespace ArenaApi.Modules.Content.Contracts.IntegrationEvents;

/// Published via Wolverine + RabbitMQ when a Package row is committed.
/// Other modules subscribe by writing an `IWolverineHandler` method that
/// accepts this type.
public sealed record PackageCreated(Guid PackageId, string Slug, string Title, DateTimeOffset CreatedAt);
```

- [ ] **Step 5: Move HTTP DTOs from `ArenaApi.Contracts/Content/` into the new `Http/` folder.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/Http/CreatePackageRequest.cs`:

```csharp
namespace ArenaApi.Modules.Content.Contracts.Http;

public sealed record CreatePackageRequest(string Slug, string Title);
```

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/Http/CreatePackageResponse.cs`:

```csharp
namespace ArenaApi.Modules.Content.Contracts.Http;

public sealed record CreatePackageResponse(Guid Id, string Slug, string Title, DateTimeOffset CreatedAt);
```

- [ ] **Step 6: Build standalone.**

```bash
dotnet build backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 7: Add to solution.**

```bash
dotnet sln backend/arena.slnx add \
  backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts/ArenaApi.Modules.Content.Contracts.csproj \
  --solution-folder ArenaApi/Modules/Content
```

- [ ] **Step 8: Commit.**

```bash
git add backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Contracts backend/arena.slnx
git commit -m "feat(content): create Modules.Content.Contracts project (reader, view, events, HTTP DTOs)"
```

---

## Task 5: Create `ArenaApi.Modules.Content.Domain` — Package aggregate + IPackageRepository

**Goal:** Move the aggregate into its own csproj. Make it `public` (cross-project consumption) and add the per-aggregate repository interface that handlers will depend on.

**Files:**
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/ArenaApi.Modules.Content.Domain.csproj`
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/Package.cs` (moved + `public`)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/DomainEvents/PackageCreatedDomainEvent.cs` (moved + `public`)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/Repositories/IPackageRepository.cs` (**NEW**)

- [ ] **Step 1: csproj.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/ArenaApi.Modules.Content.Domain.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.Modules.Content.Domain</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="CSharpFunctionalExtensions" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Content.Contracts\ArenaApi.Modules.Content.Contracts.csproj" />
  </ItemGroup>
</Project>
```

`Contracts` is referenced so `IPackageRepository.cs` can return `PackageView` from the read path without forcing it to live in `Domain` — keeping it in `Contracts` lets every other module see the same projection without depending on `Domain`. (We don't actually return `PackageView` from the repo today; this is forward-leaning capacity.)

- [ ] **Step 2: Move `Package.cs` and mark it `public sealed`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/Package.cs`:

```csharp
using ArenaApi.Modules.Content.Domain.DomainEvents;
using ArenaApi.SharedKernel.DomainEvents;
using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Modules.Content.Domain;

public sealed class Package : IHasDomainEvents
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

The factory's validation stays — it's the last line of defense and runs even if the handler-side `IValidator` is bypassed. The new `IValidator<CreatePackageCommand>` (Task 6) is a *layer*, not a replacement.

- [ ] **Step 3: Move `DomainEvents/PackageCreatedDomainEvent.cs` and make it `public`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/DomainEvents/PackageCreatedDomainEvent.cs`:

```csharp
using ArenaApi.SharedKernel.DomainEvents;

namespace ArenaApi.Modules.Content.Domain.DomainEvents;

public sealed record PackageCreatedDomainEvent(Guid PackageId, string Slug) : IDomainEvent;
```

Crossed the `internal` -> `public` boundary for the same reason as `Package`: a `public sealed class Package` cannot expose private types via `_domainEvents.Add(new PackageCreatedDomainEvent(...))` if the event type is `internal` and the consumer is in a different assembly. It still doesn't cross module boundaries — only `Domain` and `Infrastructure.Postgres` of the *Content* module see it.

- [ ] **Step 4: NEW — `Repositories/IPackageRepository.cs`.**

This is the aggregate-specific repo. We deliberately do **not** define a generic `IRepository<T>` in SharedKernel: each aggregate has unique operations (e.g. `Package` has `ExistsBySlugAsync`, a future aggregate might have `FindByOwnerIdAsync`), and a one-size-fits-all surface either degenerates to `IQueryable<T>` (leaky) or balloons.

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/Repositories/IPackageRepository.cs`:

```csharp
namespace ArenaApi.Modules.Content.Domain.Repositories;

/// Persistence contract for the Package aggregate root.
///
/// Lives in Domain so handlers in Core can depend on it without seeing
/// the ContentDbContext that backs it. The EF Core implementation
/// (PackageRepository) is in ArenaApi.Modules.Content.Infrastructure.Postgres.
public interface IPackageRepository
{
    /// Adds a new package to the unit-of-work. The row is not written
    /// to the database until ITransactionManager.CommitAsync is called.
    Task AddAsync(Package package, CancellationToken cancellationToken = default);

    /// Returns true if a package with the given slug already exists.
    /// Used by handlers to enforce slug uniqueness before constructing
    /// the aggregate.
    Task<bool> ExistsBySlugAsync(string slug, CancellationToken cancellationToken = default);
}
```

Surface is tiny — only what `CreatePackageHandler` needs today. New methods get added as new features land; we don't speculate.

- [ ] **Step 5: Build standalone.**

```bash
dotnet build backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 6: Add to solution.**

```bash
dotnet sln backend/arena.slnx add \
  backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/ArenaApi.Modules.Content.Domain.csproj \
  --solution-folder ArenaApi/Modules/Content
```

- [ ] **Step 7: Commit.**

```bash
git add backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain backend/arena.slnx
git commit -m "feat(content): create Modules.Content.Domain project (Package aggregate + IPackageRepository)"
```

---

## Task 6: Create `ArenaApi.Modules.Content.Core` — refactored CreatePackage handler + validator

**Goal:** Move the use-case slice into its own csproj. Refactor `CreatePackageHandler` so it depends on `IPackageRepository + ITransactionManager + IValidator<CreatePackageCommand> + IOutboxService + IClock` instead of `ContentDbContext + ContentOutboxService + IClock`. Add a no-op-style validator that pre-checks slug/title (mirroring `Package.Create`'s validation as a defense-in-depth layer that the handler can run *before* the conflict check, so callers see validation errors before slug-conflict errors).

**Files:**
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Core/ArenaApi.Modules.Content.Core.csproj`
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Core/Features/CreatePackage/CreatePackageCommand.cs` (moved)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Core/Features/CreatePackage/CreatePackageCommandValidator.cs` (**NEW**)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Core/Features/CreatePackage/CreatePackageHandler.cs` (REFACTORED)

- [ ] **Step 1: csproj.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Core/ArenaApi.Modules.Content.Core.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.Modules.Content.Core</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="CSharpFunctionalExtensions" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Content.Contracts\ArenaApi.Modules.Content.Contracts.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Content.Domain\ArenaApi.Modules.Content.Domain.csproj" />
    <!-- Cross-module dependencies live here. Today only IdentityStub is read
         cross-module; add other Modules.<X>.Contracts as features need them. -->
    <ProjectReference Include="..\..\IdentityStub\ArenaApi.Modules.IdentityStub.Contracts\ArenaApi.Modules.IdentityStub.Contracts.csproj" />
  </ItemGroup>
</Project>
```

`Core` does **not** reference its own `Infrastructure.Postgres`. Handlers depend on `IPackageRepository`, `ITransactionManager`, `IValidator<>`, `IOutboxService` — all interfaces in SharedKernel or Domain. The concrete `PackageRepository`/`ContentTransactionManager`/`ContentOutboxService` come in via DI from `Infrastructure.Postgres`.

- [ ] **Step 2: Move `CreatePackageCommand.cs` (make `public`).**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Core/Features/CreatePackage/CreatePackageCommand.cs`:

```csharp
namespace ArenaApi.Modules.Content.Core.Features.CreatePackage;

public sealed record CreatePackageCommand(string Slug, string Title);
```

Made `public` because the endpoint in `Infrastructure.Postgres` constructs it from the HTTP request and passes it to the handler, both across assembly boundaries.

- [ ] **Step 3: NEW — `CreatePackageCommandValidator.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Core/Features/CreatePackage/CreatePackageCommandValidator.cs`:

```csharp
using ArenaApi.SharedKernel.Errors;
using ArenaApi.SharedKernel.Validation;
using CSharpFunctionalExtensions;

namespace ArenaApi.Modules.Content.Core.Features.CreatePackage;

/// Pre-handler validation. Mirrors the checks inside Package.Create so the
/// caller gets a validation error before the slug-conflict check runs against
/// the database — cheaper for malformed inputs and consistent ordering of
/// error codes in the public API.
public sealed class CreatePackageCommandValidator : IValidator<CreatePackageCommand>
{
    public Result<Unit, Error> Validate(CreatePackageCommand instance)
    {
        ArgumentNullException.ThrowIfNull(instance);

        if (string.IsNullOrWhiteSpace(instance.Slug))
        {
            return Error.Validation(nameof(instance.Slug), "Slug must not be empty.");
        }

        if (string.IsNullOrWhiteSpace(instance.Title))
        {
            return Error.Validation(nameof(instance.Title), "Title must not be empty.");
        }

        return Unit.Default;
    }
}
```

Domain-level validation in `Package.Create` is the source of truth; this layer exists so the handler can short-circuit before its DB round-trip. Both layers stay — defense-in-depth.

- [ ] **Step 4: Refactor `CreatePackageHandler.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Core/Features/CreatePackage/CreatePackageHandler.cs`:

```csharp
using ArenaApi.Modules.Content.Contracts;
using ArenaApi.Modules.Content.Contracts.IntegrationEvents;
using ArenaApi.Modules.Content.Domain;
using ArenaApi.Modules.Content.Domain.Repositories;
using ArenaApi.SharedKernel.Errors;
using ArenaApi.SharedKernel.Persistence;
using ArenaApi.SharedKernel.Time;
using ArenaApi.SharedKernel.Validation;
using CSharpFunctionalExtensions;

namespace ArenaApi.Modules.Content.Core.Features.CreatePackage;

public sealed class CreatePackageHandler(
    IPackageRepository repository,
    ITransactionManager tx,
    IOutboxService outbox,
    IValidator<CreatePackageCommand> validator,
    IClock clock)
{
    public async Task<Result<PackageView, Error>> HandleAsync(
        CreatePackageCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        Result<Unit, Error> validation = validator.Validate(command);
        if (validation.IsFailure)
        {
            return validation.Error;
        }

        bool slugTaken = await repository
            .ExistsBySlugAsync(command.Slug, cancellationToken)
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

        await repository.AddAsync(package, cancellationToken).ConfigureAwait(false);

        await outbox.PublishAsync(
            new PackageCreated(package.Id, package.Slug, package.Title, package.CreatedAt),
            cancellationToken)
            .ConfigureAwait(false);

        await tx.CommitAsync(cancellationToken).ConfigureAwait(false);

        return new PackageView(package.Id, package.Slug, package.Title, package.CreatedAt);
    }
}
```

Critical differences vs. the old handler:
- No `ContentDbContext`, no `db.Packages.AnyAsync`, no `db.Packages.AddAsync`.
- `IOutboxService` (interface) replaces the concrete `ContentOutboxService` — the Infrastructure.Postgres `AddContentModule` will register `ContentOutboxService` against both `IOutboxService` and itself if needed.
- Final commit is `tx.CommitAsync` rather than `db.SaveChangesAsync`. The Wolverine EF Core transactional middleware still runs because it's keyed on the resolved `DbContext` in the scope, not on who called SaveChanges.

- [ ] **Step 5: Build standalone.**

```bash
dotnet build backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Core -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 6: Add to solution.**

```bash
dotnet sln backend/arena.slnx add \
  backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Core/ArenaApi.Modules.Content.Core.csproj \
  --solution-folder ArenaApi/Modules/Content
```

- [ ] **Step 7: Commit.**

```bash
git add backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Core backend/arena.slnx
git commit -m "feat(content): create Modules.Content.Core (refactored CreatePackageHandler on IRepository+ITransactionManager+IValidator)"
```

---

## Task 7: Create `ArenaApi.Modules.Content.Infrastructure.Postgres` — DbContext, repo, transaction manager, reader, outbox, endpoint, module

**Goal:** Land the EF Core implementation. This is the largest task in the plan — it stands up the new project and moves every Content infrastructure file from `ArenaApi.Core` into it. It also adds two new files (`PackageRepository`, `ContentTransactionManager`) and refactors the endpoint to an `IEndpoint` class.

**Files:**
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ArenaApi.Modules.Content.Infrastructure.Postgres.csproj`
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentDbContext.cs` (moved + namespace)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentDbContextDesignTimeFactory.cs` (moved + namespace)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Configurations/PackageConfiguration.cs` (moved + namespace)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Migrations/20260520121238_ContentInitial.cs` (moved + namespace)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Migrations/20260520121238_ContentInitial.Designer.cs` (moved + namespace)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Migrations/ContentDbContextModelSnapshot.cs` (moved + namespace)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Persistence/PackageRepository.cs` (**NEW**)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Persistence/ContentTransactionManager.cs` (**NEW**)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentReader.cs` (moved + namespace)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentOutboxService.cs` (moved + namespace)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Endpoints/CreatePackageEndpoint.cs` (**NEW IEndpoint** — replaces the old extension method)
- Create: `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentModule.cs` (moved + namespace, no `MapContentEndpoints`)

- [ ] **Step 1: csproj.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ArenaApi.Modules.Content.Infrastructure.Postgres.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.Modules.Content.Infrastructure.Postgres</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />

    <PackageReference Include="CSharpFunctionalExtensions" />
    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="Npgsql" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" />

    <PackageReference Include="WolverineFx" />
    <PackageReference Include="WolverineFx.EntityFrameworkCore" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Content.Contracts\ArenaApi.Modules.Content.Contracts.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Content.Domain\ArenaApi.Modules.Content.Domain.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Content.Core\ArenaApi.Modules.Content.Core.csproj" />
  </ItemGroup>
</Project>
```

`FrameworkReference Microsoft.AspNetCore.App` is required because the `IEndpoint` class touches `IEndpointRouteBuilder`, `TypedResults`, and minimal-API extensions — those live in the ASP.NET Core shared framework, not in any NuGet package on its own.

- [ ] **Step 2: Move `ContentDbContext.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentDbContext.cs`:

```csharp
using ArenaApi.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres;

public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_content";

    internal DbSet<Package> Packages => Set<Package>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ContentDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Modules.Content.Infrastructure.Postgres.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
```

`Packages` stays `internal`: the repository (in the same assembly) is the only legitimate caller. External access goes through `IPackageRepository`.

- [ ] **Step 3: Move `ContentDbContextDesignTimeFactory.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentDbContextDesignTimeFactory.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres;

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

- [ ] **Step 4: Move `Configurations/PackageConfiguration.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Configurations/PackageConfiguration.cs`:

```csharp
using ArenaApi.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres.Configurations;

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

- [ ] **Step 5: Move the three migration files.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Migrations/20260520121238_ContentInitial.cs` — keep the body identical; update only the namespace.

```csharp
using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArenaApi.Modules.Content.Infrastructure.Postgres.Migrations
{
    /// <inheritdoc />
    public partial class ContentInitial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "arena_content");

            migrationBuilder.CreateTable(
                name: "packages",
                schema: "arena_content",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_packages", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_packages_slug",
                schema: "arena_content",
                table: "packages",
                column: "slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "packages",
                schema: "arena_content");
        }
    }
}
```

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Migrations/20260520121238_ContentInitial.Designer.cs` — copy the existing file verbatim, change the top `using ArenaApi.Core.Modules.Content.Infrastructure;` to `using ArenaApi.Modules.Content.Infrastructure.Postgres;`, change the namespace to `ArenaApi.Modules.Content.Infrastructure.Postgres.Migrations`, and change the snapshot reference `[Migration("20260520121238_ContentInitial")]` line to match. The entity-type reference inside `BuildTargetModel` stays `ArenaApi.Core.Modules.Content.Domain.Package` *until* this step; update it to `ArenaApi.Modules.Content.Domain.Package`.

Full file (copy-paste verbatim):

```csharp
// <auto-generated />
using System;
using ArenaApi.Modules.Content.Infrastructure.Postgres;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ArenaApi.Modules.Content.Infrastructure.Postgres.Migrations
{
    [DbContext(typeof(ContentDbContext))]
    [Migration("20260520121238_ContentInitial")]
    partial class ContentInitial
    {
        /// <inheritdoc />
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasDefaultSchema("arena_content")
                .HasAnnotation("ProductVersion", "10.0.7")
                .HasAnnotation("Relational:MaxIdentifierLength", 63);

            NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

            modelBuilder.Entity("ArenaApi.Modules.Content.Domain.Package", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid")
                        .HasColumnName("id");

                    b.Property<DateTimeOffset>("CreatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("created_at");

                    b.Property<string>("Slug")
                        .IsRequired()
                        .HasMaxLength(120)
                        .HasColumnType("character varying(120)")
                        .HasColumnName("slug");

                    b.Property<string>("Title")
                        .IsRequired()
                        .HasMaxLength(200)
                        .HasColumnType("character varying(200)")
                        .HasColumnName("title");

                    b.HasKey("Id");

                    b.HasIndex("Slug")
                        .IsUnique();

                    b.ToTable("packages", "arena_content");
                });
#pragma warning restore 612, 618
        }
    }
}
```

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Migrations/ContentDbContextModelSnapshot.cs`:

```csharp
// <auto-generated />
using System;
using ArenaApi.Modules.Content.Infrastructure.Postgres;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ArenaApi.Modules.Content.Infrastructure.Postgres.Migrations
{
    [DbContext(typeof(ContentDbContext))]
    partial class ContentDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasDefaultSchema("arena_content")
                .HasAnnotation("ProductVersion", "10.0.7")
                .HasAnnotation("Relational:MaxIdentifierLength", 63);

            NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

            modelBuilder.Entity("ArenaApi.Modules.Content.Domain.Package", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid")
                        .HasColumnName("id");

                    b.Property<DateTimeOffset>("CreatedAt")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("created_at");

                    b.Property<string>("Slug")
                        .IsRequired()
                        .HasMaxLength(120)
                        .HasColumnType("character varying(120)")
                        .HasColumnName("slug");

                    b.Property<string>("Title")
                        .IsRequired()
                        .HasMaxLength(200)
                        .HasColumnType("character varying(200)")
                        .HasColumnName("title");

                    b.HasKey("Id");

                    b.HasIndex("Slug")
                        .IsUnique();

                    b.ToTable("packages", "arena_content");
                });
#pragma warning restore 612, 618
        }
    }
}
```

The migration body itself (`ContentInitial.Up/Down`) does **not** change because the EF history table only stores the migration id and the snapshot — the entity-type-name change inside `BuildTargetModel` re-snapshots cleanly on next `ef migrations add`. After this restructure, running `dotnet ef migrations list --context ContentDbContext` still reports `20260520121238_ContentInitial` as applied; no new migration needed.

- [ ] **Step 6: NEW — `Persistence/PackageRepository.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Persistence/PackageRepository.cs`:

```csharp
using ArenaApi.Modules.Content.Domain;
using ArenaApi.Modules.Content.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres.Persistence;

internal sealed class PackageRepository(ContentDbContext db) : IPackageRepository
{
    public async Task AddAsync(Package package, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(package);
        await db.Packages.AddAsync(package, cancellationToken).ConfigureAwait(false);
    }

    public Task<bool> ExistsBySlugAsync(string slug, CancellationToken cancellationToken = default)
    {
        return db.Packages
            .AsNoTracking()
            .AnyAsync(p => p.Slug == slug, cancellationToken);
    }
}
```

- [ ] **Step 7: NEW — `Persistence/ContentTransactionManager.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Persistence/ContentTransactionManager.cs`:

```csharp
using ArenaApi.SharedKernel.Persistence;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres.Persistence;

internal sealed class ContentTransactionManager(ContentDbContext db) : ITransactionManager
{
    public Task<int> CommitAsync(CancellationToken cancellationToken = default)
        => db.SaveChangesAsync(cancellationToken);
}
```

The Wolverine EF Core transactional middleware (`opts.UseEntityFrameworkCoreTransactions()` in `WolverineConfiguration`) sees `db.SaveChangesAsync` regardless of whether the handler calls it directly or via this wrapper — its hook is on `DbContext`, not on the call site.

- [ ] **Step 8: Move `ContentReader.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentReader.cs`:

```csharp
using ArenaApi.Modules.Content.Contracts;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres;

internal sealed class ContentReader(ContentDbContext db) : IContentReader
{
    public Task<PackageView?> GetPackageAsync(Guid packageId, CancellationToken cancellationToken = default)
    {
        return db.Packages
            .AsNoTracking()
            .Where(p => p.Id == packageId)
            .Select(p => new PackageView(p.Id, p.Slug, p.Title, p.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
```

- [ ] **Step 9: Move `ContentOutboxService.cs`.**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentOutboxService.cs`:

```csharp
using ArenaApi.SharedKernel.Persistence;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres;

internal sealed class ContentOutboxService(IDbContextOutbox<ContentDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
```

- [ ] **Step 10: NEW — `Endpoints/CreatePackageEndpoint.cs` (IEndpoint).**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Endpoints/CreatePackageEndpoint.cs`:

```csharp
using ArenaApi.Modules.Content.Contracts;
using ArenaApi.Modules.Content.Contracts.Http;
using ArenaApi.Modules.Content.Core.Features.CreatePackage;
using ArenaApi.SharedKernel.Endpoints;
using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres.Endpoints;

public sealed class CreatePackageEndpoint : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/packages/", HandleAsync)
            .WithName("CreatePackage")
            .WithTags("Content");
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

Route is now declared inside the endpoint itself (`/api/packages/`) instead of being assembled from a group. Other endpoints in the module will follow the same self-routing pattern. When the Phase 1.1 catalog endpoints land, they can either declare their full paths or, if a group is useful, the module can register a `RouteGroupBuilder` from its `Add<M>Module()` and have endpoints pull it via DI — but for the single endpoint we have today, self-routing is the simpler choice.

- [ ] **Step 11: Move `ContentModule.cs` (renamed: now lives in Infrastructure.Postgres; the `MapContentEndpoints` extension is removed).**

`backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentModule.cs`:

```csharp
using ArenaApi.Modules.Content.Contracts;
using ArenaApi.Modules.Content.Core.Features.CreatePackage;
using ArenaApi.Modules.Content.Domain.Repositories;
using ArenaApi.Modules.Content.Infrastructure.Postgres.Persistence;
using ArenaApi.SharedKernel;
using ArenaApi.SharedKernel.Persistence;
using ArenaApi.SharedKernel.Time;
using ArenaApi.SharedKernel.Validation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres;

public static class ContentModule
{
    public static IServiceCollection AddContentModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ContentDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ContentDbContext.SchemaName)));

        services.AddScoped<IPackageRepository, PackageRepository>();
        services.AddScoped<ITransactionManager, ContentTransactionManager>();
        services.AddScoped<IOutboxService, ContentOutboxService>();
        services.AddScoped<IContentReader, ContentReader>();
        services.AddScoped<CreatePackageHandler>();
        services.AddSingleton<IValidator<CreatePackageCommand>, CreatePackageCommandValidator>();
        services.AddSingleton<IClock, SystemClock>();

        return services;
    }
}
```

Important: this registers `ITransactionManager` as scoped — same lifetime as the underlying `DbContext`. Each module's `Add<M>Module()` will do the same, so the DI container ends up with N registrations of `ITransactionManager`. Handlers in Content's `Core` resolve `ITransactionManager` — DI returns the most recently registered, which is the right one *iff* the handler scope is rooted in the same module. Since each module's HTTP request lives in one `IServiceScope` and only ever resolves one handler, this is safe — but a cleaner alternative is to inject `ContentTransactionManager` directly (the concrete type) and keep `ITransactionManager` registration only for cross-module test seams. We take the cleaner alternative in the cross-module section of the next task; for now Content sticks with the interface so its handler keeps the abstract dependency. If a second module ever shares a service scope with Content, swap Content's handler to take `ContentTransactionManager` directly.

> **Why no `MapContentEndpoints`?** The `IEndpoint` auto-discovery from Task 2 replaces it. `CreatePackageEndpoint : IEndpoint` is picked up by Scrutor scanning `typeof(ContentModule).Assembly`, registered as a singleton, and mapped by `app.MapEndpoints()` in `Program.cs`.

- [ ] **Step 12: Build standalone.**

```bash
dotnet build backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 13: Add to solution.**

```bash
dotnet sln backend/arena.slnx add \
  backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ArenaApi.Modules.Content.Infrastructure.Postgres.csproj \
  --solution-folder ArenaApi/Modules/Content
```

- [ ] **Step 14: Verify the full solution still builds.**

```bash
dotnet build backend/arena.slnx -nologo
```

Expected: `Build succeeded`. Both the old `ArenaApi.Core.Modules.Content.*` and new `ArenaApi.Modules.Content.*` types coexist; that's fine — nothing in the old code references the new namespaces and vice versa. The crossover happens in Task 11 when `Program.cs` is rewired.

- [ ] **Step 15: Commit.**

```bash
git add backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres backend/arena.slnx
git commit -m "feat(content): create Modules.Content.Infrastructure.Postgres (DbContext, repos, reader, outbox, IEndpoint)"
```

---

## Task 8: Create `ArenaApi.Modules.Execution.{Contracts, Infrastructure.Postgres}`

**Goal:** Mirror the same split for Execution. Execution has no aggregates or features yet (per `2026-05-24-phase-1-mvp-loop.md` those land in Phase 1 proper); we ship `Contracts` as an empty placeholder and `Infrastructure.Postgres` as the relocated DbContext + outbox skeleton. No `Domain` or `Core` projects yet — they appear when the first execution feature lands.

**Files:**
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Contracts/ArenaApi.Modules.Execution.Contracts.csproj`
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Contracts/AssemblyMarker.cs`
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ArenaApi.Modules.Execution.Infrastructure.Postgres.csproj`
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ExecutionDbContext.cs` (moved + namespace)
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ExecutionDbContextDesignTimeFactory.cs` (moved + namespace)
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ExecutionOutboxService.cs` (moved + namespace)
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ExecutionModule.cs` (moved + namespace)

- [ ] **Step 1: `Contracts` csproj + marker.**

`backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Contracts/ArenaApi.Modules.Execution.Contracts.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.Modules.Execution.Contracts</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
  </ItemGroup>
</Project>
```

`backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Contracts/AssemblyMarker.cs`:

```csharp
namespace ArenaApi.Modules.Execution.Contracts;

/// Placeholder so the assembly is non-empty and discoverable by reflection.
/// Real Execution contracts (IRunner / IRunEventStream / RunVerdict / …)
/// land in Phase 1 per docs/superpowers/plans/2026-05-24-phase-1-mvp-loop.md.
internal static class AssemblyMarker;
```

- [ ] **Step 2: `Infrastructure.Postgres` csproj.**

`backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ArenaApi.Modules.Execution.Infrastructure.Postgres.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.Modules.Execution.Infrastructure.Postgres</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />

    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" />

    <PackageReference Include="WolverineFx" />
    <PackageReference Include="WolverineFx.EntityFrameworkCore" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Execution.Contracts\ArenaApi.Modules.Execution.Contracts.csproj" />
  </ItemGroup>
</Project>
```

`FrameworkReference Microsoft.AspNetCore.App` is included now so that when Phase 1 lands real `IEndpoint`s in Execution, no csproj change is needed.

- [ ] **Step 3: Move `ExecutionDbContext.cs`.**

`backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ExecutionDbContext.cs`:

```csharp
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Execution.Infrastructure.Postgres;

public sealed class ExecutionDbContext(DbContextOptions<ExecutionDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_execution";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ExecutionDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Modules.Execution.Infrastructure.Postgres.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
```

- [ ] **Step 4: Move `ExecutionDbContextDesignTimeFactory.cs`.**

`backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ExecutionDbContextDesignTimeFactory.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ArenaApi.Modules.Execution.Infrastructure.Postgres;

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

- [ ] **Step 5: Move `ExecutionOutboxService.cs`.**

`backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ExecutionOutboxService.cs`:

```csharp
using ArenaApi.SharedKernel.Persistence;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Execution.Infrastructure.Postgres;

internal sealed class ExecutionOutboxService(IDbContextOutbox<ExecutionDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
```

- [ ] **Step 6: Move `ExecutionModule.cs`.**

`backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ExecutionModule.cs`:

```csharp
using ArenaApi.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Modules.Execution.Infrastructure.Postgres;

public static class ExecutionModule
{
    public static IServiceCollection AddExecutionModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ExecutionDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ExecutionDbContext.SchemaName)));

        services.AddScoped<ExecutionOutboxService>();
        return services;
    }
}
```

Note: only registers itself as the concrete type, not `IOutboxService`. With multiple modules each binding `IOutboxService`, the last `AddScoped<IOutboxService, ContentOutboxService>` registration wins — that's actually fine for Content (it's the only module with handlers today) but a bug waiting to happen. We **intentionally** do not register `ExecutionOutboxService` against `IOutboxService` until Execution gets handlers (Phase 1 mvp-loop). When Execution handlers land, the design switches to keyed services (`services.AddKeyedScoped<IOutboxService, ExecutionOutboxService>("execution")`) or to direct concrete-type injection — that decision lives in Phase 1 mvp-loop, not here.

- [ ] **Step 7: Build standalone.**

```bash
dotnet build backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Contracts -nologo
dotnet build backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres -nologo
```

Both must succeed.

- [ ] **Step 8: Add to solution.**

```bash
dotnet sln backend/arena.slnx add \
  backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Contracts/ArenaApi.Modules.Execution.Contracts.csproj \
  backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ArenaApi.Modules.Execution.Infrastructure.Postgres.csproj \
  --solution-folder ArenaApi/Modules/Execution
```

- [ ] **Step 9: Commit.**

```bash
git add backend/ArenaApi/src/Modules/Execution backend/arena.slnx
git commit -m "feat(execution): split Execution module into Contracts + Infrastructure.Postgres csprojs"
```

---

## Task 9: Create `ArenaApi.Modules.Progress.{Contracts, Infrastructure.Postgres}` — include the cross-module `PackageCreatedHandler`

**Goal:** Same skeleton as Execution, plus the existing Wolverine handler for `PackageCreated`. The handler now imports `ArenaApi.Modules.Content.Contracts.IntegrationEvents.PackageCreated` — the *only* cross-module dependency in the codebase today. That dependency is expressed by a ProjectReference from `Progress.Infrastructure.Postgres` to `Content.Contracts`, which is exactly the kind of dependency the new layout makes explicit.

**Files:**
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Contracts/ArenaApi.Modules.Progress.Contracts.csproj`
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Contracts/AssemblyMarker.cs`
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ArenaApi.Modules.Progress.Infrastructure.Postgres.csproj`
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ProgressDbContext.cs` (moved)
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ProgressDbContextDesignTimeFactory.cs` (moved)
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ProgressOutboxService.cs` (moved)
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/EventHandlers/PackageCreatedHandler.cs` (moved)
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ProgressModule.cs` (moved)

- [ ] **Step 1: `Contracts` csproj + marker.**

`backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Contracts/ArenaApi.Modules.Progress.Contracts.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.Modules.Progress.Contracts</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
  </ItemGroup>
</Project>
```

`backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Contracts/AssemblyMarker.cs`:

```csharp
namespace ArenaApi.Modules.Progress.Contracts;

internal static class AssemblyMarker;
```

- [ ] **Step 2: `Infrastructure.Postgres` csproj.**

Note: this csproj is the *only* place in the whole solution that references another module's `Contracts` from an `Infrastructure.Postgres` project (Wolverine handlers live here and consume cross-module integration events). The ProjectReference makes that boundary explicit and reviewable.

`backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ArenaApi.Modules.Progress.Infrastructure.Postgres.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <RootNamespace>ArenaApi.Modules.Progress.Infrastructure.Postgres</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />

    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="Microsoft.Extensions.Logging.Abstractions" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" />

    <PackageReference Include="WolverineFx" />
    <PackageReference Include="WolverineFx.EntityFrameworkCore" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Progress.Contracts\ArenaApi.Modules.Progress.Contracts.csproj" />
    <!-- Cross-module event subscription: Progress listens to Content.PackageCreated. -->
    <ProjectReference Include="..\..\Content\ArenaApi.Modules.Content.Contracts\ArenaApi.Modules.Content.Contracts.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 3: Move `ProgressDbContext.cs`.**

`backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ProgressDbContext.cs`:

```csharp
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Progress.Infrastructure.Postgres;

public sealed class ProgressDbContext(DbContextOptions<ProgressDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_progress";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ProgressDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Modules.Progress.Infrastructure.Postgres.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
```

- [ ] **Step 4: Move `ProgressDbContextDesignTimeFactory.cs`.**

`backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ProgressDbContextDesignTimeFactory.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ArenaApi.Modules.Progress.Infrastructure.Postgres;

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

- [ ] **Step 5: Move `ProgressOutboxService.cs`.**

`backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ProgressOutboxService.cs`:

```csharp
using ArenaApi.SharedKernel.Persistence;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Progress.Infrastructure.Postgres;

internal sealed class ProgressOutboxService(IDbContextOutbox<ProgressDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
```

- [ ] **Step 6: Move `PackageCreatedHandler.cs` — the cross-module consumer.**

`backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/EventHandlers/PackageCreatedHandler.cs`:

```csharp
using ArenaApi.Modules.Content.Contracts.IntegrationEvents;
using Microsoft.Extensions.Logging;

namespace ArenaApi.Modules.Progress.Infrastructure.Postgres.EventHandlers;

/// Phase 0 stub. Listens to PackageCreated published by the Content module
/// and logs that it received it. In later phases this will write a row to
/// arena_progress.package_progress to track per-user enrollment, but the
/// listener wiring is identical — only the body grows.
public static partial class PackageCreatedHandler
{
    public static void Handle(PackageCreated message, ILogger<PackageCreatedHandlerLogCategory> logger)
    {
        LogReceived(logger, message.PackageId, message.Slug);
    }

    [LoggerMessage(
        EventId = 1,
        Level = LogLevel.Information,
        Message = "Progress module received PackageCreated for {PackageId} ({Slug})")]
    private static partial void LogReceived(ILogger logger, Guid packageId, string slug);

    public sealed class PackageCreatedHandlerLogCategory;
}
```

This is the only file in the codebase that imports another module's `Contracts`. Wolverine discovers the handler via assembly scanning (configured in Task 11's `WolverineConfiguration` update — `Discovery.IncludeAssembly(typeof(ProgressModule).Assembly)`).

- [ ] **Step 7: Move `ProgressModule.cs`.**

`backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ProgressModule.cs`:

```csharp
using ArenaApi.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Modules.Progress.Infrastructure.Postgres;

public static class ProgressModule
{
    public static IServiceCollection AddProgressModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ProgressDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ProgressDbContext.SchemaName)));

        services.AddScoped<ProgressOutboxService>();
        return services;
    }
}
```

- [ ] **Step 8: Build standalone.**

```bash
dotnet build backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Contracts -nologo
dotnet build backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres -nologo
```

Both must succeed.

- [ ] **Step 9: Add to solution.**

```bash
dotnet sln backend/arena.slnx add \
  backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Contracts/ArenaApi.Modules.Progress.Contracts.csproj \
  backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ArenaApi.Modules.Progress.Infrastructure.Postgres.csproj \
  --solution-folder ArenaApi/Modules/Progress
```

- [ ] **Step 10: Commit.**

```bash
git add backend/ArenaApi/src/Modules/Progress backend/arena.slnx
git commit -m "feat(progress): split Progress module into Contracts + Infrastructure.Postgres csprojs"
```

---

## Task 10: Migrate Health endpoint to `IEndpoint` and move it into Web

**Goal:** Convert the existing `HealthEndpoints.MapHealthEndpoints` extension into a `HealthEndpoint : IEndpoint` class that lives in `ArenaApi.Web/Features/Health/`. Health isn't a module — it's a host-level concern — so it stays in `ArenaApi.Web`. After this task, `Program.cs` won't need any per-endpoint hand-mapping at all; everything goes through `app.MapEndpoints()`.

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Web/Features/Health/HealthResponse.cs` (moved from `ArenaApi.Core/Features/Health/`)
- Create: `backend/ArenaApi/src/ArenaApi.Web/Features/Health/HealthEndpoint.cs` (rewritten as `IEndpoint`)

- [ ] **Step 1: Move `HealthResponse.cs` into Web (namespace change).**

`backend/ArenaApi/src/ArenaApi.Web/Features/Health/HealthResponse.cs`:

```csharp
namespace ArenaApi.Web.Features.Health;

public sealed record HealthResponse(string Status);
```

- [ ] **Step 2: Rewrite `HealthEndpoint.cs` as an `IEndpoint`.**

`backend/ArenaApi/src/ArenaApi.Web/Features/Health/HealthEndpoint.cs`:

```csharp
using ArenaApi.SharedKernel.Endpoints;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Web.Features.Health;

public sealed class HealthEndpoint : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("/health/", () => Results.Ok(new HealthResponse("ok")))
            .WithName("Health")
            .WithTags("Health");
    }
}
```

Note: route is `/health/` (trailing slash, per CLAUDE.md convention). The current `MapHealthEndpoints` uses `/health` without slash; this is a deliberate fix-while-touching since the existing `HealthEndpointTests` checks `GET /health` which only worked because the test framework doesn't redirect-resolve. We update the test in Task 14 to match.

- [ ] **Step 3: Build Web standalone.**

```bash
dotnet build backend/ArenaApi/src/ArenaApi.Web -nologo
```

Expected: `Build succeeded`. The Web project still references `ArenaApi.Core` (Task 11 hasn't dropped that ref yet) so the old `HealthEndpoints.MapHealthEndpoints` extension is still callable from the legacy `Program.cs` — both endpoints coexist for now.

- [ ] **Step 4: Commit.**

```bash
git add backend/ArenaApi/src/ArenaApi.Web/Features/Health
git commit -m "feat(web): convert Health endpoint to IEndpoint class"
```

---

## Task 11: Rewrite `Program.cs` — wire new modules, Scrutor scanning, `app.MapEndpoints()`; drop legacy Core/Contracts/Infrastructure project refs

**Goal:** This is the cutover. After this task, the Web host runs entirely on the new module layout. The legacy `ArenaApi.Core.Modules.*` types and the `ArenaApi.Contracts.Content.*` DTOs are still on disk but no longer referenced from Web — meaning the build effectively dead-codes them. Task 17 deletes the directories.

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj` — drop legacy refs, add module refs.
- Modify: `backend/ArenaApi/src/ArenaApi.Web/Program.cs` — full rewrite.
- Modify: `backend/ArenaApi/src/ArenaApi.Web/Configuration/WolverineConfiguration.cs` — `Discovery.IncludeAssembly` per new assembly.
- Modify: `backend/ArenaApi/src/ArenaApi.Web/Authorization/RequireAdminFilter.cs` — switch to new `ICurrentUser` namespace.

- [ ] **Step 1: Rewrite `ArenaApi.Web.csproj`.**

`backend/ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" />
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

    <PackageReference Include="Scrutor" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />

    <ProjectReference Include="..\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Contracts\ArenaApi.Modules.IdentityStub.Contracts.csproj" />
    <ProjectReference Include="..\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Infrastructure\ArenaApi.Modules.IdentityStub.Infrastructure.csproj" />

    <ProjectReference Include="..\Modules\Content\ArenaApi.Modules.Content.Contracts\ArenaApi.Modules.Content.Contracts.csproj" />
    <ProjectReference Include="..\Modules\Content\ArenaApi.Modules.Content.Infrastructure.Postgres\ArenaApi.Modules.Content.Infrastructure.Postgres.csproj" />

    <ProjectReference Include="..\Modules\Execution\ArenaApi.Modules.Execution.Contracts\ArenaApi.Modules.Execution.Contracts.csproj" />
    <ProjectReference Include="..\Modules\Execution\ArenaApi.Modules.Execution.Infrastructure.Postgres\ArenaApi.Modules.Execution.Infrastructure.Postgres.csproj" />

    <ProjectReference Include="..\Modules\Progress\ArenaApi.Modules.Progress.Contracts\ArenaApi.Modules.Progress.Contracts.csproj" />
    <ProjectReference Include="..\Modules\Progress\ArenaApi.Modules.Progress.Infrastructure.Postgres\ArenaApi.Modules.Progress.Infrastructure.Postgres.csproj" />
  </ItemGroup>
</Project>
```

`ArenaApi.Core`, `ArenaApi.Contracts`, `ArenaApi.Infrastructure` ProjectReferences are **gone**. The new layout's transitive graph delivers everything Web needs.

- [ ] **Step 2: Update `RequireAdminFilter.cs` namespace ref.**

`backend/ArenaApi/src/ArenaApi.Web/Authorization/RequireAdminFilter.cs`:

```csharp
using ArenaApi.Modules.IdentityStub.Contracts;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ArenaApi.Web.Authorization;

/// Endpoint filter that 403s any request whose ICurrentUser.IsAdmin is false.
/// Mounted once on the /api/admin route group by ContentModule wiring.
public sealed class RequireAdminFilter(ICurrentUser currentUser) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        if (!currentUser.IsAdmin)
        {
            return TypedResults.Json(
                new AdminErrorPayload("Forbidden.Admin", "Admin privileges required."),
                statusCode: StatusCodes.Status403Forbidden);
        }

        return await next(context).ConfigureAwait(false);
    }

    public sealed record AdminErrorPayload(string Code, string Message);
}
```

Only change: `using ArenaApi.Core.Modules.IdentityStub.Public;` -> `using ArenaApi.Modules.IdentityStub.Contracts;`.

- [ ] **Step 3: Rewrite `Program.cs`.**

`backend/ArenaApi/src/ArenaApi.Web/Program.cs`:

```csharp
using ArenaApi.Modules.Content.Infrastructure.Postgres;
using ArenaApi.Modules.Execution.Infrastructure.Postgres;
using ArenaApi.Modules.IdentityStub.Infrastructure;
using ArenaApi.Modules.Progress.Infrastructure.Postgres;
using ArenaApi.SharedKernel;
using ArenaApi.Web.Configuration;
using ArenaApi.Web.Endpoints;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// Order matters: modules register their DbContexts first, then UseArenaWolverine
// wraps them with EF Core transactional middleware (IDbContextOutbox<T> resolves
// per DbContext at runtime).
builder.Services
    .AddIdentityStubModule(builder.Configuration)
    .AddContentModule(builder.Configuration)
    .AddExecutionModule(builder.Configuration)
    .AddProgressModule(builder.Configuration);

// Endpoint auto-discovery: scan every module Infrastructure.Postgres assembly
// + the Web assembly itself (for Health). Scrutor registers each IEndpoint as
// a singleton; app.MapEndpoints() resolves and mounts them after Build.
builder.Services.AddEndpointsFromAssemblies(
    typeof(Program).Assembly,
    typeof(ContentModule).Assembly,
    typeof(ExecutionModule).Assembly,
    typeof(ProgressModule).Assembly);

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString(ConnectionStringNames.Redis);
});

builder.Services.AddHybridCache();

builder.UseArenaWolverine();

builder.Services.AddOpenApi();

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapEndpoints();

await app.RunAsync();

namespace ArenaApi.Web
{
    public sealed class Program;
}
```

Key swaps vs. the old `Program.cs`:
- `using ArenaApi.Core;` -> `using ArenaApi.SharedKernel;` (for `ConnectionStringNames`).
- `using ArenaApi.Core.Features.Health;` deleted — Health is now an `IEndpoint`.
- `using ArenaApi.Core.Modules.<X>;` -> `using ArenaApi.Modules.<X>.Infrastructure.Postgres;` (since `Add<X>Module` lives in `Infrastructure.Postgres` now). `IdentityStub` uses `ArenaApi.Modules.IdentityStub.Infrastructure` because IdentityStub doesn't have an `Infrastructure.Postgres` (it has no DbContext).
- `app.MapHealthEndpoints()` + `app.MapContentEndpoints()` -> single `app.MapEndpoints()`.

- [ ] **Step 4: Update `WolverineConfiguration.cs`.**

The Wolverine handler discovery has to include every assembly that *contains* an `IWolverineHandler`. Today that's `Progress.Infrastructure.Postgres` (for `PackageCreatedHandler`). Future modules add more.

`backend/ArenaApi/src/ArenaApi.Web/Configuration/WolverineConfiguration.cs`:

```csharp
using ArenaApi.Modules.Content.Infrastructure.Postgres;
using ArenaApi.Modules.Execution.Infrastructure.Postgres;
using ArenaApi.Modules.Progress.Infrastructure.Postgres;
using ArenaApi.SharedKernel;
using Wolverine;
using Wolverine.EntityFrameworkCore;
using Wolverine.Postgresql;
using Wolverine.RabbitMQ;

namespace ArenaApi.Web.Configuration;

public static class WolverineConfiguration
{
    public const string WolverineSchema = "arena_wolverine";

    /// <summary>
    /// Wires Wolverine with Postgres durable storage, RabbitMQ transport,
    /// the EF Core transactional middleware, and handler discovery across
    /// every module's Infrastructure.Postgres assembly.
    /// </summary>
    public static IHostApplicationBuilder UseArenaWolverine(this IHostApplicationBuilder builder)
    {
        string pgConnection =
            builder.Configuration.GetConnectionString(ConnectionStringNames.Database)
            ?? throw new InvalidOperationException(
                $"ConnectionStrings:{ConnectionStringNames.Database} is missing.");

        string rabbitConnection =
            builder.Configuration.GetConnectionString(ConnectionStringNames.RabbitMq)
            ?? throw new InvalidOperationException(
                $"ConnectionStrings:{ConnectionStringNames.RabbitMq} is missing.");

        builder.UseWolverine(opts =>
        {
            opts.PersistMessagesWithPostgresql(pgConnection, WolverineSchema);

            opts.UseRabbitMq(new Uri(rabbitConnection))
                .AutoProvision()
                .UseConventionalRouting();

            // Even when consumer is in-process, route messages through the broker so
            // future microservice extraction is mechanical (no code change at call site).
            opts.Policies.UseDurableInboxOnAllListeners();
            opts.Policies.UseDurableOutboxOnAllSendingEndpoints();

            // EF Core transactional middleware. Each module's DbContext is already
            // registered via Add<Module>Module() in Program.cs, so a single call
            // here enrolls all of them: IDbContextOutbox<TDbContext> resolves at
            // runtime for ContentDbContext / ExecutionDbContext / ProgressDbContext.
            opts.UseEntityFrameworkCoreTransactions();

            // Handler discovery: include every module's Infrastructure.Postgres
            // assembly. PackageCreatedHandler lives in Progress.Infrastructure.Postgres;
            // future Wolverine handlers in Content / Execution Infrastructure.Postgres
            // are picked up automatically by these IncludeAssembly calls.
            opts.Discovery.IncludeAssembly(typeof(ContentModule).Assembly);
            opts.Discovery.IncludeAssembly(typeof(ExecutionModule).Assembly);
            opts.Discovery.IncludeAssembly(typeof(ProgressModule).Assembly);
        });

        return builder;
    }
}
```

- [ ] **Step 5: Delete `GlobalUsings.cs` line clutter that no longer compiles.** Open `backend/ArenaApi/src/ArenaApi.Web/GlobalUsings.cs` and leave it as-is — the existing `global using Microsoft.Extensions.*` lines still resolve. No edit needed; verify:

```bash
cat backend/ArenaApi/src/ArenaApi.Web/GlobalUsings.cs
```

Expected output: the same 5 lines that were there before.

- [ ] **Step 6: Build Web (the moment of truth).**

```bash
dotnet build backend/ArenaApi/src/ArenaApi.Web -nologo
```

Expected: `Build succeeded`. Likely first-try-failure modes:
- `'AddContentModule' is not defined` — verify the using `ArenaApi.Modules.Content.Infrastructure.Postgres` is present and the ProjectReference exists.
- `Type or namespace 'ArenaApi.Core' could not be found` — check that no stale `using ArenaApi.Core;` lines remain. The only `ArenaApi.Core`-shaped namespace in scope now is the *legacy* `ArenaApi.Core.*` from the still-on-disk Core project, but Web no longer references it.
- `The type 'X' exists in both 'ArenaApi.Core, ...' and 'ArenaApi.Modules.Content.Contracts, ...'` — won't happen here because Web doesn't reference `ArenaApi.Core` anymore. If it does, recheck Step 1 — the legacy ref must be removed.

- [ ] **Step 7: Build the whole solution.**

```bash
dotnet build backend/arena.slnx -nologo
```

Expected: `Build succeeded`. The legacy `ArenaApi.Core`, `ArenaApi.Contracts`, `ArenaApi.Infrastructure` projects still compile in isolation (they have no broken refs internally), they're just not referenced from Web anymore. Test projects still reference them — that's fixed in Task 14.

- [ ] **Step 8: Smoke the Web host locally (no docker).**

```bash
ASPNETCORE_ENVIRONMENT=Development dotnet run --project backend/ArenaApi/src/ArenaApi.Web --no-build
```

Wait for `Now listening on:`. In another shell:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:5000/health/
```

Expected: `200`.

Ctrl-C the server. **This step requires a running Postgres / RabbitMQ; if you don't have them up, skip the smoke and rely on the integration test sweep in Task 16.**

- [ ] **Step 9: Commit.**

```bash
git add backend/ArenaApi/src/ArenaApi.Web
git commit -m "feat(web): cut over Program.cs + WolverineConfiguration to new module layout (Scrutor IEndpoint auto-discovery)"
```

---

## Task 12: Drop NetArchTest down to one regression sanity test

**Goal:** With the ProjectReference graph now enforcing every isolation rule at compile time, the bulk of `ModuleBoundariesTests` is redundant. Keep a single belt-and-suspenders test that asserts "no `Modules.*` assembly takes a runtime dependency on another `Modules.*`'s `Domain` or `Infrastructure.Postgres` namespace" so that a misguided cross-csproj `<Reference>` (added by hand, bypassing `<ProjectReference>`) is caught.

**Files:**
- Modify: `backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs` — slim to one test.

- [ ] **Step 1: Replace the file.**

`backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs`:

```csharp
using System.Reflection;
using ArenaApi.Modules.Content.Infrastructure.Postgres;
using ArenaApi.Modules.Execution.Infrastructure.Postgres;
using ArenaApi.Modules.Progress.Infrastructure.Postgres;
using NetArchTest.Rules;
using Xunit;

namespace ArenaApi.UnitTests.Architecture;

/// Compile-time module isolation is enforced by the ProjectReference graph:
/// `Modules.<X>.Core` and `Modules.<X>.Infrastructure.Postgres` only reference
/// other modules' `Contracts`, never their `Domain` or `Infrastructure.Postgres`.
///
/// This regression test is a single belt-and-suspenders check that scans the
/// loaded module assemblies for accidental cross-module Domain/Infrastructure
/// references — the kind a hand-edited csproj could sneak past the build.
public sealed class ModuleBoundariesTests
{
    private static readonly Assembly[] ModuleInfrastructureAssemblies =
    [
        typeof(ContentModule).Assembly,
        typeof(ExecutionModule).Assembly,
        typeof(ProgressModule).Assembly,
    ];

    [Fact]
    public void No_module_infrastructure_depends_on_another_modules_Domain_or_Infrastructure()
    {
        (string Owner, string[] ForbiddenNamespaces)[] rules =
        [
            ("ArenaApi.Modules.Content", new[]
            {
                "ArenaApi.Modules.Execution.Infrastructure.Postgres",
                "ArenaApi.Modules.Progress.Infrastructure.Postgres",
                // Content has no other-module .Domain refs to forbid because
                // Execution and Progress carry no Domain project today.
            }),
            ("ArenaApi.Modules.Execution", new[]
            {
                "ArenaApi.Modules.Content.Domain",
                "ArenaApi.Modules.Content.Infrastructure.Postgres",
                "ArenaApi.Modules.Progress.Infrastructure.Postgres",
            }),
            ("ArenaApi.Modules.Progress", new[]
            {
                "ArenaApi.Modules.Content.Domain",
                "ArenaApi.Modules.Content.Infrastructure.Postgres",
                "ArenaApi.Modules.Execution.Infrastructure.Postgres",
            }),
        ];

        Assert.All(rules, rule =>
        {
            Assembly subject = ModuleInfrastructureAssemblies
                .First(a => a.GetName().Name!.StartsWith(rule.Owner + ".", StringComparison.Ordinal));

            TestResult result = Types
                .InAssembly(subject)
                .ShouldNot()
                .HaveDependencyOnAny(rule.ForbiddenNamespaces)
                .GetResult();

            Assert.True(
                result.IsSuccessful,
                $"{subject.GetName().Name} depends on forbidden namespaces. " +
                $"Failing types: {string.Join(", ", result.FailingTypeNames ?? [])}");
        });
    }
}
```

The four old tests (`Content_internals_are_not_referenced_from_other_modules`, `Execution_internals_…`, `Progress_internals_…`, `IdentityStub_only_exposes_Public_namespace`, `DbContexts_are_not_referenced_outside_their_owning_module`) are all subsumed by the new single check, because:
- Compile-time enforcement: a `<ProjectReference>` from `Modules.X.Core` to `Modules.Y.Domain` would have to be added by hand to the csproj — the project graph forbids it via reviewer attention rather than build error, but the runtime check above catches it.
- `IdentityStub` no longer has a separate `Public/` folder — its `Contracts` project *is* the public surface. The old "no one references `IdentityStub.Infrastructure` outside IdentityStub" assertion is now compile-enforced: there's no ProjectReference to `Modules.IdentityStub.Infrastructure` from any module's `Core` or `Domain`, only from `Web`.
- `DbContexts are not referenced outside their owning module` is compile-enforced: `Modules.Content.Infrastructure.Postgres` is the only project that references `ContentDbContext` (it owns it); `Modules.Progress.Infrastructure.Postgres` doesn't even reference `Modules.Content.Infrastructure.Postgres`, only `Modules.Content.Contracts`.

- [ ] **Step 2: Run the architecture test.**

```bash
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~ModuleBoundariesTests" --nologo
```

Expected: 1 passed. (The four previously-passing tests are gone; the new one covers the same risk surface.)

- [ ] **Step 3: Commit.**

```bash
git add backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs
git commit -m "test(arch): slim ModuleBoundariesTests to one regression check (compiler enforces the rest)"
```

---

## Task 13: Update `ArenaApi.UnitTests.csproj` to reference module projects (not legacy Core)

**Goal:** Drop the legacy `ArenaApi.Core` ProjectReference from the unit test project. Replace with the specific module projects the tests touch (Content.Contracts/Infrastructure.Postgres for the architecture test, IdentityStub.Infrastructure for `StubCurrentUserTests`).

**Files:**
- Modify: `backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj`

- [ ] **Step 1: Replace the csproj.**

`backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj`:

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
    <ProjectReference Include="..\..\src\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\..\src\ArenaApi.Web\ArenaApi.Web.csproj" />

    <ProjectReference Include="..\..\src\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Contracts\ArenaApi.Modules.IdentityStub.Contracts.csproj" />
    <ProjectReference Include="..\..\src\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Infrastructure\ArenaApi.Modules.IdentityStub.Infrastructure.csproj" />

    <ProjectReference Include="..\..\src\Modules\Content\ArenaApi.Modules.Content.Contracts\ArenaApi.Modules.Content.Contracts.csproj" />
    <ProjectReference Include="..\..\src\Modules\Content\ArenaApi.Modules.Content.Infrastructure.Postgres\ArenaApi.Modules.Content.Infrastructure.Postgres.csproj" />

    <ProjectReference Include="..\..\src\Modules\Execution\ArenaApi.Modules.Execution.Infrastructure.Postgres\ArenaApi.Modules.Execution.Infrastructure.Postgres.csproj" />
    <ProjectReference Include="..\..\src\Modules\Progress\ArenaApi.Modules.Progress.Infrastructure.Postgres\ArenaApi.Modules.Progress.Infrastructure.Postgres.csproj" />
  </ItemGroup>
</Project>
```

Web is referenced because `EndpointAutoDiscoveryTests` lives in the same assembly. The two Infrastructure.Postgres refs (Execution, Progress) supply the assemblies that `ModuleBoundariesTests` enumerates.

- [ ] **Step 2: Run the unit-test project.**

```bash
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --nologo --logger "console;verbosity=minimal"
```

Expected: all tests green — `StubCurrentUserTests` (4), `EndpointAutoDiscoveryTests` (2), `ModuleBoundariesTests` (1), `SmokeTests` (whatever it has). No reference-not-found errors.

- [ ] **Step 3: Commit.**

```bash
git add backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj
git commit -m "test(unit): drop legacy ArenaApi.Core ref, point at module projects"
```

---

## Task 14: Update `ArenaApi.IntegrationTests` — project refs, namespaces, health route

**Goal:** Repoint the integration test project's references at the new layout, fix `IntegrationTestsWebFactory`'s `using ArenaApi.Core.Modules.Content.Infrastructure;` to the new `Modules.Content.Infrastructure.Postgres` namespace, and update `HealthEndpointTests` to call `/health/` (matches the new endpoint route).

**Files:**
- Modify: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/ArenaApi.IntegrationTests.csproj`
- Modify: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs`
- Modify: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/HealthEndpointTests.cs`
- Modify: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/CreatePackageEndpointTests.cs`

- [ ] **Step 1: Update csproj.**

`backend/ArenaApi/tests/ArenaApi.IntegrationTests/ArenaApi.IntegrationTests.csproj`:

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
    <ProjectReference Include="..\..\src\Modules\Content\ArenaApi.Modules.Content.Contracts\ArenaApi.Modules.Content.Contracts.csproj" />
    <ProjectReference Include="..\..\src\Modules\Content\ArenaApi.Modules.Content.Infrastructure.Postgres\ArenaApi.Modules.Content.Infrastructure.Postgres.csproj" />
  </ItemGroup>
</Project>
```

Web is referenced (transitively pulls everything) plus explicit refs for the Content Contracts (DTOs in test bodies) and Infrastructure.Postgres (`ContentDbContext` for migration kickoff in `IntegrationTestsWebFactory`).

- [ ] **Step 2: Update `IntegrationTestsWebFactory.cs`.**

The current file uses `ArenaApi.Core.Modules.Content.Infrastructure` for `ContentDbContext`. Update to the new namespace. Also: the `AdminAuthorizationTests` that landed in `aa16e8b` references methods that already exist (`CreateAdminClient`, `CreateAnonymousClient`, `ResetContentSchemaAsync`); preserve them.

`backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs`:

```csharp
using ArenaApi.Modules.Content.Infrastructure.Postgres;
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
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("sharp_arena")
        .WithUsername("arena")
        .WithPassword("arena")
        .Build();

    private readonly RabbitMqContainer _rabbit = new RabbitMqBuilder("rabbitmq:3.13-management-alpine")
        .Build();

    /// Default value for IdentityStub:IsAdmin when CreateClient() is called.
    /// Tests that need the opposite create a customised client via CreateAdminClient()
    /// or CreateAnonymousClient(); the default mirrors a non-admin anonymous browser.
    public bool DefaultIsAdmin { get; set; } = true;

    public string PostgresConnectionString => _postgres.GetConnectionString();

    public string RabbitConnectionString => _rabbit.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await _rabbit.StartAsync();
        await CreateSchemasAsync();

        // Eagerly construct the WebHost so module DbContexts are available,
        // then run EF migrations for the Content module. Execution and
        // Progress have no migrations yet — schema-only is enough.
        using IServiceScope scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ContentDbContext>().Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
        await _rabbit.DisposeAsync();
        await base.DisposeAsync();
    }

    public HttpClient CreateAdminClient() => CreateClientWithAdmin(true);

    public HttpClient CreateAnonymousClient() => CreateClientWithAdmin(false);

    private HttpClient CreateClientWithAdmin(bool isAdmin) =>
        WithWebHostBuilder(b => b.UseSetting("IdentityStub:IsAdmin", isAdmin ? "true" : "false"))
            .CreateClient();

    public async Task ResetContentSchemaAsync()
    {
        await using NpgsqlConnection conn = new(PostgresConnectionString);
        await conn.OpenAsync();
        await using NpgsqlCommand cmd = conn.CreateCommand();
        cmd.CommandText = """
            TRUNCATE TABLE arena_content.packages
            RESTART IDENTITY CASCADE;
        """;
        await cmd.ExecuteNonQueryAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Database", PostgresConnectionString);
        builder.UseSetting("ConnectionStrings:RabbitMq", RabbitConnectionString);
        // Redis is wired in Program.cs but not exercised by these tests.
        // Point it at a harmless host:port — StackExchangeRedisCache only
        // connects when actually used.
        builder.UseSetting("ConnectionStrings:Redis", "localhost:6379");
        builder.UseSetting("IdentityStub:HardcodedUserId", Guid.CreateVersion7().ToString());
        builder.UseSetting("IdentityStub:IsAdmin", DefaultIsAdmin ? "true" : "false");
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

Notable differences vs. `aa16e8b` head:
- `using ArenaApi.Core.Modules.Content.Infrastructure;` -> `using ArenaApi.Modules.Content.Infrastructure.Postgres;`.
- `ResetContentSchemaAsync` truncates only `packages` (the only existing table). The `aa16e8b` version listed catalog tables that don't exist yet — those tables land in Phase 1.1. Trimming the TRUNCATE to existing tables means tests work *today* and Phase 1.1's plan rewrites this method as part of its own Task block.
- The `builder.UseSetting("Content:DisableCatalogSeeder", "true")` line is gone — `CatalogSeederHostedService` doesn't exist yet. Phase 1.1 reintroduces both.
- All `await` calls in the helper bodies stay unchanged (Respawn / Testcontainers contracts are unaffected).

- [ ] **Step 3: Update `HealthEndpointTests.cs` to hit `/health/`.**

`backend/ArenaApi/tests/ArenaApi.IntegrationTests/HealthEndpointTests.cs`:

```csharp
using System.Net;
using ArenaApi.IntegrationTests.Infrastructure;
using ArenaApi.IntegrationTests.Modules.Content;
using Xunit;

namespace ArenaApi.IntegrationTests;

[Collection(nameof(IntegrationTestsCollection))]
public sealed class HealthEndpointTests
{
    private readonly IntegrationTestsWebFactory _factory;

    public HealthEndpointTests(IntegrationTestsWebFactory factory) => _factory = factory;

    [Fact]
    public async Task HealthReturnsOk()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.GetAsync("/health/");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

Only change: `"/health"` -> `"/health/"`.

- [ ] **Step 4: Update `CreatePackageEndpointTests.cs` namespace ref.**

The old test imports `ArenaApi.Contracts.Content` for `CreatePackageRequest`/`Response`. After the move those types live in `ArenaApi.Modules.Content.Contracts.Http`.

`backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/CreatePackageEndpointTests.cs`:

```csharp
using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using ArenaApi.IntegrationTests.Infrastructure;
using ArenaApi.Modules.Content.Contracts.Http;
using Npgsql;
using Xunit;

namespace ArenaApi.IntegrationTests.Modules.Content;

[Collection(nameof(IntegrationTestsCollection))]
public sealed class CreatePackageEndpointTests
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

        // 1. Row persisted in arena_content.packages.
        await using NpgsqlConnection conn = new(_factory.PostgresConnectionString);
        await conn.OpenAsync();

        await using (NpgsqlCommand cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT COUNT(*) FROM arena_content.packages WHERE slug = @slug";
            cmd.Parameters.AddWithValue("slug", slug);
            object? count = await cmd.ExecuteScalarAsync();
            Assert.Equal(1L, Assert.IsType<long>(count));
        }

        // 2. Wolverine auto-provisioned its envelope tables in arena_wolverine.
        await WaitForEnvelopeProcessedAsync(conn);
    }

    private static async Task WaitForEnvelopeProcessedAsync(NpgsqlConnection conn)
    {
        DateTime deadline = DateTime.UtcNow.AddSeconds(15);
        while (DateTime.UtcNow < deadline)
        {
            await using NpgsqlCommand cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = 'arena_wolverine';
            """;
            object? count = await cmd.ExecuteScalarAsync();
            if (Convert.ToInt64(count, CultureInfo.InvariantCulture) > 0)
            {
                return;
            }

            await Task.Delay(500);
        }

        Assert.Fail("Wolverine envelope tables were not auto-provisioned in arena_wolverine schema within 15s.");
    }
}

[CollectionDefinition(nameof(IntegrationTestsCollection))]
[System.Diagnostics.CodeAnalysis.SuppressMessage(
    "Naming",
    "CA1711:Identifiers should not have incorrect suffix",
    Justification = "xUnit's CollectionDefinition pattern requires the 'Collection' suffix.")]
public sealed class IntegrationTestsCollection : ICollectionFixture<IntegrationTestsWebFactory>;
```

Only changes from the file at HEAD: `using ArenaApi.Contracts.Content;` -> `using ArenaApi.Modules.Content.Contracts.Http;`.

- [ ] **Step 5: Build integration tests.**

```bash
dotnet build backend/ArenaApi/tests/ArenaApi.IntegrationTests -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 6: Run the integration tests (requires Docker for Testcontainers).**

```bash
dotnet test backend/ArenaApi/tests/ArenaApi.IntegrationTests --nologo --logger "console;verbosity=minimal"
```

Expected:
- `HealthReturnsOk` — green (matches new `/health/` route).
- `CreatePackage_persists_row_and_publishes_envelope` — green (Wolverine + new module wiring still committed via `tx.CommitAsync`).
- `AdminAuthorizationTests.*` — still skipped (the `[Fact(Skip = …)]` is intact; Phase 1.1 unskips after admin endpoints land).

- [ ] **Step 7: Commit.**

```bash
git add backend/ArenaApi/tests/ArenaApi.IntegrationTests
git commit -m "test(integration): repoint at new module layout, fix /health/ route, fix DTO namespaces"
```

---

## Task 15: Full build + test sweep + docker-compose smoke

**Goal:** Prove the restructure didn't break anything end-to-end.

- [ ] **Step 1: Clean rebuild.**

```bash
dotnet build backend/arena.slnx -nologo --no-incremental
```

Expected: `Build succeeded` with 0 errors and 0 warnings.

- [ ] **Step 2: Full test sweep.**

```bash
dotnet test backend/arena.slnx --nologo --logger "console;verbosity=minimal" 2>&1 | tail -20
```

Expected: at least the baseline pass count (recorded in Pre-flight Step 4) plus the new `EndpointAutoDiscoveryTests` (+2). The slimmed `ModuleBoundariesTests` returns one test instead of five — net unit-test count drops by 4. Total = baseline - 4 + 2 = baseline - 2 passing. No failures.

- [ ] **Step 3: Docker-compose smoke (optional but recommended).**

If `docker compose` is available locally:

```bash
docker compose -f docker-compose.yml up -d --build api postgres rabbitmq redis
sleep 10
curl -sS -o /dev/null -w "GET /health/  -> %{http_code}\n" http://localhost:8080/health/
curl -sS -o /dev/null -w "POST /api/packages/  -> %{http_code}\n" \
     -X POST -H 'Content-Type: application/json' \
     -d '{"slug":"smoke-restructure","title":"Smoke"}' \
     http://localhost:8080/api/packages/
docker compose -f docker-compose.yml logs api | grep -i "PackageCreated for" | head -1
docker compose -f docker-compose.yml down
```

Expected:
- `GET /health/ -> 200`
- `POST /api/packages/ -> 201`
- A log line `Progress module received PackageCreated for ...` (Wolverine integration event end-to-end).

If `docker compose` isn't available, rely on the Testcontainers-backed integration test sweep from Task 14 Step 6.

- [ ] **Step 4: No commit yet — this task is verification only.**

---

## Task 16: Update `backend/ArenaApi/CLAUDE.md` to describe the new layout

**Goal:** The existing service memory describes the four-project monolith (`ArenaApi.{Web, Core, Contracts, Infrastructure}`). Rewrite it to describe the per-module quadruple + SharedKernel + auto-discovered endpoints + repository abstractions.

**Files:**
- Modify: `backend/ArenaApi/CLAUDE.md` (full rewrite)

- [ ] **Step 1: Replace `backend/ArenaApi/CLAUDE.md` with:**

```markdown
# ArenaApi — service memory

Single .NET 10 service powering Sharp Arena, structured as a **Clean-Architecture-per-module modular monolith**. Each module owns up to four csproj projects; module isolation is enforced by the ProjectReference graph at compile time.

## Project map

| Path                                                                                       | Owns                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/ArenaApi.Web/`                                                                        | Host: `Program.cs`, Wolverine configuration, `RequireAdminFilter`, `EndpointAutoDiscovery`, Health endpoint |
| `src/ArenaApi.SharedKernel/`                                                               | Cross-cutting primitives: `Error`, `IClock`, domain-event markers, `ITransactionManager`, `IValidator<T>`, `IEndpoint`, `IOutboxService`, `ConnectionStringNames` |
| `src/Modules/<M>/ArenaApi.Modules.<M>.Contracts/`                                          | Cross-module surface: `I<M>Reader`, view records, integration events, HTTP request/response DTOs   |
| `src/Modules/<M>/ArenaApi.Modules.<M>.Domain/`                                             | Aggregate roots, value objects, domain events, per-aggregate `I<Aggregate>Repository` interfaces (Content only today)  |
| `src/Modules/<M>/ArenaApi.Modules.<M>.Core/`                                               | Handlers (`<Action><Name>Handler`), commands/queries, `IValidator` impls. Refs SharedKernel + own Domain + own Contracts + other modules' Contracts |
| `src/Modules/<M>/ArenaApi.Modules.<M>.Infrastructure.Postgres/`                            | `<M>DbContext`, EF configurations, migrations, repository impls, `<M>TransactionManager`, `<M>OutboxService`, `IEndpoint` impls, `Add<M>Module()` extension |

`IdentityStub` is the smallest module — only `Contracts` (just `ICurrentUser`) and `Infrastructure` (no DbContext, no migrations). Execution and Progress carry `Contracts + Infrastructure.Postgres` skeletons; their `Domain` and `Core` appear when first feature lands.

## Module quadruple cheatsheet

```
ArenaApi.Modules.Content.Contracts                ← reader + DTOs + integration events (pure POCO)
        ↑                                          ↑
        |                                          |
ArenaApi.Modules.Content.Domain                   ArenaApi.Modules.X.Core (other modules consume Contracts only)
        ↑                                          ↑
        |                                          |
ArenaApi.Modules.Content.Core ─────────────────────┘
        ↑
        |
ArenaApi.Modules.Content.Infrastructure.Postgres   ← DbContext, EF configs, repo impls, IEndpoints, AddModule()
        ↑
        |
ArenaApi.Web                                       ← references every module's Infrastructure.Postgres
```

Cross-module dependency rule: a module's `Core` and `Infrastructure.Postgres` may only reference *other* modules' `Contracts`. The compiler enforces this — there are no ProjectReferences to other modules' `Domain` or `Infrastructure.Postgres` anywhere in the solution.

## Handler shape (the new contract)

Handlers depend on **interfaces only** — never on `DbContext`:

```csharp
public sealed class CreatePackageHandler(
    IPackageRepository repository,         // from Domain
    ITransactionManager tx,                // from SharedKernel; impl in Infrastructure.Postgres
    IOutboxService outbox,                 // from SharedKernel; impl in Infrastructure.Postgres
    IValidator<CreatePackageCommand> validator,  // from SharedKernel; impl in Core
    IClock clock)                          // from SharedKernel
{
    public async Task<Result<PackageView, Error>> HandleAsync(
        CreatePackageCommand command,
        CancellationToken ct)
    {
        if (validator.Validate(command).IsFailure) return /* error */;
        if (await repository.ExistsBySlugAsync(command.Slug, ct)) return /* conflict */;

        Result<Package, Error> create = Package.Create(command.Slug, command.Title, clock.UtcNow);
        if (create.IsFailure) return create.Error;

        await repository.AddAsync(create.Value, ct);
        await outbox.PublishAsync(new PackageCreated(...), ct);
        await tx.CommitAsync(ct);

        return new PackageView(...);
    }
}
```

The handler never sees `ContentDbContext` and is unit-testable with stub `IPackageRepository` / `ITransactionManager` (no in-memory provider needed).

## Endpoints — `IEndpoint` auto-discovery

Endpoints implement `IEndpoint` and live in `Modules/<M>/Infrastructure.Postgres/Endpoints/` (or in `Web/Features/<X>/` for host-level endpoints like Health). Scrutor scans every `ArenaApi.Modules.*.Infrastructure.Postgres` assembly and registers each `IEndpoint` as a singleton; `app.MapEndpoints()` resolves them all and calls `MapEndpoint(app)` per endpoint.

```csharp
public sealed class CreatePackageEndpoint : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/packages/", HandleAsync)
            .WithName("CreatePackage")
            .WithTags("Content");
    }

    private static async Task<...> HandleAsync(
        CreatePackageRequest request, CreatePackageHandler handler, CancellationToken ct) { ... }
}
```

No `Map<Module>Endpoints()` aggregator is needed — and none exists. Adding an endpoint is a single file in `Infrastructure.Postgres/Endpoints/`.

## Wolverine + integration events

`WolverineConfiguration.UseArenaWolverine()` registers Postgres outbox storage, RabbitMQ transport, EF Core transactional middleware, and adds each module's `Infrastructure.Postgres` assembly to handler discovery. Cross-module event flow:

1. `CreatePackageHandler` (Content.Core) builds a `PackageCreated` instance (from `Content.Contracts.IntegrationEvents`).
2. It calls `outbox.PublishAsync(packageCreated, ct)` — `ContentOutboxService` (Content.Infrastructure.Postgres) writes it to the Wolverine outbox in `arena_wolverine` schema, sharing the transaction with `ContentDbContext`.
3. `tx.CommitAsync(ct)` commits both — the row in `arena_content.packages` and the outbox envelope — atomically.
4. Wolverine's relay pumps the envelope through RabbitMQ.
5. `PackageCreatedHandler.Handle(PackageCreated, ILogger)` in `Progress.Infrastructure.Postgres/EventHandlers/` receives it.

The Progress -> Content link is expressed in `Progress.Infrastructure.Postgres.csproj` as a single `ProjectReference Include="...Content.Contracts.csproj"`. That's the *only* place a module references another module's project.

## Adding a new feature inside a module

1. Define command/query record in `Core/Features/<Action><Name>/<Action><Name>Command.cs`.
2. Define validator in `Core/Features/<Action><Name>/<Action><Name>CommandValidator.cs`.
3. Implement handler in `Core/Features/<Action><Name>/<Action><Name>Handler.cs` — depend on `I<Aggregate>Repository + ITransactionManager + IOutboxService + IValidator<T> + IClock` (subset as needed).
4. Implement `IEndpoint` in `Infrastructure.Postgres/Endpoints/<Action><Name>Endpoint.cs`. The endpoint resolves the handler from DI per-request.
5. Register the handler + validator in `Infrastructure.Postgres/<M>Module.cs::Add<M>Module`.

## Adding a new module

1. Create `src/Modules/<New>/ArenaApi.Modules.<New>.Contracts/` (csproj refs SharedKernel; add reader/views/integration events).
2. Create `src/Modules/<New>/ArenaApi.Modules.<New>.Domain/` (csproj refs SharedKernel + Contracts; add aggregates + repository interfaces).
3. Create `src/Modules/<New>/ArenaApi.Modules.<New>.Core/` (csproj refs SharedKernel + Domain + Contracts + other modules' Contracts; add handlers + validators).
4. Create `src/Modules/<New>/ArenaApi.Modules.<New>.Infrastructure.Postgres/` (csproj refs SharedKernel + Core + Domain + Contracts + EF + Wolverine; add DbContext, EF configs, repo impls, `<New>TransactionManager`, `<New>OutboxService`, `IEndpoint`s, `<New>Module.Add<New>Module()`).
5. Register module in `Web/Program.cs`: `.Add<New>Module(builder.Configuration)`.
6. Add the assembly to `EndpointAutoDiscovery`: `AddEndpointsFromAssemblies(..., typeof(<New>Module).Assembly)`.
7. Add the assembly to Wolverine discovery: `opts.Discovery.IncludeAssembly(typeof(<New>Module).Assembly)`.
8. Add `arena_<new>` to `docker/postgres/init.sql`.
9. Generate first migration: `dotnet ef migrations add <New>Initial --project src/Modules/<New>/ArenaApi.Modules.<New>.Infrastructure.Postgres --startup-project src/ArenaApi.Web --context <New>DbContext`.

## Per-module schemas

`arena_content`, `arena_execution`, `arena_progress`, `arena_identity`. Wolverine envelopes live in `arena_wolverine`. There is no global `arena` schema.

## Conventions

- **Compile-time module isolation.** `Modules.X.{Core, Infrastructure.Postgres}` may not reference `Modules.Y.{Domain, Infrastructure.Postgres}` — only `Modules.Y.Contracts`. Enforced by ProjectReference graph; one belt-and-suspenders runtime check in `tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs`.
- **`public sealed` for aggregates** that cross csproj boundaries inside the same module (Domain -> Infrastructure.Postgres). `internal` is per-assembly and won't reach the repository implementation.
- **Per-aggregate repositories.** No generic `IRepository<T>`. Each aggregate root gets its own interface in `Domain/Repositories/` and an EF impl in `Infrastructure.Postgres/Persistence/`.
- **`Guid.CreateVersion7()`** in domain factories. `Guid.NewGuid()` banned (`backend/BannedSymbols.txt`).
- **`Result<T, Error>`** for business outcomes — no exceptions.
- **Never modify existing migrations.** Add a corrective one. Each module's migrations live in `Infrastructure.Postgres/Migrations/`.
- Connection-string keys are `Database`, `RabbitMq`, `Redis` — constants in `SharedKernel/ConnectionStringNames.cs`.
```

- [ ] **Step 2: Commit.**

```bash
git add backend/ArenaApi/CLAUDE.md
git commit -m "docs(backend): rewrite service memory for Clean-Architecture-per-module layout"
```

---

## Task 17: Delete legacy `ArenaApi.Core`, `ArenaApi.Contracts`, `ArenaApi.Infrastructure` projects

**Goal:** With nothing referencing them and the solution + tests + Web running on the new layout, the three legacy projects can disappear. Removal happens in three sub-steps (one per project) so reviewers can verify each in isolation.

**Files:**
- Delete: `backend/ArenaApi/src/ArenaApi.Core/` (entire directory)
- Delete: `backend/ArenaApi/src/ArenaApi.Contracts/` (entire directory)
- Delete: `backend/ArenaApi/src/ArenaApi.Infrastructure/` (entire directory)
- Modify: `backend/arena.slnx` (remove the three `<Project>` entries)

- [ ] **Step 1: Remove projects from the solution.**

```bash
dotnet sln backend/arena.slnx remove backend/ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj
dotnet sln backend/arena.slnx remove backend/ArenaApi/src/ArenaApi.Contracts/ArenaApi.Contracts.csproj
dotnet sln backend/arena.slnx remove backend/ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj
```

Verify `backend/arena.slnx` no longer contains any of the three paths:

```bash
grep -E "ArenaApi\.(Core|Contracts|Infrastructure)\.csproj" backend/arena.slnx || echo "clean"
```

Expected: `clean`.

- [ ] **Step 2: Delete the directories.**

```bash
rm -rf backend/ArenaApi/src/ArenaApi.Core
rm -rf backend/ArenaApi/src/ArenaApi.Contracts
rm -rf backend/ArenaApi/src/ArenaApi.Infrastructure
```

- [ ] **Step 3: Rebuild the entire solution.**

```bash
dotnet build backend/arena.slnx -nologo --no-incremental
```

Expected: `Build succeeded` with 0 errors. If anything fails, an undiscovered `using ArenaApi.Core.*` / `using ArenaApi.Contracts.*` is still in scope — grep:

```bash
grep -rn "using ArenaApi\.\(Core\|Contracts\|Infrastructure\)" backend/ArenaApi --include="*.cs" || echo "clean"
```

Expected: `clean`. (The only legitimate remaining references would be in `ArenaApi.IntegrationTests/bin/**` — those are stale build artifacts; they disappear after the next clean build.)

- [ ] **Step 4: Re-run the entire test suite.**

```bash
dotnet test backend/arena.slnx --nologo --logger "console;verbosity=minimal" 2>&1 | tail -10
```

Expected: same green count as Task 15 Step 2.

- [ ] **Step 5: Stage the deletions and commit.**

`git rm` handles directory removal cleanly:

```bash
git add backend/arena.slnx
git add -u backend/ArenaApi/src/ArenaApi.Core backend/ArenaApi/src/ArenaApi.Contracts backend/ArenaApi/src/ArenaApi.Infrastructure
git commit -m "chore: delete legacy ArenaApi.Core, ArenaApi.Contracts, ArenaApi.Infrastructure projects"
```

(`git add -u` registers the deletions because the working-tree files are already gone; the new `.slnx` content is staged via the separate `git add`.)

---

## Done

The restructure is complete. The repo now matches the Clean-Architecture-per-module layout declared in `/Users/dev/code/sharp.arena/CLAUDE.md`. Phase 1.1 (Content catalog) and Phase 1 (mvp-loop) replans land on top of this in subsequent sessions; both can be written against the new layout from the start.

### Verification checklist (final)

- [ ] `dotnet build backend/arena.slnx -nologo --no-incremental` — `Build succeeded`, 0 errors, 0 warnings.
- [ ] `dotnet test backend/arena.slnx --nologo` — all green; matches expected count (baseline - 2 net after the architecture-test slimdown + 2 new endpoint-discovery tests).
- [ ] `find backend/ArenaApi/src -name "*.csproj" | sort` shows exactly 10 csprojs: SharedKernel, Web, IdentityStub.Contracts, IdentityStub.Infrastructure, Content.Contracts, Content.Domain, Content.Core, Content.Infrastructure.Postgres, Execution.Contracts, Execution.Infrastructure.Postgres, Progress.Contracts, Progress.Infrastructure.Postgres. (Count: 12 — SharedKernel + Web + 10 module projects.)
- [ ] `grep -E "Modules\.(Content|Execution|Progress)\." backend/ArenaApi/src/Modules/*/ArenaApi.Modules.*.csproj | grep ProjectReference` shows no `Modules.<X>.{Domain,Infrastructure.Postgres}` references inside another module's csproj — only `Modules.<X>.Contracts` references cross module lines (today only `Progress.Infrastructure.Postgres -> Content.Contracts`).
- [ ] `curl http://localhost:5000/health/` returns 200 (when host is running).
- [ ] `POST /api/packages/` returns 201 and the `Progress module received PackageCreated for ...` log line appears (when host is running with Postgres + RabbitMQ).
- [ ] The Phase 1.1 plan (`docs/superpowers/plans/2026-05-24-phase-1-1-content-catalog-backend.md`) is now **stale** — its file paths reference `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/...`. Flag the user that it needs a rewrite on the new layout before execution. (Same applies to `2026-05-24-phase-1-mvp-loop.md` for Execution module additions.)
