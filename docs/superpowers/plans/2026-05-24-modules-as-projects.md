# Modules-as-Projects Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split each module out of `ArenaApi.Core/Modules/<Name>/` (current single-assembly modular monolith) into its own set of csproj projects, leaving a single `ArenaApi.Web` orchestrator. After the refactor, module isolation is enforced at the compiler level via ProjectReferences, not via NetArchTest rules.

**Architecture:** Per-module project layout `ArenaApi.Modules.<Name>.{Public,Domain,Application,Infrastructure.Postgres}`. Single DI container in `ArenaApi.Web`. Shared primitives (Error, IClock, IDomainEvent, IOutboxService, ConnectionStringNames) live in a new `ArenaApi.SharedKernel` project. `ArenaApi.Core` and `ArenaApi.Infrastructure` are deleted at the end.

**Tech Stack:** .NET 10, EF Core 10 + Npgsql.EntityFrameworkCore.PostgreSQL, WolverineFx 5.39.3, RabbitMQ, Postgres durable outbox, xUnit + NetArchTest + Testcontainers.

---

## Locked design decisions (do NOT re-debate)

1. **Naming:** `ArenaApi.Modules.<Name>.<Layer>` (e.g., `ArenaApi.Modules.Content.Domain`).
2. **Project count per module:**
   - **Content** (full module): 4 projects — Public, Domain, Application, Infrastructure.Postgres.
   - **Execution**, **Progress** (skeletons): 3 projects — Public, Application, Infrastructure.Postgres. Domain is omitted until the first aggregate appears.
   - **IdentityStub** (no DB): 3 projects — Public, Application, Infrastructure (no `.Postgres` suffix).
3. **Shared primitives:** `ArenaApi.Core` is renamed to `ArenaApi.SharedKernel`. Only `Shared/` content + `ConnectionStringNames.cs` survives.
4. **Health endpoint** moves to `ArenaApi.Web/Health/` (non-module, host-owned).
5. **`ArenaApi.Infrastructure`** (empty reserved shell) is deleted. Future cross-cutting infra projects can be added when concrete need appears.
6. **Layer responsibility (cross-cutting policy):**
   - **Domain** — pure types (aggregates, value objects, domain events). Only depends on SharedKernel.
   - **Public** — cross-module contract surface (`IXxxReader`, view DTOs, integration events). Only depends on SharedKernel.
   - **Application** — vertical slice: `<Module>DbContext`, EF `Configurations/`, command/query handlers, endpoints, `<Module>OutboxService` (Wolverine wrapper). EF and Wolverine NuGets land here. Depends on Domain + Public + Contracts + SharedKernel.
   - **Infrastructure.Postgres** — physical persistence wiring: `<Module>DbContextDesignTimeFactory`, `Migrations/`, `<Module>Reader` (implementation of the Public reader), and the module registration extension `Add<Module>Module()`. Depends on Domain + Application + SharedKernel.
   - **Why DbContext lives in Application, not Infrastructure.Postgres:** vertical-slice handlers depend on it directly. Putting it in Application keeps `Application → Infrastructure.Postgres` references **one-way** (Infrastructure depends on Application, never the reverse). This is a deliberate pragmatic deviation from textbook Clean Architecture, justified by the existing handler convention (CLAUDE.md: "Handlers depend on the module's `DbContext` for writes").
7. **Module DI registration** (`Add<Module>Module()`) lives in **Infrastructure.Postgres**, because that's the project that can see both the DbContext (Application) and the Public-interface implementation (Infrastructure.Postgres own). Endpoint mapping (`Map<Module>Endpoints()`) stays in **Application** alongside the endpoints.
8. **NetArchTest** boundary tests are **deleted**. The C# compiler now enforces module isolation via csproj references. `tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs` is removed. The `NetArchTest.Rules` package reference is removed from `Directory.Packages.props` if no other test uses it.
9. **EF migration files** are namespace-renamed in place. The SQL output is byte-for-byte identical — this is a package-move bookkeeping change, not a logic change, so it does **not** violate the "never modify existing migrations" rule.
10. **Wolverine handler discovery:** each module's Application project exposes a `public sealed class <Module>ApplicationAssemblyMarker;` type used in `WolverineConfiguration.cs` for `opts.Discovery.IncludeAssembly(typeof(<Module>ApplicationAssemblyMarker).Assembly)`.

---

## Target structure (post-refactor)

```
backend/
├── arena.slnx
├── Directory.Build.props
├── Directory.Packages.props
├── BannedSymbols.txt
├── .globalconfig
└── ArenaApi/
    ├── CLAUDE.md
    ├── src/
    │   ├── ArenaApi.Web/                                    # orchestrator (existing)
    │   │   ├── Program.cs                                   # wires all modules
    │   │   ├── Configuration/WolverineConfiguration.cs      # Wolverine + RabbitMQ + outbox
    │   │   ├── Health/                                      # NEW: moved from Core/Features/Health/
    │   │   │   ├── HealthEndpoints.cs
    │   │   │   └── HealthResponse.cs
    │   │   └── appsettings*.json
    │   ├── ArenaApi.SharedKernel/                           # NEW: was ArenaApi.Core (Shared/ + ConnectionStringNames)
    │   │   ├── ArenaApi.SharedKernel.csproj
    │   │   ├── ConnectionStringNames.cs
    │   │   ├── Errors/{Error.cs, CommonErrors.cs}
    │   │   ├── DomainEvents/{IDomainEvent.cs, IHasDomainEvents.cs}
    │   │   ├── Time/{IClock.cs, SystemClock.cs}
    │   │   ├── Identifiers/TimeOrderedGuidValueGenerator.cs
    │   │   └── Outbox/IOutboxService.cs
    │   ├── ArenaApi.Contracts/                              # existing, unchanged
    │   └── Modules/
    │       ├── Content/
    │       │   ├── ArenaApi.Modules.Content.Public/
    │       │   │   ├── ArenaApi.Modules.Content.Public.csproj
    │       │   │   ├── IContentReader.cs
    │       │   │   ├── PackageView.cs
    │       │   │   └── IntegrationEvents/PackageCreated.cs
    │       │   ├── ArenaApi.Modules.Content.Domain/
    │       │   │   ├── ArenaApi.Modules.Content.Domain.csproj
    │       │   │   ├── Package.cs
    │       │   │   └── DomainEvents/PackageCreatedDomainEvent.cs
    │       │   ├── ArenaApi.Modules.Content.Application/
    │       │   │   ├── ArenaApi.Modules.Content.Application.csproj
    │       │   │   ├── ContentApplicationAssemblyMarker.cs
    │       │   │   ├── ContentDbContext.cs                  # moved from Infrastructure/
    │       │   │   ├── ContentOutboxService.cs              # moved from Infrastructure/
    │       │   │   ├── ContentEndpoints.cs                  # MapContentEndpoints (split from old ContentModule.cs)
    │       │   │   ├── Configurations/PackageConfiguration.cs
    │       │   │   └── Features/CreatePackage/
    │       │   │       ├── CreatePackageCommand.cs
    │       │   │       ├── CreatePackageHandler.cs
    │       │   │       └── CreatePackageEndpoint.cs
    │       │   └── ArenaApi.Modules.Content.Infrastructure.Postgres/
    │       │       ├── ArenaApi.Modules.Content.Infrastructure.Postgres.csproj
    │       │       ├── ContentModule.cs                     # AddContentModule (registers DbContext + handlers + reader + outbox)
    │       │       ├── ContentDbContextDesignTimeFactory.cs
    │       │       ├── ContentReader.cs
    │       │       └── Migrations/
    │       │           ├── 20260520121238_ContentInitial.cs
    │       │           ├── 20260520121238_ContentInitial.Designer.cs
    │       │           └── ContentDbContextModelSnapshot.cs
    │       ├── Execution/
    │       │   ├── ArenaApi.Modules.Execution.Public/                            # AssemblyMarker only (skeleton)
    │       │   ├── ArenaApi.Modules.Execution.Application/                       # ExecutionDbContext + ExecutionOutboxService + AssemblyMarker
    │       │   └── ArenaApi.Modules.Execution.Infrastructure.Postgres/           # ExecutionDbContextDesignTimeFactory + ExecutionModule
    │       ├── Progress/
    │       │   ├── ArenaApi.Modules.Progress.Public/                             # AssemblyMarker only
    │       │   ├── ArenaApi.Modules.Progress.Application/                        # ProgressDbContext + ProgressOutboxService + EventHandlers/PackageCreatedHandler + AssemblyMarker
    │       │   └── ArenaApi.Modules.Progress.Infrastructure.Postgres/            # ProgressDbContextDesignTimeFactory + ProgressModule
    │       └── IdentityStub/
    │           ├── ArenaApi.Modules.IdentityStub.Public/                         # ICurrentUser
    │           ├── ArenaApi.Modules.IdentityStub.Application/                    # IdentityStubOptions + AssemblyMarker
    │           └── ArenaApi.Modules.IdentityStub.Infrastructure/                 # StubCurrentUser + IdentityStubModule
    └── tests/
        ├── ArenaApi.UnitTests/                              # SmokeTests stays; ModuleBoundariesTests DELETED
        └── ArenaApi.IntegrationTests/                       # WebFactory references updated for new namespaces
```

**Project reference graph after the refactor (one-way arrows):**

```
SharedKernel    ← (no internal refs)
Contracts       ← (no internal refs)

Modules.Content.Public          → SharedKernel
Modules.Content.Domain          → SharedKernel
Modules.Content.Application     → Modules.Content.Domain, Modules.Content.Public, Contracts, SharedKernel
Modules.Content.Infrastructure.Postgres → Modules.Content.Domain, Modules.Content.Application, SharedKernel

Modules.Execution.Public        → SharedKernel
Modules.Execution.Application   → Modules.Execution.Public, SharedKernel
Modules.Execution.Infrastructure.Postgres → Modules.Execution.Application, SharedKernel

Modules.Progress.Public         → SharedKernel
Modules.Progress.Application    → Modules.Progress.Public, Modules.Content.Public, SharedKernel
Modules.Progress.Infrastructure.Postgres → Modules.Progress.Application, SharedKernel

Modules.IdentityStub.Public     → (none)
Modules.IdentityStub.Application → Modules.IdentityStub.Public, SharedKernel
Modules.IdentityStub.Infrastructure → Modules.IdentityStub.Application, Modules.IdentityStub.Public

Web → SharedKernel, Contracts,
      all four Content projects,
      all three Execution projects,
      all three Progress projects,
      all three IdentityStub projects
```

`Progress.Application → Content.Public` is the only cross-module reference and is intentional: `PackageCreatedHandler` consumes the `PackageCreated` integration event published by Content.

---

## Task list (execute in order)

