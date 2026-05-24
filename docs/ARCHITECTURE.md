# Architecture

Two anchor decisions drive the whole codebase.

## 1. One engine, two shells

A single `tasks` table backs both modes. Arena = task packages. Story =
**campaigns → acts → chapters → tasks** with narrative gating and
interactive map navigation. Difference is navigation/UI and the
campaign/act/chapter wrapper around tasks — the underlying task content
and execution path are shared.

The Story wrapper lives in its own module (`Modules/Story/`) with its
own Postgres schema (`arena_story`). It reads tasks from Content via
`IContentReader`. See [story-mode.md](./story-mode.md) for the full Story
data model and API.

## 2. Multi-language by design

New language = new `runners/<lang>/Dockerfile` + an `IRunner` implementation.
Core engine never changes when a language is added.

## Abstractions

| Interface         | Role                                                          | Phase 0 status |
| ----------------- | ------------------------------------------------------------- | -------------- |
| `IRunner`         | Take submitted code + harness + tests, return `RunVerdict`    | Not built      |
| `ITestFormat`     | Parse runner output → tests-passed / tests-total + stderr     | Not built      |
| `IContentLoader`  | Load tasks/packages from DB or seed bundle                    | Not built      |

`IRunner` shape (planned):

```csharp
public interface IRunner
{
    string Language { get; }
    Task<RunVerdict> RunAsync(RunRequest request, CancellationToken ct);
}

public sealed record RunRequest(
    string UserCode,
    string HarnessCode,
    string TestsCode,
    TimeSpan TimeLimit,
    int MemoryLimitMb);

public sealed record RunVerdict(
    RunStatus Status,
    int TestsPassed,
    int TestsTotal,
    int DurationMs,
    string Stdout,
    string Stderr);
```

Where `RunStatus` is one of `Passed | Failed | CompileError | RuntimeError |
Timeout | OutOfMemory | RunnerError`.

## Modular monolith

Single backend process. Each module is a set of csproj projects
(`ArenaApi.Modules.<Name>.{Contracts, Domain, Core, Infrastructure.Postgres}`),
wired into one DI container by `ArenaApi.Web`. Module isolation is
compiler-enforced via the csproj ProjectReference graph — no NetArchTest.

Each module owns:

- its own Postgres schema (`arena_<module>`),
- its own EF Core `DbContext` (in its `Infrastructure.Postgres` project — never in Core),
- its own `Contracts` project as the only surface other modules may reference.

| Module        | Schema             | Owns                                                  |
| ------------- | ------------------ | ----------------------------------------------------- |
| Content       | `arena_content`    | Packages, tasks, chapters, hints                      |
| Execution     | `arena_execution`  | Runners, run requests, results, Docker sandbox        |
| Progress      | `arena_progress`   | User attempts, completion, XP, scoreboard             |
| IdentityStub  | `arena_identity`   | `ICurrentUser` — hardcoded `Guid` (stub until SSO)    |
| Story         | `arena_story`      | Campaigns, acts, chapters, story inserts, map layouts |

Phase 0 implements **Content** fully and ships **Execution** and **Progress**
as skeletons (DbContext + OutboxService + TransactionManager only).
**IdentityStub** is fully wired but currently unused by callers. **Story** is
specified in [story-mode.md](./story-mode.md) but no code lands until Phase 2.

### Project layout

| Project                                                                               | Owns                                                                              |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ArenaApi.Web`                                                                        | Minimal API host, `Program.cs`, Wolverine wiring, auto-discovery via `AddHandlers/AddValidatorsFromAssembly/AddEndpoints` |
| `ArenaApi.SharedKernel`                                                               | Cross-cutting primitives + abstractions: `ICommand`, `ICommandHandler`, `IQuery`, `IQueryHandler`, `ITransactionManager`, `IEndpoint`, `Error`, `IClock`, `IDomainEvent`, `ConnectionStringNames` |
| `Modules/<Name>/ArenaApi.Modules.<Name>.Contracts`                                    | Cross-module surface: HTTP DTOs, `I<X>Reader`, view DTOs, integration events      |
| `Modules/<Name>/ArenaApi.Modules.<Name>.Domain`                                       | Aggregates, value objects, domain events (Content only; skeletons skip this)      |
| `Modules/<Name>/ArenaApi.Modules.<Name>.Core`                                         | `Database/` (repository + outbox interfaces), `Features/<Area>/UseCases/<Action>.cs` (vertical slice) |
| `Modules/<Name>/ArenaApi.Modules.<Name>.Infrastructure.Postgres`                      | `<Name>DbContext`, EF `Configurations/`, repository impls, `Database/TransactionManager`, `OutboxService` impl, `DependencyInjectionExtensions.Add<Name>Infrastructure`, `Migrations/` |

### Reference graph (one-way)

```
SharedKernel        ← (no internal refs)

