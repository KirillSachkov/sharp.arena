# Architecture

Two anchor decisions drive the whole codebase.

## 1. One engine, two shells

A single `tasks` table backs both modes. Arena = task packages. Story =
chapters + chapter_tasks + narrative gating. Difference is navigation/UI,
not the data model.

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

Single backend process. Inside `ArenaApi.Core`, code is organised by
**module**, not by technical layer. Each module owns:

- its own Postgres schema (`arena_<module>`),
- its own EF Core `DbContext` (never shared),
- its own folder under `ArenaApi.Core/Modules/<Name>/` with the layout
  `Public/ Domain/ Features/ Infrastructure/`.

A module's `Public/` folder is the only surface other modules see — every
other folder is implementation detail, enforced by `NetArchTest` rules in
`tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs`.

| Module        | Schema             | Owns                                                  |
| ------------- | ------------------ | ----------------------------------------------------- |
| Content       | `arena_content`    | Packages, tasks, chapters, hints                      |
| Execution     | `arena_execution`  | Runners, run requests, results, Docker sandbox        |
| Progress      | `arena_progress`   | User attempts, completion, XP, scoreboard             |
| IdentityStub  | `arena_identity`   | `ICurrentUser` — hardcoded `Guid` (stub until SSO)    |

Phase 0 implements **Content** fully and ships **Execution** and **Progress**
as skeletons (DbContext + outbox service only). **IdentityStub** is fully
wired but currently unused by callers.

### Project layout

| Project                                       | Owns                                                        |
| --------------------------------------------- | ----------------------------------------------------------- |
| `ArenaApi.Web`                                | Minimal API host, `Program.cs`, Wolverine configuration     |
| `ArenaApi.Core`                               | `Shared/` primitives and `Modules/<Name>/` (modular body)   |
| `ArenaApi.Contracts`                          | HTTP DTOs (no Domain dependency)                            |
| `ArenaApi.Infrastructure`                     | Reserved shell for cross-cutting infra (OTel, jobs, …)      |

`ArenaApi.Domain` and `ArenaApi.Infrastructure.Postgres` no longer exist —
domain types live per-module under `Modules/<M>/Domain/` and each module
registers its own `DbContext` from `Modules/<M>/Infrastructure/`.

Vertical slice convention inside a module:

```
ArenaApi.Core/Modules/<Module>/Features/<Action><Name>/
├── <Action><Name>Command.cs       # or Query
├── <Action><Name>Handler.cs       # returns Result<T, Error>
└── <Action><Name>Endpoint.cs      # minimal API mapping
```

Reads cross-module via `I<Module>Reader` (in `Public/`) — no repository
abstraction layer.

`Result<T, Error>` (from `CSharpFunctionalExtensions`) is the railway-oriented
return type for handlers. No throwing for business outcomes.

### Communication between modules

Three legal paths, in order of preference:

1. **Sync read via public contract.** A module exposes `I<Module>Reader`
   in its `Public/` folder; other modules inject the interface. Read-only.
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
- Per-module wrapper: `<Module>OutboxService` in
  `Modules/<Module>/Infrastructure/`, implementing the shared
  `IOutboxService` shape. Handlers inject the concrete wrapper (not the
  interface) to avoid DI collisions between modules.

### Identity is a stub

`Modules/IdentityStub/Public/ICurrentUser.cs` exposes one property:
`Guid UserId`. The implementation reads a hardcoded ID from
`appsettings:IdentityStub:HardcodedUserId`. When real SSO arrives (via the
education-platform integration), the implementation behind `ICurrentUser`
swaps; nothing else changes. Do not add fields here unless every consumer
truly needs them across SSO migration — extra surface = extra rewrite.

## Data model — per-module schemas

Each module owns exactly one Postgres schema and never reads across schema
boundaries. Cross-module reads flow through `I<Module>Reader`.

| Schema              | Owner module  | Currently provisioned tables                          |
| ------------------- | ------------- | ----------------------------------------------------- |
| `arena_content`     | Content       | `packages` (Phase 0)                                  |
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

arena_content.chapters
  id, slug, title, ordering, story_md, prerequisite_chapter_id,
  map_position_x, map_position_y, preview_asset, is_published

arena_content.chapter_tasks
  chapter_id, task_id, ordering

arena_identity.users
  id, email (nullable), external_user_id (nullable), avatar_asset, created_at

arena_execution.runs
  id, user_id, task_id, code, status, tests_passed, tests_total,
  duration_ms, output, created_at

arena_progress.user_task_progress
  user_id, task_id, first_passed_at, best_run_id, attempts_count

arena_progress.user_chapter_progress
  user_id, chapter_id, unlocked_at, completed_at
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
| GET    | `/api/chapters/`                      | List chapters (Story mode)                          |
| GET    | `/api/chapters/{id}/`                 | Chapter detail + tasks + gating                     |

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