| # | Task                                                                 |
| - | -------------------------------------------------------------------- |
| 1 | Add `ArenaApi.SharedKernel`; rename `ArenaApi.Core` content into it  |
| 2 | Extract Content module into 4 projects                               |
| 3 | Extract Execution module into 3 projects                             |
| 4 | Extract Progress module into 3 projects                              |
| 5 | Extract IdentityStub module into 3 projects                          |
| 6 | Move Health to Web; delete `ArenaApi.Core` + `ArenaApi.Infrastructure` |
| 7 | Update Web (Program.cs, WolverineConfiguration, csproj refs)         |
| 8 | Update integration tests; delete `ModuleBoundariesTests`             |
| 9 | Final verification + update CLAUDE.md, docs/ARCHITECTURE.md, .claude/rules |

---

### Task 1: Add `ArenaApi.SharedKernel` and migrate primitives

**Goal:** Stand up a new `ArenaApi.SharedKernel` project containing exactly the current contents of `ArenaApi.Core/Shared/` plus `ArenaApi.Core/ConnectionStringNames.cs`. Repoint `ArenaApi.Core.csproj` to reference SharedKernel (so old `Modules/*` still compile during the transition).

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.SharedKernel/ArenaApi.SharedKernel.csproj`
- Create (via `git mv` + edit):
  - `backend/ArenaApi/src/ArenaApi.SharedKernel/ConnectionStringNames.cs` (from `ArenaApi.Core/ConnectionStringNames.cs`)
  - `backend/ArenaApi/src/ArenaApi.SharedKernel/Errors/Error.cs`
  - `backend/ArenaApi/src/ArenaApi.SharedKernel/Errors/CommonErrors.cs`
  - `backend/ArenaApi/src/ArenaApi.SharedKernel/DomainEvents/IDomainEvent.cs`
  - `backend/ArenaApi/src/ArenaApi.SharedKernel/DomainEvents/IHasDomainEvents.cs`
  - `backend/ArenaApi/src/ArenaApi.SharedKernel/Time/IClock.cs`
  - `backend/ArenaApi/src/ArenaApi.SharedKernel/Time/SystemClock.cs`
  - `backend/ArenaApi/src/ArenaApi.SharedKernel/Identifiers/TimeOrderedGuidValueGenerator.cs`
  - `backend/ArenaApi/src/ArenaApi.SharedKernel/Outbox/IOutboxService.cs`
- Modify: `backend/ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj` (add ProjectReference to SharedKernel; trim duplicated package refs that SharedKernel now owns)
- Modify: `backend/arena.slnx` (add SharedKernel project entry)
- Modify (sed namespace rename across remaining `ArenaApi.Core/Modules/*` and `ArenaApi.Web/*` and tests): every `ArenaApi.Core.Shared.X` → `ArenaApi.SharedKernel.X`, every `ArenaApi.Core.ConnectionStringNames` → `ArenaApi.SharedKernel.ConnectionStringNames`

**- [ ] Step 1.1: Create `ArenaApi.SharedKernel.csproj`**

Write `backend/ArenaApi/src/ArenaApi.SharedKernel/ArenaApi.SharedKernel.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="CSharpFunctionalExtensions" />
    <PackageReference Include="Microsoft.EntityFrameworkCore" />
  </ItemGroup>
</Project>
```

Rationale:
- `CSharpFunctionalExtensions` — for `Result<T, Error>` used by callers.
- `Microsoft.EntityFrameworkCore` — for `ValueGenerator` base class used by `TimeOrderedGuidValueGenerator`.

**- [ ] Step 1.2: `git mv` the eight Shared files + `ConnectionStringNames.cs` into the new project**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects

mkdir -p backend/ArenaApi/src/ArenaApi.SharedKernel/{Errors,DomainEvents,Time,Identifiers,Outbox}

git mv backend/ArenaApi/src/ArenaApi.Core/ConnectionStringNames.cs                     backend/ArenaApi/src/ArenaApi.SharedKernel/ConnectionStringNames.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Shared/Errors/Error.cs                       backend/ArenaApi/src/ArenaApi.SharedKernel/Errors/Error.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Shared/Errors/CommonErrors.cs                backend/ArenaApi/src/ArenaApi.SharedKernel/Errors/CommonErrors.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Shared/DomainEvents/IDomainEvent.cs          backend/ArenaApi/src/ArenaApi.SharedKernel/DomainEvents/IDomainEvent.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Shared/DomainEvents/IHasDomainEvents.cs      backend/ArenaApi/src/ArenaApi.SharedKernel/DomainEvents/IHasDomainEvents.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Shared/Time/IClock.cs                        backend/ArenaApi/src/ArenaApi.SharedKernel/Time/IClock.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Shared/Time/SystemClock.cs                   backend/ArenaApi/src/ArenaApi.SharedKernel/Time/SystemClock.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Shared/Identifiers/TimeOrderedGuidValueGenerator.cs backend/ArenaApi/src/ArenaApi.SharedKernel/Identifiers/TimeOrderedGuidValueGenerator.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Shared/Outbox/IOutboxService.cs              backend/ArenaApi/src/ArenaApi.SharedKernel/Outbox/IOutboxService.cs

rmdir backend/ArenaApi/src/ArenaApi.Core/Shared/{Errors,DomainEvents,Time,Identifiers,Outbox} backend/ArenaApi/src/ArenaApi.Core/Shared
```

**- [ ] Step 1.3: Update namespace inside each moved file**

For each of the 9 moved files, replace `namespace ArenaApi.Core.Shared.<Subns>` → `namespace ArenaApi.SharedKernel.<Subns>` (and `namespace ArenaApi.Core;` → `namespace ArenaApi.SharedKernel;` for ConnectionStringNames). Use `Edit` per file. Final namespaces:

- `ArenaApi.SharedKernel` (ConnectionStringNames.cs)
- `ArenaApi.SharedKernel.Errors` (Error.cs, CommonErrors.cs)
- `ArenaApi.SharedKernel.DomainEvents` (IDomainEvent.cs, IHasDomainEvents.cs)
- `ArenaApi.SharedKernel.Time` (IClock.cs, SystemClock.cs)
- `ArenaApi.SharedKernel.Identifiers` (TimeOrderedGuidValueGenerator.cs)
- `ArenaApi.SharedKernel.Outbox` (IOutboxService.cs)

Also fix any `using` inside the moved files that still says `using ArenaApi.Core.Shared.X;` — replace with `using ArenaApi.SharedKernel.X;`. (Currently the only intra-Shared `using` is in `IHasDomainEvents` referencing `IDomainEvent`; both in the same `DomainEvents` subnamespace, so no `using` change needed.)

**- [ ] Step 1.4: Find-and-replace every old reference across the repo**

The following files reference the old `ArenaApi.Core.Shared.*` or `ArenaApi.Core.ConnectionStringNames` namespaces (verified via grep at plan-write time). Update each with `Edit`:

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/ContentModule.cs`
- `using ArenaApi.Core.Shared.Time;` → `using ArenaApi.SharedKernel.Time;`
- `ArenaApi.Core.ConnectionStringNames.Database` → `ArenaApi.SharedKernel.ConnectionStringNames.Database`

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Package.cs`
- `using ArenaApi.Core.Shared.DomainEvents;` → `using ArenaApi.SharedKernel.DomainEvents;`
- `using ArenaApi.Core.Shared.Errors;` → `using ArenaApi.SharedKernel.Errors;`

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageHandler.cs`
- `using ArenaApi.Core.Shared.Errors;` → `using ArenaApi.SharedKernel.Errors;`
- `using ArenaApi.Core.Shared.Time;` → `using ArenaApi.SharedKernel.Time;`

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageEndpoint.cs`
- `using ArenaApi.Core.Shared.Errors;` → `using ArenaApi.SharedKernel.Errors;`

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentOutboxService.cs`
- `using ArenaApi.Core.Shared.Outbox;` → `using ArenaApi.SharedKernel.Outbox;`

`backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/ExecutionModule.cs`
- `ArenaApi.Core.ConnectionStringNames.Database` → `ArenaApi.SharedKernel.ConnectionStringNames.Database`

`backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionOutboxService.cs`
- `using ArenaApi.Core.Shared.Outbox;` → `using ArenaApi.SharedKernel.Outbox;`

`backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/ProgressModule.cs`
- `ArenaApi.Core.ConnectionStringNames.Database` → `ArenaApi.SharedKernel.ConnectionStringNames.Database`

`backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/Infrastructure/ProgressOutboxService.cs`
- `using ArenaApi.Core.Shared.Outbox;` → `using ArenaApi.SharedKernel.Outbox;`

`backend/ArenaApi/src/ArenaApi.Web/Program.cs`
- `using ArenaApi.Core;` → `using ArenaApi.SharedKernel;`
- (Other `ArenaApi.Core.*` usings stay for now — they get replaced in later tasks.)

`backend/ArenaApi/src/ArenaApi.Web/Configuration/WolverineConfiguration.cs`
- `using ArenaApi.Core;` → `using ArenaApi.SharedKernel;`

Search command to verify nothing is missed:

```bash
grep -rn "ArenaApi\.Core\.Shared\|ArenaApi\.Core\.ConnectionStringNames" \
  backend/ArenaApi/src backend/ArenaApi/tests --include="*.cs"
```

Expected after the edits: 0 hits.

**- [ ] Step 1.5: Modify `ArenaApi.Core.csproj` to reference SharedKernel and drop now-unneeded packages**

Rewrite `backend/ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj` to:

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
    <ProjectReference Include="..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
  </ItemGroup>
</Project>
```

(Package list is unchanged from current; only the new `ProjectReference` line is added.)

**- [ ] Step 1.6: Add SharedKernel to `backend/arena.slnx`**

Open `backend/arena.slnx`. Inside `<Folder Name="/ArenaApi/">`, add the new project as the **first** entry (before Contracts) — alphabetical order would put SharedKernel last but the project graph reads better with foundational projects first. Use Edit with this block:

Replace:
```xml
  <Folder Name="/ArenaApi/">
    <Project Path="ArenaApi/src/ArenaApi.Contracts/ArenaApi.Contracts.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj" />
  </Folder>
```

With:
```xml
  <Folder Name="/ArenaApi/">
    <Project Path="ArenaApi/src/ArenaApi.SharedKernel/ArenaApi.SharedKernel.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Contracts/ArenaApi.Contracts.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj" />
  </Folder>
```

**- [ ] Step 1.7: Build**

Run: `cd backend && dotnet build arena.slnx --nologo`

Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`.

If any unresolved `ArenaApi.Core.Shared.*` or `ArenaApi.Core.ConnectionStringNames` references appear, return to Step 1.4 and fix.

**- [ ] Step 1.8: Run unit + architecture tests (non-Docker)**

```bash
cd backend
dotnet test arena.slnx --nologo \
  --filter "FullyQualifiedName!~CreatePackageEndpointTests&FullyQualifiedName!~HealthEndpointTests"
```

Expected: `Passed!  - Failed:     0, Passed:     6, Skipped:     0, Total:     6` (1 SmokeTest + 5 ModuleBoundariesTests).

The architecture tests still pass because they validate namespace patterns; we haven't broken any pattern yet — we just added SharedKernel which is outside their scope.

**- [ ] Step 1.9: Commit**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects
git add -A
git commit -m "refactor: extract ArenaApi.SharedKernel from ArenaApi.Core

Moves Shared/ primitives and ConnectionStringNames into a new
ArenaApi.SharedKernel csproj. ArenaApi.Core still exists and now
references SharedKernel; subsequent commits will extract Modules/<Name>/
into their own per-module project sets, and the final commit will
delete ArenaApi.Core entirely."
```

---

### Task 2: Extract Content module into 4 projects

**Goal:** Move every file under `ArenaApi.Core/Modules/Content/` into the new project structure:

- `ArenaApi.Modules.Content.Public` (3 files)
- `ArenaApi.Modules.Content.Domain` (2 files)
- `ArenaApi.Modules.Content.Application` (8 files: DbContext, ContentOutboxService, ContentEndpoints, PackageConfiguration, 3 CreatePackage files, AssemblyMarker)
- `ArenaApi.Modules.Content.Infrastructure.Postgres` (6 files: ContentModule, ContentReader, ContentDbContextDesignTimeFactory, 3 migration files)

`ArenaApi.Core/Modules/Content/` is deleted at the end of this task.

**- [ ] Step 2.1: Create the four Content csproj files**

Write `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Public/ArenaApi.Modules.Content.Public.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
  </ItemGroup>
</Project>
```

Write `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/ArenaApi.Modules.Content.Domain.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="CSharpFunctionalExtensions" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
  </ItemGroup>
</Project>
```

Write `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Application/ArenaApi.Modules.Content.Application.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />

    <PackageReference Include="CSharpFunctionalExtensions" />
    <PackageReference Include="FluentValidation" />
    <PackageReference Include="FluentValidation.DependencyInjectionExtensions" />

    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="WolverineFx.EntityFrameworkCore" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\..\..\ArenaApi.Contracts\ArenaApi.Contracts.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Content.Domain\ArenaApi.Modules.Content.Domain.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Content.Public\ArenaApi.Modules.Content.Public.csproj" />
  </ItemGroup>
</Project>
```

Write `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ArenaApi.Modules.Content.Infrastructure.Postgres.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" />
    <PackageReference Include="Npgsql" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Content.Domain\ArenaApi.Modules.Content.Domain.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Content.Application\ArenaApi.Modules.Content.Application.csproj" />
  </ItemGroup>
</Project>
```

**- [ ] Step 2.2: Add all four projects to `backend/arena.slnx`**

Edit `backend/arena.slnx`. Add a new folder `/ArenaApi/Modules/Content/` with the four projects. Replace:

```xml
  <Folder Name="/ArenaApi/">
    <Project Path="ArenaApi/src/ArenaApi.SharedKernel/ArenaApi.SharedKernel.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Contracts/ArenaApi.Contracts.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj" />
  </Folder>
```

With:

```xml
  <Folder Name="/ArenaApi/">
    <Project Path="ArenaApi/src/ArenaApi.SharedKernel/ArenaApi.SharedKernel.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Contracts/ArenaApi.Contracts.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj" />
  </Folder>
  <Folder Name="/ArenaApi/Modules/Content/">
    <Project Path="ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Public/ArenaApi.Modules.Content.Public.csproj" />
    <Project Path="ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/ArenaApi.Modules.Content.Domain.csproj" />
    <Project Path="ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Application/ArenaApi.Modules.Content.Application.csproj" />
    <Project Path="ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ArenaApi.Modules.Content.Infrastructure.Postgres.csproj" />
  </Folder>
```

**- [ ] Step 2.3: `git mv` Content files into new project folders**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects

# Public
mkdir -p backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Public/IntegrationEvents
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IContentReader.cs                          backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Public/IContentReader.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/PackageView.cs                             backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Public/PackageView.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IntegrationEvents/PackageCreated.cs        backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Public/IntegrationEvents/PackageCreated.cs

# Domain
mkdir -p backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/DomainEvents
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Package.cs                                  backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/Package.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/DomainEvents/PackageCreatedDomainEvent.cs   backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Domain/DomainEvents/PackageCreatedDomainEvent.cs

# Application
mkdir -p backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Application/{Configurations,Features/CreatePackage}
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContext.cs                 backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Application/ContentDbContext.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentOutboxService.cs             backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Application/ContentOutboxService.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/PackageConfiguration.cs backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Application/Configurations/PackageConfiguration.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageCommand.cs     backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Application/Features/CreatePackage/CreatePackageCommand.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageHandler.cs     backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Application/Features/CreatePackage/CreatePackageHandler.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage/CreatePackageEndpoint.cs    backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Application/Features/CreatePackage/CreatePackageEndpoint.cs

# Infrastructure.Postgres
mkdir -p backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Migrations
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContextDesignTimeFactory.cs backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentDbContextDesignTimeFactory.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentReader.cs                    backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentReader.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/20260520121238_ContentInitial.cs           backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Migrations/20260520121238_ContentInitial.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/20260520121238_ContentInitial.Designer.cs  backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Migrations/20260520121238_ContentInitial.Designer.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/ContentDbContextModelSnapshot.cs           backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/Migrations/ContentDbContextModelSnapshot.cs

# Old ContentModule.cs: deleted (its content is split between new ContentEndpoints.cs in Application and new ContentModule.cs in Infrastructure.Postgres — both are Write-new in Step 2.5)
git rm backend/ArenaApi/src/ArenaApi.Core/Modules/Content/ContentModule.cs

# Clean up the now-empty Modules/Content directory under Core
rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations
rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations
rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure
rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/CreatePackage
rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features
rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/DomainEvents
rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain
rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IntegrationEvents
rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public
rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Content
```

**- [ ] Step 2.4: Update namespaces inside every moved Content file**

The mapping (use `Edit` per file):

| File                                                  | Old namespace                                                          | New namespace                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `Public/IContentReader.cs`                            | `ArenaApi.Core.Modules.Content.Public`                                 | `ArenaApi.Modules.Content.Public`                                      |
| `Public/PackageView.cs`                               | `ArenaApi.Core.Modules.Content.Public`                                 | `ArenaApi.Modules.Content.Public`                                      |
| `Public/IntegrationEvents/PackageCreated.cs`          | `ArenaApi.Core.Modules.Content.Public.IntegrationEvents`               | `ArenaApi.Modules.Content.Public.IntegrationEvents`                    |
| `Domain/Package.cs`                                   | `ArenaApi.Core.Modules.Content.Domain`                                 | `ArenaApi.Modules.Content.Domain`                                      |
| `Domain/DomainEvents/PackageCreatedDomainEvent.cs`    | `ArenaApi.Core.Modules.Content.Domain.DomainEvents`                    | `ArenaApi.Modules.Content.Domain.DomainEvents`                         |
| `Application/ContentDbContext.cs`                     | `ArenaApi.Core.Modules.Content.Infrastructure`                         | `ArenaApi.Modules.Content.Application`                                 |
| `Application/ContentOutboxService.cs`                 | `ArenaApi.Core.Modules.Content.Infrastructure`                         | `ArenaApi.Modules.Content.Application`                                 |
| `Application/Configurations/PackageConfiguration.cs`  | `ArenaApi.Core.Modules.Content.Infrastructure.Configurations`          | `ArenaApi.Modules.Content.Application.Configurations`                  |
| `Application/Features/CreatePackage/*.cs` (3 files)   | `ArenaApi.Core.Modules.Content.Features.CreatePackage`                 | `ArenaApi.Modules.Content.Application.Features.CreatePackage`          |
| `Infrastructure.Postgres/ContentDbContextDesignTimeFactory.cs` | `ArenaApi.Core.Modules.Content.Infrastructure`                | `ArenaApi.Modules.Content.Infrastructure.Postgres`                     |
| `Infrastructure.Postgres/ContentReader.cs`            | `ArenaApi.Core.Modules.Content.Infrastructure`                         | `ArenaApi.Modules.Content.Infrastructure.Postgres`                     |
| `Infrastructure.Postgres/Migrations/*.cs` (3 files)   | `ArenaApi.Core.Modules.Content.Infrastructure.Migrations`              | `ArenaApi.Modules.Content.Infrastructure.Postgres.Migrations`          |

Inside each file, also update `using` directives:

- `using ArenaApi.Core.Modules.Content.Domain;` → `using ArenaApi.Modules.Content.Domain;`
- `using ArenaApi.Core.Modules.Content.Domain.DomainEvents;` → `using ArenaApi.Modules.Content.Domain.DomainEvents;`
- `using ArenaApi.Core.Modules.Content.Infrastructure;` → `using ArenaApi.Modules.Content.Application;` **(DbContext moved into Application)**
- `using ArenaApi.Core.Modules.Content.Infrastructure.Configurations;` → `using ArenaApi.Modules.Content.Application.Configurations;`
- `using ArenaApi.Core.Modules.Content.Public;` → `using ArenaApi.Modules.Content.Public;`
- `using ArenaApi.Core.Modules.Content.Public.IntegrationEvents;` → `using ArenaApi.Modules.Content.Public.IntegrationEvents;`
- `using ArenaApi.Core.Modules.Content.Features.CreatePackage;` → `using ArenaApi.Modules.Content.Application.Features.CreatePackage;`

**Critical edits inside specific files:**

`Application/ContentDbContext.cs` — the `OnModelCreating` namespace filter must be updated:

```csharp
using ArenaApi.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Application;

public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_content";

    internal DbSet<Package> Packages => Set<Package>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ContentDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Modules.Content.Application.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
```

(`internal` access on `DbSet<Package>` still works because `CreatePackageHandler` lives in the same assembly now — `Application`.)

`Application/Features/CreatePackage/CreatePackageHandler.cs` — updated `using`s:

```csharp
using ArenaApi.Modules.Content.Domain;
using ArenaApi.Modules.Content.Public;
using ArenaApi.Modules.Content.Public.IntegrationEvents;
using ArenaApi.SharedKernel.Errors;
using ArenaApi.SharedKernel.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Application.Features.CreatePackage;

internal sealed class CreatePackageHandler(
    ContentDbContext db,
    ContentOutboxService outbox,
    IClock clock)
{
    // ... body unchanged ...
}
```

(Note: `ContentDbContext` and `ContentOutboxService` now in the same namespace as the handler so no `using` is needed for them.)

`Infrastructure.Postgres/ContentReader.cs` — must import the Application namespace to see `ContentDbContext`:

```csharp
using ArenaApi.Modules.Content.Application;
using ArenaApi.Modules.Content.Public;
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

**Important:** `db.Packages` is `internal`. ContentReader is in a different assembly than ContentDbContext, so the access fails. Two options to fix:

- **(A)** Change `DbSet<Package> Packages` from `internal` to `public` in `ContentDbContext.cs`.
- **(B)** Add `[assembly: InternalsVisibleTo("ArenaApi.Modules.Content.Infrastructure.Postgres")]` to `ContentDbContext.cs` (or a new `AssemblyInfo.cs`) in the Application project.

**Decision (locked):** use **(A)** — make `Packages` public. The DbSet is already exposed as an EF metadata source via `OnModelCreating`; the access modifier is cosmetic. `InternalsVisibleTo` would introduce a tighter coupling between two projects that already reference each other by name — no security benefit.

Update `ContentDbContext.cs`: `internal DbSet<Package> Packages` → `public DbSet<Package> Packages`.

`Infrastructure.Postgres/ContentDbContextDesignTimeFactory.cs` — import Application namespace:

```csharp
using ArenaApi.Modules.Content.Application;
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

`Infrastructure.Postgres/Migrations/20260520121238_ContentInitial.Designer.cs` and `ContentDbContextModelSnapshot.cs`:

1. Replace `using ArenaApi.Core.Modules.Content.Infrastructure;` with `using ArenaApi.Modules.Content.Application;` (DbContext moved into Application).
2. Replace `namespace ArenaApi.Core.Modules.Content.Infrastructure.Migrations` with `namespace ArenaApi.Modules.Content.Infrastructure.Postgres.Migrations`.
3. **Critical — entity type string:** the model snapshot encodes the aggregate's CLR type name as a string. Replace `modelBuilder.Entity("ArenaApi.Core.Modules.Content.Domain.Package", ...)` with `modelBuilder.Entity("ArenaApi.Modules.Content.Domain.Package", ...)` in BOTH files (Designer.cs and ContentDbContextModelSnapshot.cs). If you skip this, the next `dotnet ef migrations add` will diff the new model against the stale snapshot, conclude `Package` was renamed (= dropped + recreated), and generate a destructive migration.

`Migrations/20260520121238_ContentInitial.cs` (the migration body itself) contains only `migrationBuilder` calls with SQL identifiers — no CLR namespace strings. Update only `namespace` at the top.

**- [ ] Step 2.5: Create new `ContentEndpoints.cs` (in Application) and new `ContentModule.cs` (in Infrastructure.Postgres) + AssemblyMarker**

Write `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Application/ContentEndpoints.cs`:

```csharp
using ArenaApi.Modules.Content.Application.Features.CreatePackage;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Modules.Content.Application;

public static class ContentEndpoints
{
    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder packages = app.MapGroup("/api/packages");
        packages.MapCreatePackage();
        return app;
    }
}
```

Write `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Application/ContentApplicationAssemblyMarker.cs`:

```csharp
namespace ArenaApi.Modules.Content.Application;

/// Marker type used by ArenaApi.Web's Wolverine handler discovery
/// (opts.Discovery.IncludeAssembly(typeof(ContentApplicationAssemblyMarker).Assembly)).
public sealed class ContentApplicationAssemblyMarker;
```

Write `backend/ArenaApi/src/Modules/Content/ArenaApi.Modules.Content.Infrastructure.Postgres/ContentModule.cs`:

```csharp
using ArenaApi.Modules.Content.Application;
using ArenaApi.Modules.Content.Application.Features.CreatePackage;
using ArenaApi.Modules.Content.Public;
using ArenaApi.SharedKernel;
using ArenaApi.SharedKernel.Time;
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

        services.AddScoped<IContentReader, ContentReader>();
        services.AddScoped<ContentOutboxService>();
        services.AddScoped<CreatePackageHandler>();
        services.AddSingleton<IClock, SystemClock>();

        return services;
    }
}
```

**- [ ] Step 2.6: Update consumers (`Web/Program.cs`, `Web/Configuration/WolverineConfiguration.cs`)**

`backend/ArenaApi/src/ArenaApi.Web/Program.cs` — update Content using:

- Remove: `using ArenaApi.Core.Modules.Content;`
- Add: `using ArenaApi.Modules.Content.Application;` (for `MapContentEndpoints`)
- Add: `using ArenaApi.Modules.Content.Infrastructure.Postgres;` (for `AddContentModule`)

`backend/ArenaApi/src/ArenaApi.Web/Configuration/WolverineConfiguration.cs` — update Content using:

- Remove: `using ArenaApi.Core.Modules.Content;`
- Add: `using ArenaApi.Modules.Content.Application;`
- Change line 60: `opts.Discovery.IncludeAssembly(typeof(ContentModule).Assembly);` → `opts.Discovery.IncludeAssembly(typeof(ContentApplicationAssemblyMarker).Assembly);`

**- [ ] Step 2.7: Update Web/csproj to reference the four new Content projects**

Edit `backend/ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj`. Add to the `<ItemGroup>` containing `ProjectReference` entries:

```xml
    <ProjectReference Include="..\..\..\ArenaApi\src\Modules\Content\ArenaApi.Modules.Content.Public\ArenaApi.Modules.Content.Public.csproj" />
    <ProjectReference Include="..\..\..\ArenaApi\src\Modules\Content\ArenaApi.Modules.Content.Domain\ArenaApi.Modules.Content.Domain.csproj" />
    <ProjectReference Include="..\..\..\ArenaApi\src\Modules\Content\ArenaApi.Modules.Content.Application\ArenaApi.Modules.Content.Application.csproj" />
    <ProjectReference Include="..\..\..\ArenaApi\src\Modules\Content\ArenaApi.Modules.Content.Infrastructure.Postgres\ArenaApi.Modules.Content.Infrastructure.Postgres.csproj" />
```

**Note on the relative path:** `ArenaApi.Web.csproj` is at `backend/ArenaApi/src/ArenaApi.Web/`. The new Content projects are at `backend/ArenaApi/src/Modules/Content/<ProjectName>/`. Relative path from Web → Content = `..\Modules\Content\<ProjectName>\<ProjectName>.csproj`. Use that two-dot form:

```xml
    <ProjectReference Include="..\Modules\Content\ArenaApi.Modules.Content.Public\ArenaApi.Modules.Content.Public.csproj" />
    <ProjectReference Include="..\Modules\Content\ArenaApi.Modules.Content.Domain\ArenaApi.Modules.Content.Domain.csproj" />
    <ProjectReference Include="..\Modules\Content\ArenaApi.Modules.Content.Application\ArenaApi.Modules.Content.Application.csproj" />
    <ProjectReference Include="..\Modules\Content\ArenaApi.Modules.Content.Infrastructure.Postgres\ArenaApi.Modules.Content.Infrastructure.Postgres.csproj" />
```

(Keep the existing `..\ArenaApi.Core\ArenaApi.Core.csproj` reference for now — Core is still needed for the un-extracted modules.)

**- [ ] Step 2.8: Update tests/csproj and tests/cs files for Content namespace**

`backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj` — add reference to the four Content projects so `ModuleBoundariesTests` can still load them while the refactor is in flight (it gets deleted in Task 8):

```xml
  <ItemGroup>
    <ProjectReference Include="..\..\src\ArenaApi.Core\ArenaApi.Core.csproj" />
    <ProjectReference Include="..\..\src\Modules\Content\ArenaApi.Modules.Content.Application\ArenaApi.Modules.Content.Application.csproj" />
  </ItemGroup>
```

`backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs` — temporarily relax the test by either updating its references to the new types or marking specific facts as `Skip = "obsolete after modules-as-projects refactor; see Task 8"`. **Simpler approach for this interim step:** update `CoreAssembly` to point to the Content Application assembly so the unmoved-modules tests still execute against ArenaApi.Core for Execution/Progress/IdentityStub. Since this whole test class is deleted in Task 8, the cleanest interim fix is:

Replace `ModuleBoundariesTests.cs` with a stub that has only the `Smoke` test, then delete the file entirely in Task 8. For this task, **edit the class to skip every fact** by adding `Skip = "Refactor in progress; deleted in Task 8"` to each `[Fact]`:

```csharp
[Fact(Skip = "Refactor in progress; will be deleted in Task 8")]
public void Content_internals_are_not_referenced_from_other_modules() { ... }

[Fact(Skip = "Refactor in progress; will be deleted in Task 8")]
public void Execution_internals_are_not_referenced_from_other_modules() { ... }

[Fact(Skip = "Refactor in progress; will be deleted in Task 8")]
public void Progress_internals_are_not_referenced_from_other_modules() { ... }

[Fact(Skip = "Refactor in progress; will be deleted in Task 8")]
public void IdentityStub_only_exposes_Public_namespace() { ... }

[Fact(Skip = "Refactor in progress; will be deleted in Task 8")]
public void DbContexts_are_not_referenced_outside_their_owning_module() { ... }
```

(Bodies stay; only `[Fact]` attribute gets the `Skip` argument.)

`backend/ArenaApi/tests/ArenaApi.IntegrationTests/ArenaApi.IntegrationTests.csproj` — verify it references the Web project (which transitively pulls all module assemblies). No edit needed if it already does (which it must, to use `WebApplicationFactory<Program>`).

`backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs` — update line 1:

```csharp
using ArenaApi.Modules.Content.Application;     // was: using ArenaApi.Core.Modules.Content.Infrastructure;
```

(`ContentDbContext` now lives in `Application`.)

**- [ ] Step 2.9: Build**

Run: `cd backend && dotnet build arena.slnx --nologo`

Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`.

If `ArenaApi.Core/Modules/Content/ContentModule.cs` is referenced anywhere it shouldn't be (we deleted it), update the consumer. The grep to confirm everything is rewired:

```bash
grep -rn "ArenaApi\.Core\.Modules\.Content" backend/ArenaApi/src backend/ArenaApi/tests --include="*.cs"
```

Expected: 0 hits.

**- [ ] Step 2.10: Run unit tests (5 architecture facts now skipped, 1 smoke passes)**

```bash
cd backend
dotnet test arena.slnx --nologo \
  --filter "FullyQualifiedName!~CreatePackageEndpointTests&FullyQualifiedName!~HealthEndpointTests"
```

Expected: `Passed: 1, Skipped: 5, Total: 6`.

**- [ ] Step 2.11: Commit**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects
git add -A
git commit -m "refactor(content): extract module into 4 csproj projects

Splits ArenaApi.Core/Modules/Content/ into:
  - ArenaApi.Modules.Content.Public                (contracts)
  - ArenaApi.Modules.Content.Domain                (Package aggregate)
  - ArenaApi.Modules.Content.Application           (DbContext, handlers, endpoints)
  - ArenaApi.Modules.Content.Infrastructure.Postgres (migrations, reader, DI registration)

ContentDbContext moves into Application (vertical-slice convention:
handlers depend on DbContext directly; keeps Application→Infrastructure
references one-way).

Module isolation now enforced by csproj references; NetArchTest facts
temporarily marked Skip pending deletion in Task 8."
```

---

### Task 3: Extract Execution module into 3 projects

**Goal:** Mirror Task 2 for the Execution skeleton. Execution has no Domain types yet, so only Public + Application + Infrastructure.Postgres.

**Files:**
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Public/ArenaApi.Modules.Execution.Public.csproj`
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Public/ExecutionPublicAssemblyMarker.cs`
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Application/ArenaApi.Modules.Execution.Application.csproj`
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Application/ExecutionApplicationAssemblyMarker.cs`
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ArenaApi.Modules.Execution.Infrastructure.Postgres.csproj`
- Create: `backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ExecutionModule.cs`
- Move (git mv + edit namespace):
  - `ExecutionDbContext.cs` → `Modules/Execution/ArenaApi.Modules.Execution.Application/ExecutionDbContext.cs`
  - `ExecutionOutboxService.cs` → `Modules/Execution/ArenaApi.Modules.Execution.Application/ExecutionOutboxService.cs`
  - `ExecutionDbContextDesignTimeFactory.cs` → `Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ExecutionDbContextDesignTimeFactory.cs`
- Delete: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/ExecutionModule.cs` (its content goes into the new Infrastructure.Postgres/ExecutionModule.cs)

**- [ ] Step 3.1: Write the three csproj files**

`Modules/Execution/ArenaApi.Modules.Execution.Public/ArenaApi.Modules.Execution.Public.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
  </ItemGroup>
</Project>
```

`Modules/Execution/ArenaApi.Modules.Execution.Application/ArenaApi.Modules.Execution.Application.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="WolverineFx.EntityFrameworkCore" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Execution.Public\ArenaApi.Modules.Execution.Public.csproj" />
  </ItemGroup>
</Project>
```

`Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ArenaApi.Modules.Execution.Infrastructure.Postgres.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Execution.Application\ArenaApi.Modules.Execution.Application.csproj" />
  </ItemGroup>
</Project>
```

**- [ ] Step 3.2: Update `arena.slnx`**

Add a new folder `/ArenaApi/Modules/Execution/` after the Content folder:

```xml
  <Folder Name="/ArenaApi/Modules/Execution/">
    <Project Path="ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Public/ArenaApi.Modules.Execution.Public.csproj" />
    <Project Path="ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Application/ArenaApi.Modules.Execution.Application.csproj" />
    <Project Path="ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ArenaApi.Modules.Execution.Infrastructure.Postgres.csproj" />
  </Folder>
```

**- [ ] Step 3.3: Move files and update namespaces**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects

mkdir -p backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Public
mkdir -p backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Application
mkdir -p backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres

git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContext.cs                  backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Application/ExecutionDbContext.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionOutboxService.cs              backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Application/ExecutionOutboxService.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContextDesignTimeFactory.cs backend/ArenaApi/src/Modules/Execution/ArenaApi.Modules.Execution.Infrastructure.Postgres/ExecutionDbContextDesignTimeFactory.cs
git rm backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/ExecutionModule.cs

rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure backend/ArenaApi/src/ArenaApi.Core/Modules/Execution
```

**- [ ] Step 3.4: Rewrite moved files with new namespaces**

`Application/ExecutionDbContext.cs`:

```csharp
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Execution.Application;

public sealed class ExecutionDbContext(DbContextOptions<ExecutionDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_execution";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ExecutionDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Modules.Execution.Application.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
```

`Application/ExecutionOutboxService.cs`:

```csharp
using ArenaApi.SharedKernel.Outbox;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Execution.Application;

internal sealed class ExecutionOutboxService(IDbContextOutbox<ExecutionDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
```

`Infrastructure.Postgres/ExecutionDbContextDesignTimeFactory.cs`:

```csharp
using ArenaApi.Modules.Execution.Application;
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

**- [ ] Step 3.5: Create assembly markers and `ExecutionModule.cs`**

`Public/ExecutionPublicAssemblyMarker.cs`:

```csharp
namespace ArenaApi.Modules.Execution.Public;

public sealed class ExecutionPublicAssemblyMarker;
```

`Application/ExecutionApplicationAssemblyMarker.cs`:

```csharp
namespace ArenaApi.Modules.Execution.Application;

/// Marker type used by ArenaApi.Web's Wolverine handler discovery.
public sealed class ExecutionApplicationAssemblyMarker;
```

`Infrastructure.Postgres/ExecutionModule.cs`:

```csharp
using ArenaApi.Modules.Execution.Application;
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

**- [ ] Step 3.6: Update Web/csproj + Program.cs**

`ArenaApi.Web.csproj` — add references:

```xml
    <ProjectReference Include="..\Modules\Execution\ArenaApi.Modules.Execution.Public\ArenaApi.Modules.Execution.Public.csproj" />
    <ProjectReference Include="..\Modules\Execution\ArenaApi.Modules.Execution.Application\ArenaApi.Modules.Execution.Application.csproj" />
    <ProjectReference Include="..\Modules\Execution\ArenaApi.Modules.Execution.Infrastructure.Postgres\ArenaApi.Modules.Execution.Infrastructure.Postgres.csproj" />
```

`Program.cs` — replace `using ArenaApi.Core.Modules.Execution;` with `using ArenaApi.Modules.Execution.Infrastructure.Postgres;`.

**- [ ] Step 3.7: Build + tests + commit**

```bash
cd backend
dotnet build arena.slnx --nologo
dotnet test arena.slnx --nologo --filter "FullyQualifiedName!~CreatePackageEndpointTests&FullyQualifiedName!~HealthEndpointTests"
```

Expected: build clean (0 warnings), tests `Passed: 1, Skipped: 5`.

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects
git add -A
git commit -m "refactor(execution): extract module into 3 csproj projects

Skeleton module (no Domain types yet). Mirrors the Content layout:
Public + Application + Infrastructure.Postgres."
```

---

### Task 4: Extract Progress module into 3 projects

**Goal:** Mirror Task 3 for Progress. Progress has the `PackageCreatedHandler` event listener that subscribes to `Content.Public.PackageCreated`, so `Progress.Application` must reference `Content.Public`.

**Files:**
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Public/ArenaApi.Modules.Progress.Public.csproj`
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Public/ProgressPublicAssemblyMarker.cs`
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Application/ArenaApi.Modules.Progress.Application.csproj`
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Application/ProgressApplicationAssemblyMarker.cs`
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ArenaApi.Modules.Progress.Infrastructure.Postgres.csproj`
- Create: `backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ProgressModule.cs`
- Move (git mv + edit namespace):
  - `ProgressDbContext.cs` → `Application/ProgressDbContext.cs`
  - `ProgressOutboxService.cs` → `Application/ProgressOutboxService.cs`
  - `ProgressDbContextDesignTimeFactory.cs` → `Infrastructure.Postgres/ProgressDbContextDesignTimeFactory.cs`
  - `PackageCreatedHandler.cs` → `Application/EventHandlers/PackageCreatedHandler.cs`
- Delete: `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/ProgressModule.cs`

**- [ ] Step 4.1: Write the three csproj files**

`Modules/Progress/ArenaApi.Modules.Progress.Public/ArenaApi.Modules.Progress.Public.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
  </ItemGroup>
</Project>
```

`Modules/Progress/ArenaApi.Modules.Progress.Application/ArenaApi.Modules.Progress.Application.csproj` — note the **cross-module reference to `Content.Public`**:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="WolverineFx.EntityFrameworkCore" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Progress.Public\ArenaApi.Modules.Progress.Public.csproj" />
    <ProjectReference Include="..\..\Content\ArenaApi.Modules.Content.Public\ArenaApi.Modules.Content.Public.csproj" />
  </ItemGroup>
</Project>
```

(`..\..\Content\` is the parent two levels up then back down into the Content module folder — `Modules/Progress/ArenaApi.Modules.Progress.Application/` → `Modules/Content/ArenaApi.Modules.Content.Public/`.)

`Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ArenaApi.Modules.Progress.Infrastructure.Postgres.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.Progress.Application\ArenaApi.Modules.Progress.Application.csproj" />
  </ItemGroup>
</Project>
```

**- [ ] Step 4.2: Add to `arena.slnx`**

```xml
  <Folder Name="/ArenaApi/Modules/Progress/">
    <Project Path="ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Public/ArenaApi.Modules.Progress.Public.csproj" />
    <Project Path="ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Application/ArenaApi.Modules.Progress.Application.csproj" />
    <Project Path="ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ArenaApi.Modules.Progress.Infrastructure.Postgres.csproj" />
  </Folder>
```

**- [ ] Step 4.3: Move files**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects

mkdir -p backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Public
mkdir -p backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Application/EventHandlers
mkdir -p backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres

git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/Infrastructure/ProgressDbContext.cs                   backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Application/ProgressDbContext.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/Infrastructure/ProgressOutboxService.cs               backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Application/ProgressOutboxService.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/Infrastructure/ProgressDbContextDesignTimeFactory.cs  backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Infrastructure.Postgres/ProgressDbContextDesignTimeFactory.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/EventHandlers/PackageCreatedHandler.cs                backend/ArenaApi/src/Modules/Progress/ArenaApi.Modules.Progress.Application/EventHandlers/PackageCreatedHandler.cs
git rm backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/ProgressModule.cs

rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/EventHandlers backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/Infrastructure backend/ArenaApi/src/ArenaApi.Core/Modules/Progress
```

**- [ ] Step 4.4: Rewrite moved files with new namespaces**

`Application/ProgressDbContext.cs`:

```csharp
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Progress.Application;

public sealed class ProgressDbContext(DbContextOptions<ProgressDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_progress";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ProgressDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Modules.Progress.Application.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
```

`Application/ProgressOutboxService.cs`:

```csharp
using ArenaApi.SharedKernel.Outbox;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Progress.Application;

internal sealed class ProgressOutboxService(IDbContextOutbox<ProgressDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
```

`Application/EventHandlers/PackageCreatedHandler.cs`:

```csharp
using ArenaApi.Modules.Content.Public.IntegrationEvents;
using Microsoft.Extensions.Logging;

namespace ArenaApi.Modules.Progress.Application.EventHandlers;

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

`Infrastructure.Postgres/ProgressDbContextDesignTimeFactory.cs`:

```csharp
using ArenaApi.Modules.Progress.Application;
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

**- [ ] Step 4.5: Create assembly markers and `ProgressModule.cs`**

`Public/ProgressPublicAssemblyMarker.cs`:

```csharp
namespace ArenaApi.Modules.Progress.Public;

public sealed class ProgressPublicAssemblyMarker;
```

`Application/ProgressApplicationAssemblyMarker.cs`:

```csharp
namespace ArenaApi.Modules.Progress.Application;

/// Marker type used by ArenaApi.Web's Wolverine handler discovery —
/// PackageCreatedHandler lives in this assembly.
public sealed class ProgressApplicationAssemblyMarker;
```

`Infrastructure.Postgres/ProgressModule.cs`:

```csharp
using ArenaApi.Modules.Progress.Application;
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

**- [ ] Step 4.6: Update Web/csproj + Program.cs + WolverineConfiguration.cs**

`ArenaApi.Web.csproj`:

```xml
    <ProjectReference Include="..\Modules\Progress\ArenaApi.Modules.Progress.Public\ArenaApi.Modules.Progress.Public.csproj" />
    <ProjectReference Include="..\Modules\Progress\ArenaApi.Modules.Progress.Application\ArenaApi.Modules.Progress.Application.csproj" />
    <ProjectReference Include="..\Modules\Progress\ArenaApi.Modules.Progress.Infrastructure.Postgres\ArenaApi.Modules.Progress.Infrastructure.Postgres.csproj" />
```

`Program.cs`:
- Replace `using ArenaApi.Core.Modules.Progress;` with `using ArenaApi.Modules.Progress.Infrastructure.Postgres;`.

`WolverineConfiguration.cs` — add an additional `IncludeAssembly` for Progress (the handler lives in Progress.Application, not Content.Application):

```csharp
using ArenaApi.Modules.Content.Application;
using ArenaApi.Modules.Progress.Application;

// ... inside builder.UseWolverine(opts => { ... }):

opts.Discovery.IncludeAssembly(typeof(ContentApplicationAssemblyMarker).Assembly);
opts.Discovery.IncludeAssembly(typeof(ProgressApplicationAssemblyMarker).Assembly);
```

(We don't include Execution because it has no handlers yet — Wolverine will scan it later when handlers are added; for now the inclusion is unnecessary and would just slow startup.)

**- [ ] Step 4.7: Build + tests + commit**

```bash
cd backend
dotnet build arena.slnx --nologo
dotnet test arena.slnx --nologo --filter "FullyQualifiedName!~CreatePackageEndpointTests&FullyQualifiedName!~HealthEndpointTests"
```

Expected: build clean, `Passed: 1, Skipped: 5`.

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects
git add -A
git commit -m "refactor(progress): extract module into 3 csproj projects

Progress.Application references Content.Public (only cross-module
reference in the graph) — PackageCreatedHandler subscribes to the
PackageCreated integration event Content publishes."
```

---

### Task 5: Extract IdentityStub module into 3 projects

**Goal:** Mirror Task 3 for IdentityStub. IdentityStub has no DB, so the third project is `Infrastructure` (no `.Postgres` suffix).

**Files:**
- Create: `backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Public/ArenaApi.Modules.IdentityStub.Public.csproj`
- Create: `backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Application/ArenaApi.Modules.IdentityStub.Application.csproj`
- Create: `backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Application/IdentityStubApplicationAssemblyMarker.cs`
- Create: `backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/ArenaApi.Modules.IdentityStub.Infrastructure.csproj`
- Create: `backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/IdentityStubModule.cs`
- Move:
  - `ICurrentUser.cs` → `Public/ICurrentUser.cs`
  - `IdentityStubOptions.cs` → `Application/IdentityStubOptions.cs`
  - `StubCurrentUser.cs` → `Infrastructure/StubCurrentUser.cs`
- Delete: `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/IdentityStubModule.cs`

**- [ ] Step 5.1: Write the three csproj files**

`Public/ArenaApi.Modules.IdentityStub.Public.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
</Project>
```

(No package or project refs — `ICurrentUser` is a stand-alone interface.)

`Application/ArenaApi.Modules.IdentityStub.Application.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.IdentityStub.Public\ArenaApi.Modules.IdentityStub.Public.csproj" />
  </ItemGroup>
</Project>
```

`Infrastructure/ArenaApi.Modules.IdentityStub.Infrastructure.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.IdentityStub.Public\ArenaApi.Modules.IdentityStub.Public.csproj" />
    <ProjectReference Include="..\ArenaApi.Modules.IdentityStub.Application\ArenaApi.Modules.IdentityStub.Application.csproj" />
  </ItemGroup>
</Project>
```

**Why FrameworkReference, not explicit PackageReferences:** the module needs `IOptions<T>` (from `Microsoft.Extensions.Options`), `IServiceCollection` (from `Microsoft.Extensions.DependencyInjection.Abstractions`), and `IConfiguration.GetSection` (from `Microsoft.Extensions.Configuration.Abstractions`). Only the last is currently in `Directory.Packages.props`. Pulling the other two as individual NuGet packages would expand the central package list for a single consumer. `Microsoft.AspNetCore.App` is already used by Content.Application and other module projects for the same purpose; .NET 10's package pruning trims unused ASP.NET assemblies at publish time, so the cost is conceptual surface rather than binary size.

**- [ ] Step 5.2: Add to `arena.slnx`**

```xml
  <Folder Name="/ArenaApi/Modules/IdentityStub/">
    <Project Path="ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Public/ArenaApi.Modules.IdentityStub.Public.csproj" />
    <Project Path="ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Application/ArenaApi.Modules.IdentityStub.Application.csproj" />
    <Project Path="ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/ArenaApi.Modules.IdentityStub.Infrastructure.csproj" />
  </Folder>
```

**- [ ] Step 5.3: Move files**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects

mkdir -p backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Public
mkdir -p backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Application
mkdir -p backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure

git mv backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Public/ICurrentUser.cs            backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Public/ICurrentUser.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/IdentityStubOptions.cs            backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Application/IdentityStubOptions.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Infrastructure/StubCurrentUser.cs backend/ArenaApi/src/Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Infrastructure/StubCurrentUser.cs
git rm backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/IdentityStubModule.cs

rmdir backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Public backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Infrastructure backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub
```

**- [ ] Step 5.4: Rewrite moved files with new namespaces**

`Public/ICurrentUser.cs`:

```csharp
namespace ArenaApi.Modules.IdentityStub.Public;

public interface ICurrentUser
{
    Guid UserId { get; }
}
```

(Verify the interface body matches the original — if there are more members, copy them verbatim from the old file.)

`Application/IdentityStubOptions.cs`:

```csharp
namespace ArenaApi.Modules.IdentityStub.Application;

public sealed class IdentityStubOptions
{
    public const string SectionName = "IdentityStub";

    public Guid HardcodedUserId { get; init; }
}
```

`Infrastructure/StubCurrentUser.cs`:

```csharp
using ArenaApi.Modules.IdentityStub.Application;
using ArenaApi.Modules.IdentityStub.Public;
using Microsoft.Extensions.Options;

namespace ArenaApi.Modules.IdentityStub.Infrastructure;

internal sealed class StubCurrentUser(IOptions<IdentityStubOptions> options) : ICurrentUser
{
    public Guid UserId { get; } = options.Value.HardcodedUserId == Guid.Empty
        ? throw new InvalidOperationException(
            $"{nameof(IdentityStubOptions)}.{nameof(IdentityStubOptions.HardcodedUserId)} is not configured. " +
            "Set IdentityStub:HardcodedUserId in appsettings.")
        : options.Value.HardcodedUserId;
}
```

**- [ ] Step 5.5: Create `IdentityStubApplicationAssemblyMarker.cs` and new `IdentityStubModule.cs`**

`Application/IdentityStubApplicationAssemblyMarker.cs`:

```csharp
namespace ArenaApi.Modules.IdentityStub.Application;

public sealed class IdentityStubApplicationAssemblyMarker;
```

`Infrastructure/IdentityStubModule.cs`:

```csharp
using ArenaApi.Modules.IdentityStub.Application;
using ArenaApi.Modules.IdentityStub.Public;
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

**- [ ] Step 5.6: Update Web/csproj + Program.cs**

`ArenaApi.Web.csproj`:

```xml
    <ProjectReference Include="..\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Public\ArenaApi.Modules.IdentityStub.Public.csproj" />
    <ProjectReference Include="..\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Application\ArenaApi.Modules.IdentityStub.Application.csproj" />
    <ProjectReference Include="..\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Infrastructure\ArenaApi.Modules.IdentityStub.Infrastructure.csproj" />
```

`Program.cs`:
- Replace `using ArenaApi.Core.Modules.IdentityStub;` with `using ArenaApi.Modules.IdentityStub.Infrastructure;`.

**- [ ] Step 5.7: Build + tests + commit**

```bash
cd backend
dotnet build arena.slnx --nologo
dotnet test arena.slnx --nologo --filter "FullyQualifiedName!~CreatePackageEndpointTests&FullyQualifiedName!~HealthEndpointTests"
```

Expected: build clean, `Passed: 1, Skipped: 5`.

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects
git add -A
git commit -m "refactor(identity-stub): extract module into 3 csproj projects

IdentityStub has no DB, so the third project is named Infrastructure
(no .Postgres suffix). 3 projects: Public + Application + Infrastructure."
```

---

### Task 6: Move Health endpoint into Web; delete `ArenaApi.Core` + `ArenaApi.Infrastructure`

**Goal:** Move the only non-module slice (`Features/Health/`) into `ArenaApi.Web/Health/` and then delete the now-empty `ArenaApi.Core` and unused `ArenaApi.Infrastructure` projects.

**Files:**
- Move: `backend/ArenaApi/src/ArenaApi.Core/Features/Health/HealthEndpoints.cs` → `backend/ArenaApi/src/ArenaApi.Web/Health/HealthEndpoints.cs`
- Move: `backend/ArenaApi/src/ArenaApi.Core/Features/Health/HealthResponse.cs` → `backend/ArenaApi/src/ArenaApi.Web/Health/HealthResponse.cs`
- Delete: `backend/ArenaApi/src/ArenaApi.Core/` (entire directory)
- Delete: `backend/ArenaApi/src/ArenaApi.Infrastructure/` (entire directory)
- Modify: `backend/arena.slnx` — remove Core and Infrastructure entries
- Modify: `backend/ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj` — remove Core and Infrastructure ProjectReferences
- Modify: `backend/ArenaApi/src/ArenaApi.Web/Program.cs` — update Health using
- Modify: `backend/ArenaApi/src/ArenaApi.Web/GlobalUsings.cs` — verify no stale references
- Modify: `backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj` — remove Core reference (UnitTests still references Content.Application from Task 2)

**- [ ] Step 6.1: Move Health files**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects
mkdir -p backend/ArenaApi/src/ArenaApi.Web/Health
git mv backend/ArenaApi/src/ArenaApi.Core/Features/Health/HealthEndpoints.cs backend/ArenaApi/src/ArenaApi.Web/Health/HealthEndpoints.cs
git mv backend/ArenaApi/src/ArenaApi.Core/Features/Health/HealthResponse.cs  backend/ArenaApi/src/ArenaApi.Web/Health/HealthResponse.cs

rmdir backend/ArenaApi/src/ArenaApi.Core/Features/Health backend/ArenaApi/src/ArenaApi.Core/Features
```

**- [ ] Step 6.2: Update Health file namespaces**

`backend/ArenaApi/src/ArenaApi.Web/Health/HealthResponse.cs`:

```csharp
namespace ArenaApi.Web.Health;

public sealed record HealthResponse(string Status);
```

`backend/ArenaApi/src/ArenaApi.Web/Health/HealthEndpoints.cs`:

```csharp
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Web.Health;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", () => Results.Ok(new HealthResponse("ok")))
            .WithName("Health")
            .WithTags("Health");

        return app;
    }
}
```

**- [ ] Step 6.3: Delete `ArenaApi.Core` and `ArenaApi.Infrastructure`**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects

# Confirm Core has no remaining tracked files
git ls-files backend/ArenaApi/src/ArenaApi.Core
# Expected: only GlobalUsings.cs and ArenaApi.Core.csproj. If anything else lingers,
# something was missed in Tasks 1-5 — investigate and re-run the missing git mv.

# Remove the remaining Core files and the directory
git rm backend/ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj
git rm backend/ArenaApi/src/ArenaApi.Core/GlobalUsings.cs
# (Remove any other tracked files surfaced by the ls-files command.)

# Remove untracked obj/, bin/ that may still exist on disk
rm -rf backend/ArenaApi/src/ArenaApi.Core

# Delete Infrastructure project
git rm backend/ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj
git rm backend/ArenaApi/src/ArenaApi.Infrastructure/AssemblyMarker.cs
rm -rf backend/ArenaApi/src/ArenaApi.Infrastructure
```

**- [ ] Step 6.4: Remove the two project entries from `arena.slnx`**

Edit `backend/arena.slnx`. Remove these two lines from the `/ArenaApi/` folder:

```xml
    <Project Path="ArenaApi/src/ArenaApi.Core/ArenaApi.Core.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Infrastructure/ArenaApi.Infrastructure.csproj" />
```

After the edit, the `/ArenaApi/` folder should contain only:

```xml
  <Folder Name="/ArenaApi/">
    <Project Path="ArenaApi/src/ArenaApi.SharedKernel/ArenaApi.SharedKernel.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Contracts/ArenaApi.Contracts.csproj" />
    <Project Path="ArenaApi/src/ArenaApi.Web/ArenaApi.Web.csproj" />
  </Folder>
```

**- [ ] Step 6.5: Update `ArenaApi.Web.csproj` — remove Core/Infrastructure refs and add SharedKernel**

The Web project should now reference: SharedKernel + Contracts + 13 module projects (4 Content + 3 Execution + 3 Progress + 3 IdentityStub). Replace the `<ItemGroup>` with `ProjectReference` entries with the full final list:

```xml
  <ItemGroup>
    <ProjectReference Include="..\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\ArenaApi.Contracts\ArenaApi.Contracts.csproj" />

    <ProjectReference Include="..\Modules\Content\ArenaApi.Modules.Content.Public\ArenaApi.Modules.Content.Public.csproj" />
    <ProjectReference Include="..\Modules\Content\ArenaApi.Modules.Content.Domain\ArenaApi.Modules.Content.Domain.csproj" />
    <ProjectReference Include="..\Modules\Content\ArenaApi.Modules.Content.Application\ArenaApi.Modules.Content.Application.csproj" />
    <ProjectReference Include="..\Modules\Content\ArenaApi.Modules.Content.Infrastructure.Postgres\ArenaApi.Modules.Content.Infrastructure.Postgres.csproj" />

    <ProjectReference Include="..\Modules\Execution\ArenaApi.Modules.Execution.Public\ArenaApi.Modules.Execution.Public.csproj" />
    <ProjectReference Include="..\Modules\Execution\ArenaApi.Modules.Execution.Application\ArenaApi.Modules.Execution.Application.csproj" />
    <ProjectReference Include="..\Modules\Execution\ArenaApi.Modules.Execution.Infrastructure.Postgres\ArenaApi.Modules.Execution.Infrastructure.Postgres.csproj" />

    <ProjectReference Include="..\Modules\Progress\ArenaApi.Modules.Progress.Public\ArenaApi.Modules.Progress.Public.csproj" />
    <ProjectReference Include="..\Modules\Progress\ArenaApi.Modules.Progress.Application\ArenaApi.Modules.Progress.Application.csproj" />
    <ProjectReference Include="..\Modules\Progress\ArenaApi.Modules.Progress.Infrastructure.Postgres\ArenaApi.Modules.Progress.Infrastructure.Postgres.csproj" />

    <ProjectReference Include="..\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Public\ArenaApi.Modules.IdentityStub.Public.csproj" />
    <ProjectReference Include="..\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Application\ArenaApi.Modules.IdentityStub.Application.csproj" />
    <ProjectReference Include="..\Modules\IdentityStub\ArenaApi.Modules.IdentityStub.Infrastructure\ArenaApi.Modules.IdentityStub.Infrastructure.csproj" />
  </ItemGroup>
```

(Keep the existing `<ItemGroup>` with NuGet `<PackageReference>` entries unchanged.)

**- [ ] Step 6.6: Update Health using in `Program.cs`**

Replace line 2: `using ArenaApi.Core.Features.Health;` → `using ArenaApi.Web.Health;`.

**- [ ] Step 6.7: Update UnitTests/csproj**

Replace the `<ItemGroup>` with `ProjectReference`:

```xml
  <ItemGroup>
    <ProjectReference Include="..\..\src\ArenaApi.SharedKernel\ArenaApi.SharedKernel.csproj" />
    <ProjectReference Include="..\..\src\Modules\Content\ArenaApi.Modules.Content.Application\ArenaApi.Modules.Content.Application.csproj" />
  </ItemGroup>
```

(The Content.Application ref is left over from Task 2 and harmless — `ModuleBoundariesTests` gets deleted in Task 8 so no test references the assembly at runtime. The minimal correct ref-set is just SharedKernel + xunit packages, but keeping Content.Application avoids a second rebuild of the test project.)

**- [ ] Step 6.8: Build + tests + commit**

```bash
cd backend
dotnet build arena.slnx --nologo
dotnet test arena.slnx --nologo --filter "FullyQualifiedName!~CreatePackageEndpointTests&FullyQualifiedName!~HealthEndpointTests"
```

Expected: build clean (0 warnings), tests `Passed: 1, Skipped: 5`.

Verify ArenaApi.Core and ArenaApi.Infrastructure are gone:

```bash
ls backend/ArenaApi/src/
# Expected: ArenaApi.Contracts, ArenaApi.SharedKernel, ArenaApi.Web, Modules
```

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects
git add -A
git commit -m "refactor: delete ArenaApi.Core and ArenaApi.Infrastructure

Health endpoint moves into ArenaApi.Web/Health/ (non-module host slice).
ArenaApi.Core is empty after Tasks 1-5 extracted everything into
SharedKernel and per-module projects. ArenaApi.Infrastructure was an
empty reserved shell — gone. Cross-cutting infra (OTel, jobs) gets its
own focused project when a concrete need lands."
```

---

### Task 7: Update Web — Program.cs + WolverineConfiguration cleanup

**Goal:** Verify Program.cs and WolverineConfiguration.cs are fully aligned with the new project structure. This task is mostly a sanity pass — the moves in Tasks 2-6 should have rewritten most of it, but the final state should be reviewed end-to-end.

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Web/Program.cs`
- Modify: `backend/ArenaApi/src/ArenaApi.Web/Configuration/WolverineConfiguration.cs`

**- [ ] Step 7.1: Rewrite `Program.cs` to the final form**

Replace the entire contents of `backend/ArenaApi/src/ArenaApi.Web/Program.cs` with:

```csharp
using ArenaApi.Modules.Content.Application;
using ArenaApi.Modules.Content.Infrastructure.Postgres;
using ArenaApi.Modules.Execution.Infrastructure.Postgres;
using ArenaApi.Modules.IdentityStub.Infrastructure;
using ArenaApi.Modules.Progress.Infrastructure.Postgres;
using ArenaApi.SharedKernel;
using ArenaApi.Web.Configuration;
using ArenaApi.Web.Health;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// Order matters: modules register their DbContexts first, then UseArenaWolverine
// wraps them with EF Core transactional middleware (IDbContextOutbox<T> resolves
// per DbContext at runtime).
builder.Services
    .AddIdentityStubModule(builder.Configuration)
    .AddContentModule(builder.Configuration)
    .AddExecutionModule(builder.Configuration)
    .AddProgressModule(builder.Configuration);

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

app.MapHealthEndpoints();
app.MapContentEndpoints();

await app.RunAsync();

namespace ArenaApi.Web
{
    public sealed class Program;
}
```

**- [ ] Step 7.2: Rewrite `WolverineConfiguration.cs` to the final form**

Replace the entire contents with:

```csharp
using ArenaApi.Modules.Content.Application;
using ArenaApi.Modules.Progress.Application;
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
    /// the EF Core transactional middleware, and handler discovery for every
    /// module Application assembly that contains Wolverine handlers.
    /// </summary>
    /// <remarks>
    /// Extends <see cref="IHostApplicationBuilder"/> (which <c>WebApplicationBuilder</c>
    /// implements) because Wolverine 5.x's <c>UseWolverine(IHostApplicationBuilder,...)</c>
    /// overload is the only one whose callback can access <see cref="IConfiguration"/>.
    /// </remarks>
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
            // here enrolls all of them.
            opts.UseEntityFrameworkCoreTransactions();

            // Handler discovery: handlers live in each module's Application assembly.
            // Add a new IncludeAssembly call when a new module starts shipping handlers.
            opts.Discovery.IncludeAssembly(typeof(ContentApplicationAssemblyMarker).Assembly);
            opts.Discovery.IncludeAssembly(typeof(ProgressApplicationAssemblyMarker).Assembly);
        });

        return builder;
    }
}
```

**- [ ] Step 7.3: Build + tests**

```bash
cd backend
dotnet build arena.slnx --nologo
dotnet test arena.slnx --nologo --filter "FullyQualifiedName!~CreatePackageEndpointTests&FullyQualifiedName!~HealthEndpointTests"
```

Expected: build clean, `Passed: 1, Skipped: 5`.

**- [ ] Step 7.4: Commit**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects
git add -A
git commit -m "refactor(web): final Program.cs + Wolverine wiring for modules-as-projects

Program.cs imports each module's Infrastructure.Postgres for the
Add<Module>Module extensions, plus Content.Application for
MapContentEndpoints. WolverineConfiguration discovers handlers via
ApplicationAssemblyMarker types from each module's Application assembly."
```

---

### Task 8: Update integration tests + delete `ModuleBoundariesTests`

**Goal:** Re-point the IntegrationTests project at the new module assemblies, delete the temporarily-skipped `ModuleBoundariesTests.cs`, and remove `NetArchTest.Rules` from `Directory.Packages.props` since nothing references it.

**Files:**
- Modify: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs` (verify imports already updated in Task 2; nothing else needed here)
- Modify: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/CreatePackageEndpointTests.cs` (update any `ArenaApi.Core.*` imports)
- Modify: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/HealthEndpointTests.cs` (likely needs no changes)
- Delete: `backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs`
- Delete: `backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/` (directory if empty)
- Modify: `backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj` — remove NetArchTest package ref
- Modify: `backend/Directory.Packages.props` — remove `<PackageVersion Include="NetArchTest.Rules" />`

**- [ ] Step 8.1: Search for stale `ArenaApi.Core.*` references in test files**

```bash
grep -rn "ArenaApi\.Core" backend/ArenaApi/tests --include="*.cs"
```

For each hit, update the using directive to the correct new namespace using the mapping table from Step 2.4. Most common will be `using ArenaApi.Core.Modules.Content.Infrastructure;` → `using ArenaApi.Modules.Content.Application;` (for `ContentDbContext`).

`backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/CreatePackageEndpointTests.cs` should already use HTTP/wire types (DTOs from `ArenaApi.Contracts.Content`) — no changes likely needed, but verify.

**- [ ] Step 8.2: Delete `ModuleBoundariesTests`**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects
git rm backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs
rmdir backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture
```

**- [ ] Step 8.3: Remove NetArchTest from UnitTests/csproj**

Edit `backend/ArenaApi/tests/ArenaApi.UnitTests/ArenaApi.UnitTests.csproj` — remove this line:

```xml
    <PackageReference Include="NetArchTest.Rules" />
```

**- [ ] Step 8.4: Remove NetArchTest from `Directory.Packages.props`**

Edit `backend/Directory.Packages.props` — remove this line:

```xml
    <PackageVersion Include="NetArchTest.Rules" Version="..." />
```

**- [ ] Step 8.5: Build + run non-Docker tests**

```bash
cd backend
dotnet build arena.slnx --nologo
dotnet test arena.slnx --nologo --filter "FullyQualifiedName!~CreatePackageEndpointTests&FullyQualifiedName!~HealthEndpointTests"
```

Expected: build clean, `Passed: 1, Skipped: 0, Total: 1` (only SmokeTests remains).

**- [ ] Step 8.6: Commit**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects
git add -A
git commit -m "test: delete ModuleBoundariesTests; module isolation now compiler-enforced

NetArchTest rules became redundant — csproj ProjectReferences enforce
the same boundaries at compile time. A reference to a forbidden module
type now fails 'dotnet build' instead of a test run. Removes
NetArchTest.Rules NuGet package."
```

---

### Task 9: Final verification + documentation update

**Goal:** Update CLAUDE.md, `backend/ArenaApi/CLAUDE.md`, `docs/ARCHITECTURE.md`, and `.claude/rules/backend-conventions.md` to describe the new modules-as-projects layout. Then full build, full non-Docker tests, and (if Docker is available) the integration suite.

**Files:**
- Modify: `CLAUDE.md` (root)
- Modify: `backend/ArenaApi/CLAUDE.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `.claude/rules/backend-conventions.md`

**- [ ] Step 9.1: Update root `CLAUDE.md`**

In the "Layout" table, update the Backend rows. Replace the existing layout block describing `ArenaApi.Core/Modules/<Name>/` with:

```
| Path                                                                          | Owns                                                                 |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `backend/ArenaApi/src/ArenaApi.Web/`                                          | Host: `Program.cs`, Wolverine wiring, Health, module registration    |
| `backend/ArenaApi/src/ArenaApi.SharedKernel/`                                 | Cross-cutting primitives (Error, IClock, IDomainEvent, IOutboxService, ConnectionStringNames) |
| `backend/ArenaApi/src/ArenaApi.Contracts/`                                    | HTTP DTOs (per-module subfolders)                                    |
| `backend/ArenaApi/src/Modules/<Name>/ArenaApi.Modules.<Name>.Public/`         | Cross-module surface: `IXxxReader`, view DTOs, integration events    |
| `backend/ArenaApi/src/Modules/<Name>/ArenaApi.Modules.<Name>.Domain/`         | Aggregates, value objects, domain events                              |
| `backend/ArenaApi/src/Modules/<Name>/ArenaApi.Modules.<Name>.Application/`    | DbContext, handlers, endpoints, EF entity configs                    |
| `backend/ArenaApi/src/Modules/<Name>/ArenaApi.Modules.<Name>.Infrastructure.Postgres/` | Migrations, DesignTimeFactory, Reader (Public impl), `Add<Module>Module` |
```

Update the "Hard rules" section: replace the NetArchTest line with a compiler-enforcement line:

```
- **Module boundaries are enforced by csproj `ProjectReference` graph.** Direct
  C# references to another module's `Domain`, `Application`, or `Infrastructure.Postgres`
  assembly will fail `dotnet build`. The only legal cross-module reference is
  to another module's `Public` project.
```

**- [ ] Step 9.2: Rewrite `backend/ArenaApi/CLAUDE.md`**

Replace the entire contents with a description matching the new structure. Key facts to include:

- Sharp Arena's backend is a modular monolith where each module ships as a set of csproj projects: Public, Domain (when applicable), Application, Infrastructure.Postgres.
- Single Web host (`ArenaApi.Web`) wires all modules and hosts the Wolverine + RabbitMQ infrastructure.
- Project reference graph (one-way). Public has no internal refs except SharedKernel. Domain → SharedKernel. Application → Domain, Public, Contracts, SharedKernel. Infrastructure.Postgres → Application (which transitively brings Domain + Public + SharedKernel).
- Per-module schemas: `arena_content`, `arena_execution`, `arena_progress`, `arena_identity`. Wolverine envelopes: `arena_wolverine`.
- Cross-module communication: (a) sync read via `I<Other>Reader` from `<Other>.Public`, (b) async via Wolverine integration events from `<Other>.Public.IntegrationEvents/`.
- The `<Module>DbContext` lives in **Application**, not Infrastructure.Postgres (vertical-slice convention; handlers see DbContext directly).
- Adding a new feature inside a module: drop into `Modules/<M>/ArenaApi.Modules.<M>.Application/Features/<Action><Name>/{Command, Handler, Endpoint}.cs`. If the endpoint adds a new route, wire it through `<M>.Application/ContentEndpoints.cs` (or analog).
- Adding a new module: create the four projects, register schema in `docker/postgres/init.sql`, add `Add<New>Module` call to `Program.cs`, generate first migration via `dotnet ef migrations add --project <New>.Infrastructure.Postgres --startup-project ArenaApi.Web --context <New>DbContext --output-dir Migrations`.
- Naming conventions, schema/connection conventions, Wolverine handler discovery (assembly markers), `Guid.CreateVersion7()`, `Result<T, Error>` — unchanged from previous CLAUDE.md.

**- [ ] Step 9.3: Update `docs/ARCHITECTURE.md`**

Replace any section describing the in-assembly `ArenaApi.Core/Modules/<Name>/` layout with the per-csproj layout. Include the project reference graph (use the same ASCII tree as the top of this plan file). Keep all other content (Wolverine + RabbitMQ, schemas, runner abstraction discussion) unchanged.

**- [ ] Step 9.4: Update `.claude/rules/backend-conventions.md`**

Update the "Module structure" section to describe per-csproj projects. Remove references to NetArchTest enforcement; replace with "csproj ProjectReference graph is the boundary contract — the compiler enforces it." Keep all `Result<T, Error>`, `Guid.CreateVersion7()`, migrations rules unchanged.

**- [ ] Step 9.5: Final verification — full build + non-Docker tests**

```bash
cd backend

# Restore + build
dotnet restore arena.slnx
dotnet build arena.slnx --nologo

# Run all non-Docker tests
dotnet test arena.slnx --nologo \
  --filter "FullyQualifiedName!~CreatePackageEndpointTests&FullyQualifiedName!~HealthEndpointTests"
```

Expected:
- `Build succeeded. 0 Warning(s) 0 Error(s)`
- `Passed: 1, Failed: 0, Skipped: 0, Total: 1` (just SmokeTests)

If Docker is running locally, also run the full integration suite as a final manual smoke:

```bash
dotnet test arena.slnx --nologo
```

Expected: all integration tests pass (CreatePackageEndpoint, HealthEndpoint).

**- [ ] Step 9.6: Final structural sanity grep**

```bash
# No `ArenaApi.Core.*` references anywhere
grep -rn "ArenaApi\.Core" backend --include="*.cs" --include="*.csproj"
# Expected: 0 hits (except possibly in /obj/ build artifacts which can be ignored)

# Each module folder has the expected number of csproj
find backend/ArenaApi/src/Modules -name "*.csproj" | sort
# Expected: 13 files (4 Content + 3 Execution + 3 Progress + 3 IdentityStub)

# Solution file references every csproj
grep -c "<Project Path=" backend/arena.slnx
# Expected: 18 (3 top-level: SharedKernel + Contracts + Web; 13 modules; 2 tests)
```

**- [ ] Step 9.7: Final commit + push**

```bash
cd /Users/dev/code/sharp.arena/.claude/worktrees/refactor-modules-as-projects
git add -A
git commit -m "docs: rewrite CLAUDE.md / ARCHITECTURE.md for modules-as-projects layout"
git push -u origin worktree-refactor-modules-as-projects
```

---

## Acceptance criteria

After Task 9 the worktree must satisfy all of:

- [ ] `dotnet build backend/arena.slnx` succeeds with 0 warnings, 0 errors.
- [ ] `dotnet test backend/arena.slnx --filter "FullyQualifiedName!~CreatePackageEndpointTests&FullyQualifiedName!~HealthEndpointTests"` passes (1 SmokeTest).
- [ ] `backend/ArenaApi/src/ArenaApi.Core/` does not exist.
- [ ] `backend/ArenaApi/src/ArenaApi.Infrastructure/` does not exist.
- [ ] `backend/ArenaApi/src/ArenaApi.SharedKernel/` exists with 9 .cs files (8 primitives + ConnectionStringNames).
- [ ] `backend/ArenaApi/src/Modules/` contains 4 module folders, 13 csproj total (4 Content + 3 Execution + 3 Progress + 3 IdentityStub).
- [ ] `backend/arena.slnx` lists 18 projects across 6 folders.
- [ ] `grep -rn "ArenaApi\.Core" backend/ArenaApi --include="*.cs" --include="*.csproj"` returns 0 hits.
- [ ] `NetArchTest.Rules` is not referenced in `Directory.Packages.props` nor in any `.csproj`.
- [ ] `tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs` does not exist.
- [ ] `CLAUDE.md`, `backend/ArenaApi/CLAUDE.md`, `docs/ARCHITECTURE.md`, `.claude/rules/backend-conventions.md` describe the modules-as-projects layout.

User-side manual smoke (requires Docker):

- [ ] `dotnet test backend/arena.slnx` (full suite incl. Testcontainers tests) passes.
- [ ] `docker compose up -d --build` brings the stack up; `curl http://localhost:8080/health` returns `{"status":"ok"}`; `curl -X POST -H 'Content-Type: application/json' -d '{"slug":"foo","title":"Foo"}' http://localhost:8080/api/packages/` returns 201 with the new package; the Progress module logs `Progress module received PackageCreated for ... (foo)`.
