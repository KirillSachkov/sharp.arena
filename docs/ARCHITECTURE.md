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

## Service layout

Single backend `ArenaApi/` with five projects:

```
ArenaApi.Web                    Minimal API host, Program.cs, appsettings
ArenaApi.Core                   Application logic — vertical slices in Features/
ArenaApi.Domain                 Entities, aggregates, value objects, domain events
ArenaApi.Contracts              HTTP DTOs (no Domain dependency)
ArenaApi.Infrastructure.Postgres   ArenaDbContext, EF configs, migrations
```

Vertical slice convention:

```
ArenaApi.Core/Features/<Name>/
├── UseCases/
│   └── <Action><Name>/
│       ├── <Action><Name>Query.cs       # or Command
│       ├── <Action><Name>Handler.cs     # returns Result<T, Error>
│       └── <Action><Name>Endpoint.cs    # minimal API mapping
├── Repositories/
│   ├── I<Name>sRepository.cs
│   └── <Name>sRepository.cs             # implementation lives in Infrastructure.Postgres
└── Domain/                              # feature-local types if needed
```

`Result<T, Error>` (from `CSharpFunctionalExtensions`) is the railway-oriented
return type for handlers. No throwing for business outcomes.

## Data model — schema `arena`

```
packages
  id, slug, title, description, language, mode, ordering, banner_asset, is_published

tasks
  id, package_id, slug, title, difficulty, ordering, language,
  problem_md, starter_code, harness_code, tests_code, solution_code,
  hints (jsonb), xp_reward, time_limit_seconds, memory_limit_mb, is_published

chapters
  id, slug, title, ordering, story_md, prerequisite_chapter_id,
  map_position_x, map_position_y, preview_asset, is_published

chapter_tasks
  chapter_id, task_id, ordering

users
  id, email (nullable), anonymous_id (nullable), avatar_asset, created_at

user_task_attempts
  id, user_id, task_id, code, status, tests_passed, tests_total,
  duration_ms, output, created_at

user_task_progress
  user_id, task_id, first_passed_at, best_attempt_id, attempts_count

user_chapter_progress
  user_id, chapter_id, unlocked_at, completed_at
```

- All primary keys: `Guid.CreateVersion7()` (time-ordered v7 UUIDs). Banned: `Guid.NewGuid()`.
- Default DB schema: `arena`. See `ArenaDbContext.SchemaName`.

## API contract — endpoints

| Method | Path                                  | Purpose                                             |
| ------ | ------------------------------------- | --------------------------------------------------- |
| GET    | `/health`                             | Liveness — returns `{ "status": "ok" }`             |
| GET    | `/api/packages/?language=&mode=`      | List packages (filterable)                          |
| GET    | `/api/packages/{slug}/`               | Package detail + task list                          |
| GET    | `/api/tasks/{id}/`                    | Task detail (problem, starter, hints)               |
| POST   | `/api/runs/`                          | Submit a run → `{ runId }`                          |
| GET    | `/api/runs/{runId}/`                  | Poll a run for verdict                              |
| GET    | `/api/me/`                            | Current user (anonymous-cookie identity)            |
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

Anonymous UUID cookie. No login screen for Phase 1. Email/social auth comes
later, once a user collects enough progress to want to keep it.