Contracts           → SharedKernel
Domain              → SharedKernel
Core                → Domain, Contracts, SharedKernel
Infrastructure.Postgres → Core, Domain, SharedKernel   [Domain only for Content]
Web                 → SharedKernel, every module's Core + Infrastructure.Postgres + Contracts (transitively)
```

Cross-module: `Progress.Core` → `Content.Contracts` is the only inter-module
reference (`PackageCreatedHandler` consumes the `PackageCreated` integration
event).

### Vertical slice convention

`<Module>.Core/Features/<Area>/UseCases/<Action>.cs` contains four public
sealed classes in one file (requires `#pragma warning disable MA0048` at the
top — Meziantou enforces one-type-per-file):

```
Modules/<Module>/ArenaApi.Modules.<Module>.Core/Features/<Area>/UseCases/<Action>.cs
  <Action>Endpoint   : IEndpoint              — MinimalAPI route mapping
  <Action>Command    : ICommand               — input record (or Query : IQuery)
  <Action>Validator  : AbstractValidator<...> — FluentValidation rules
  <Action>Handler    : ICommandHandler<TResp, <Action>Command>
                       — depends on I<X>Repository + ITransactionManager + IValidator + IOutboxService + IClock
                       — NEVER on DbContext directly
```

`Result<T, Error>` (from `CSharpFunctionalExtensions`) is the railway-oriented
return type for handlers. No throwing for business outcomes.

Endpoints implement `IEndpoint` (defined in `SharedKernel/Endpoints/`) and are
auto-discovered by reflection — no manual wiring in `Program.cs`.

### Repository pattern

Each module defines `I<X>Repository` in `<Module>.Core/Database/` and the
implementation in `<Module>.Infrastructure.Postgres/<X>Repository.cs`. Handlers
depend on the interface; the DbContext is never injected into handlers.

`ITransactionManager` (interface in `SharedKernel/Database/`, per-module impl
in each `Infrastructure.Postgres/Database/TransactionManager.cs`) wraps
`BeginTransactionAsync` / `CommitAsync` / `RollbackAsync` so handlers can
control transaction scope without touching EF Core.

### Communication between modules

Three legal paths, in order of preference:

1. **Sync read via public contract.** A module exposes `I<Module>Reader`
   in its `Contracts` project; other modules inject the interface. Read-only.
   No mutations, no business logic — just projection.
2. **Domain events (intra-module).** Aggregates raise `IDomainEvent` inside
   themselves; handlers in the same module react in the same DB transaction.
   Never crosses a module boundary.
3. **Integration events (inter-module).** Side effects that cross modules
   travel through Wolverine + RabbitMQ with a Postgres durable outbox. Even
   when the consumer is in-process, the message goes through the broker —
   so extracting a module into its own service later is mechanical (no
   call-site changes).

Direct cross-module method calls for mutations are **forbidden**. Use an
integration event. Direct DB reads across schemas are **forbidden**. Use a
reader.

### Wolverine + durable outbox

- Schema: `arena_wolverine` (auto-provisioned at startup).
- Setup:
  `backend/ArenaApi/src/ArenaApi.Web/Configuration/WolverineConfiguration.cs`
  exposes `UseArenaWolverine` as an extension on `IHostApplicationBuilder`.
- RabbitMQ transport: `AutoProvision` + `UseConventionalRouting`, with
  durable inbox and outbox policies applied globally so that every cross-
  module event routes through the broker even when consumer and producer
  share a process.
- Transactional middleware: `opts.UseEntityFrameworkCoreTransactions()`
  wraps every module's `DbContext` so `SaveChangesAsync` and outbound
  envelopes commit atomically.
- Per-module outbox: `IOutboxService` interface in
  `Modules/<Module>/ArenaApi.Modules.<Module>.Core/Database/IOutboxService.cs`;
  `OutboxService` impl in
  `Modules/<Module>/ArenaApi.Modules.<Module>.Infrastructure.Postgres/OutboxService.cs`.
  Handlers inject via the module-scoped interface to avoid DI collisions.

### Identity is a stub

`Modules/IdentityStub/ArenaApi.Modules.IdentityStub.Contracts/ICurrentUser.cs`
exposes one property: `Guid UserId`. The implementation reads a hardcoded ID
from `appsettings:IdentityStub:HardcodedUserId`. When real SSO arrives (via the
education-platform integration), the implementation behind `ICurrentUser`
swaps; nothing else changes. Do not add fields here unless every consumer
truly needs them across SSO migration — extra surface = extra rewrite.

## Data model — per-module schemas

Each module owns exactly one Postgres schema and never reads across schema
boundaries. Cross-module reads flow through `I<Module>Reader`.

