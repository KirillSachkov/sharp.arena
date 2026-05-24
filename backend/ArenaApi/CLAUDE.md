# ArenaApi — service memory

Single .NET 10 service powering Sharp Arena, structured as a **modular
monolith** with **Clean Architecture per module**. One Web host wires
every module's `Add<Module>Infrastructure` extension into a single DI
container; auto-discovery (Scrutor + reflection) registers handlers,
validators, and endpoints from each module's Core assembly.

## Layout

| Project                                                                                | Owns                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/ArenaApi.Web`                                                                     | Minimal API host, `Program.cs`, `appsettings.*.json`, Wolverine wiring, module DI     |
| `src/ArenaApi.SharedKernel`                                                            | Cross-cutting primitives + abstractions (see below)                                   |
| `src/Modules/<Name>/ArenaApi.Modules.<Name>.Contracts/`                                | Cross-module surface: HTTP DTOs, `I<X>Reader`, view DTOs, integration events          |
| `src/Modules/<Name>/ArenaApi.Modules.<Name>.Domain/`                                   | Aggregates, value objects, domain events (Content only — skeletons skip this)         |
| `src/Modules/<Name>/ArenaApi.Modules.<Name>.Core/`                                     | `Database/` (interfaces), `Features/<Area>/UseCases/<Action>.cs` (vertical slice)     |
| `src/Modules/<Name>/ArenaApi.Modules.<Name>.Infrastructure.Postgres/`                  | `<Name>DbContext`, Configurations, repository impls, `TransactionManager`, `OutboxService` impl, `DependencyInjectionExtensions`, Migrations |

## SharedKernel — what each subfolder owns

| Subfolder                          | Purpose                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `Abstractions/`                    | `ICommand`, `ICommandHandler<TResp,TCmd>`, `ICommandHandlerUnit<TCmd>`, `IQuery`, `IQueryHandler<TResp,TQuery>`, `IQueryHandlerWithResult<TResp,TQuery>`, `AddHandlers(assemblies)` (Scrutor scan) |
| `Database/`                        | `ITransactionManager` (interface; per-module impl)                                            |
| `Endpoints/`                       | `IEndpoint`, `AddEndpoints(assembly)` + `app.MapEndpoints()` (reflection-based auto-mapping)  |
| `DomainEvents/`                    | `IDomainEvent`, `IHasDomainEvents` marker interfaces                                          |
| `Errors/`                          | `Error` record (Code + Message), `CommonErrors`                                               |
| `Identifiers/`                     | `TimeOrderedGuidValueGenerator` (EF Core value generator for `Guid.CreateVersion7()`)         |
| `Outbox/`                          | Legacy `IOutboxService` — kept during transition; per-module `IOutboxService` now lives in `<Module>.Core/Database/` |
| `Time/`                            | `IClock` interface + `SystemClock` impl. `SharedKernelServiceCollectionExtensions.AddSharedKernel()` registers `IClock` → `SystemClock`. |
| `ConnectionStringNames.cs`         | constants: `Database`, `RabbitMq`, `Redis`                                                    |

## Reference graph (one-way)

```
SharedKernel       ← (no internal refs)

Contracts          → SharedKernel
Domain             → SharedKernel
Core               → Domain, Contracts, SharedKernel
Infrastructure.Postgres → Core, Domain, SharedKernel    [Domain only for Content]
Web                → SharedKernel, every module's Core + Infrastructure.Postgres + Contracts (transitively)
```

Cross-module: `Progress.Core` → `Content.Contracts` is the only inter-module reference (PackageCreatedHandler consumes `PackageCreated` integration event).

## Phase 0 status

- **Content** is fully wired: `Package` aggregate (Domain), `IPackagesRepository`/`PackagesRepository`, `CreatePackage.cs` (Endpoint + Command + Validator + Handler in one file), Migration `ContentInitial`, integration-event publish.
- **Execution**, **Progress** ship as skeletons — DbContext + OutboxService + TransactionManager only. No aggregates, no migrations yet.
- **Progress** also has `PackageCreatedHandler` (Wolverine subscriber) in `Core/EventHandlers/` — the only consumer of a cross-module Contracts integration event.
- **IdentityStub** binds `ICurrentUser → StubCurrentUser` from `appsettings:IdentityStub:HardcodedUserId`. No DB; the third project is named `Infrastructure` (no `.Postgres`).

## Handler shape (vertical-slice convention)

`<Module>.Core/Features/<Area>/UseCases/<Action>.cs` contains four public sealed classes in one file:

```csharp
public sealed class <Action>Endpoint : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapPost(..., HandleAsync);
}

public sealed record <Action>Command(...) : ICommand;

public sealed class <Action>Validator : AbstractValidator<<Action>Command> { ... }

public sealed class <Action>Handler(
    I<X>Repository repository,
    IValidator<<Action>Command> validator,
    IOutboxService outbox,
    ITransactionManager transactions,
    IClock clock) : ICommandHandler<TResponse, <Action>Command>
{
    public async Task<Result<TResponse, Error>> Handle(<Action>Command command, CancellationToken ct) { ... }
}
```

A `#pragma warning disable MA0048` is required at the top of the file because Meziantou enforces one-type-per-file. Pragma is per-file, scoped.

## Adding a new feature inside a module

1. Create `Modules/<M>/ArenaApi.Modules.<M>.Core/Features/<Area>/UseCases/<Action>.cs` with the 4-class shape above.
2. If you need a new repository method, extend `<M>.Core/Database/I<X>Repository.cs` and the impl in `<M>.Infrastructure.Postgres/<X>Repository.cs`.
3. No DI wiring needed — handlers/validators/endpoints are auto-discovered by `AddHandlers/AddValidatorsFromAssembly/AddEndpoints` in `Program.cs`.

## Adding a new module

1. Create `Modules/<New>/ArenaApi.Modules.<New>.{Contracts, Domain, Core, Infrastructure.Postgres}` four csproj projects (or three if no Domain yet).
2. Add `<New>DbContext` in `Infrastructure.Postgres/` with `public const string SchemaName = "arena_<new>"` and `modelBuilder.HasDefaultSchema(SchemaName)` in `OnModelCreating`.
3. Add module-scoped `IOutboxService` interface in `<New>.Core/Database/`; `OutboxService` impl in Infrastructure.Postgres.
4. Add `Infrastructure.Postgres/Database/TransactionManager.cs` (copy from existing modules — same shape, only DbContext type changes).
5. Add `Infrastructure.Postgres/DependencyInjectionExtensions.cs` with `Add<New>Infrastructure(IServiceCollection, IConfiguration)` registering DbContext + repos + IOutboxService + ITransactionManager.
6. Add the new csproj entries to `arena.slnx` and add `ProjectReference` entries to `ArenaApi.Web.csproj`.
7. Register schema in `docker/postgres/init.sql`.
8. Add `services.Add<New>Infrastructure(...)` call in `Program.cs`. Add `typeof(<New>CoreAssemblyMarker).Assembly` to the `moduleCoreAssemblies` array so handlers/validators/endpoints get auto-discovered.
9. Generate first migration:

```bash
dotnet ef migrations add <Name> \
  --project src/Modules/<New>/ArenaApi.Modules.<New>.Infrastructure.Postgres/ArenaApi.Modules.<New>.Infrastructure.Postgres.csproj \
  --startup-project src/ArenaApi.Web/ArenaApi.Web.csproj \
  --context <New>DbContext \
  --output-dir Migrations
```

## Conventions

- Module boundaries enforced by csproj ProjectReference graph; no NetArchTest.
- Per-module schemas: `arena_content`, `arena_execution`, `arena_progress`, `arena_identity`. Wolverine envelopes live in `arena_wolverine`.
- Cross-module communication: (a) sync read via `I<Other>Reader` (from `<Other>.Contracts`); (b) async via Wolverine integration events from `<Other>.Contracts.IntegrationEvents/`.
- Handlers never see DbContext. Repositories abstract data access.
- `Guid.CreateVersion7()` in domain factories. `Guid.NewGuid()` is banned (`backend/BannedSymbols.txt`).
- `Result<T, Error>` for business outcomes — no exceptions.
- Never modify existing migrations. Add a corrective one.
- Connection strings: `Database`, `RabbitMq`, `Redis` — constants in `SharedKernel/ConnectionStringNames.cs`.
- Wolverine setup in `Web/Configuration/WolverineConfiguration.cs`, invoked via `builder.UseArenaWolverine()`.