| Schema              | Owner module  | Currently provisioned tables                          |
| ------------------- | ------------- | ----------------------------------------------------- |
| `arena_content`     | Content       | `packages` (Phase 0)                                  |
| `arena_story`       | Story         | _none yet — designed only, lands in Phase 2_          |
| `arena_execution`   | Execution     | _none yet — skeleton DbContext_                       |
| `arena_progress`    | Progress      | _none yet — skeleton DbContext_                       |
| `arena_identity`    | IdentityStub  | _none — stub user is config-only_                     |
| `arena_wolverine`   | Wolverine     | envelope tables (auto-provisioned)                    |

### Phase 1 data model (planned)

The following tables are not yet created; they land as Phase 1 progresses
and each module gets its own corrective migration.

```
arena_content.packages
  id, slug, title, description, language, mode, ordering, banner_asset, is_published

arena_content.tasks
  id, package_id, slug, title, difficulty, ordering, language,
  problem_md, starter_code, harness_code, tests_code, solution_code,
  hints (jsonb), xp_reward, time_limit_seconds, memory_limit_mb, is_published

# Story tables: see story-mode.md (Phase 2 data model in arena_story schema)

arena_identity.users
  id, email (nullable), external_user_id (nullable), avatar_asset, created_at

arena_execution.runs
  id, user_id, task_id, code, status, tests_passed, tests_total,
  duration_ms, output, created_at

arena_progress.user_task_progress
  user_id, task_id, first_passed_at, best_run_id, attempts_count
```

- All primary keys: `Guid.CreateVersion7()` (time-ordered v7 UUIDs). Banned: `Guid.NewGuid()`.
- Schema name is exposed via `<Module>DbContext.SchemaName` (e.g.
  `ContentDbContext.SchemaName == "arena_content"`).

## API contract — endpoints

Phase 0 ships only the two endpoints below. The rest land in Phase 1+ and
should be added to this table as they go live.

| Method | Path                  | Purpose                                              |
| ------ | --------------------- | ---------------------------------------------------- |
| GET    | `/health`             | Liveness — returns `{ "status": "ok" }`              |
| POST   | `/api/packages/`      | Create a package (Content module smoke endpoint)     |

Planned (Phase 1+):

| Method | Path                                  | Purpose                                             |
| ------ | ------------------------------------- | --------------------------------------------------- |
| GET    | `/api/packages/?language=&mode=`      | List packages (filterable)                          |
| GET    | `/api/packages/{slug}/`               | Package detail + task list                          |
| GET    | `/api/tasks/{id}/`                    | Task detail (problem, starter, hints)               |
| POST   | `/api/runs/`                          | Submit a run → `{ runId }`                          |
| GET    | `/api/runs/{runId}/`                  | Poll a run for verdict                              |
| GET    | `/api/me/`                            | Current user                                        |
| GET    | `/api/packages/{slug}/scoreboard/`    | Per-package leaderboard                             |
| GET    | `/api/story/campaigns/`               | List campaigns (filterable)                         |
| GET    | `/api/story/campaigns/{slug}/`        | Campaign detail: acts + chapters + map paths        |
| GET    | `/api/story/chapters/{id}/`           | Chapter detail: tasks + goals + inserts + rewards   |

Admin (Phase 2, role-gated):

| Method | Path                                          | Purpose                                  |
| ------ | --------------------------------------------- | ---------------------------------------- |
| POST   | `/api/admin/story/campaigns/`                 | Create campaign                          |
| PUT    | `/api/admin/story/campaigns/{id}/`            | Update campaign                          |
| POST   | `/api/admin/story/chapters/`                  | Create chapter                           |
| PUT    | `/api/admin/story/chapters/{id}/`             | Update chapter                           |
| PUT    | `/api/admin/story/chapters/{id}/position/`    | Drag-to-update map position              |
| POST   | `/api/admin/story/inserts/`                   | Create story insert (cutscene)           |

Trailing slash is required — nginx returns `301` without it, which breaks CORS
preflight.

## Code execution model

```
client → POST /api/runs/ with { taskId, code }
       → handler reads task.harness_code + tests_code
       → IRunner.RunAsync({ user, harness, tests, limits })
            → spawns `docker run --rm --cpus=1 --memory=256m
                       --network=none --pids-limit=64 sharp-arena/runner-csharp`
            → mounts the synthesized source into the container
            → stdout is captured, parsed by ITestFormat
       → user_task_attempts row, user_task_progress upsert
       → response: { runId }
client → GET /api/runs/{runId}/ until status != "running"
```

Phase 0 ships no runner. Phase 1 ships the C# runner; later phases add
TypeScript, etc.

## Auth (MVP)

`IdentityStub` hardcoded `Guid` from `appsettings:IdentityStub:HardcodedUserId`.
Every request resolves to the same user until real SSO lands via the
education-platform integration. When SSO arrives, swap the `ICurrentUser`
implementation behind the interface — no caller changes.
