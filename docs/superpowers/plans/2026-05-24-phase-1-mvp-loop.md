# Phase 1 MVP Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the minimum end-to-end loop where a user opens one seeded C# task in the Arena, edits code in Monaco, hits Run, and sees the verdict (passed/failed test counts + stdout/stderr) pushed back via SSE — code actually executes inside a Docker sandbox via `IRunner` / `ITestFormat`.

**Architecture:**
- **Backend:** `Content` module gains a `ContentTask` aggregate + `GET /api/tasks/{slug}/` + a startup seeder that inserts one FizzBuzz task. `Execution` module is filled in — `IRunner`/`ITestFormat`/`RunRequest`/`RunVerdict` contracts in `Public/`, a `CSharpRunner` that shells out to `docker run`, a `Run` aggregate with its table, `POST /api/runs/` + `GET /api/runs/{id}/` + `GET /api/runs/{id}/events` (SSE). `SubmitRunHandler` writes the row and publishes an `ExecuteRunRequested` message through Wolverine; `ExecuteRunHandler` consumes it, calls `IRunner`, updates the row, and pushes a terminal `RunEvent` into the in-memory `IRunEventStream` that the SSE endpoint subscribes to.
- **Runner image:** `runners/csharp/` becomes a real `mcr.microsoft.com/dotnet/sdk:10.0` image. `entrypoint.sh` writes `UserCode` / `HarnessCode` to mounted files, runs `dotnet run`, captures stdout/stderr/exit. The harness prints `TEST <n> PASS|FAIL[: msg]` lines; `TextTestFormat` parses them on the host. No xUnit/TRX yet — that's a future `ITestFormat`.
- **Frontend:** Add TanStack Query + Monaco. Replace mock task data with a real `GET /api/tasks/{slug}/` query. New `entities/run` slice with `submitRun` + an `EventSource`-backed `useRunCode` feature hook. `TaskEditorPanel` becomes Monaco-backed and editable; `TaskTestsPanel` shows the real verdict.

**Tech Stack:** .NET 10 (existing), Wolverine 5.x + RabbitMQ + Postgres outbox (existing), Docker CLI (`docker run`), Next.js 16 + React 19 + TanStack Query v5 + `@monaco-editor/react`, browser-native `EventSource` for SSE.

**Conventions used throughout:**
- All entity primary keys: `Guid.CreateVersion7()`. `Guid.NewGuid()` is banned.
- All HTTP API URLs end with `/` (nginx 301-redirects otherwise).
- Handlers return `Result<T, Error>`. No throwing for business outcomes.
- Cross-module reads via `I<Module>Reader` from `Public/`. No direct DbContext leakage.
- New entity in Content: **named `ContentTask`** (not `Task`) — collision with `System.Threading.Tasks.Task` would force qualified-namespace litter everywhere. DB table stays `tasks`; the cross-module view stays `TaskView`; HTTP DTO stays `TaskResponse`.
- New deferred deps go through `Directory.Packages.props` (backend) or `package.json` (frontend) — no inline versions.
- Frontend: no manual `useMemo`/`useCallback`/`React.memo`; React Compiler handles it. Imports stay within FSD layer boundaries (`app → widgets → features → entities → shared`).
- Each commit is small and self-contained. Run the build/lint/tests at the marked checkpoints.

**Worktree recommendation:** This plan touches both backend and frontend across many files. Run via `superpowers:using-git-worktrees` in a `phase-1-mvp-loop` worktree before starting.

**Explicit CLAUDE.md exception:** The root `CLAUDE.md` lists "WebSockets, SSE" under *What NOT to add without explicit ask*. SSE here was explicitly requested by the user. Task 41 updates `CLAUDE.md` to record the exception so future sessions don't flag it as a violation.

---

## File Structure

### Backend — Content module (new files)
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/ContentTask.cs` — aggregate
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TaskView.cs` — cross-module projection (carries harness/tests because Execution needs them)
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/ContentTaskConfiguration.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentSeeder.cs` + `ContentSeederHostedService.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/GetTaskHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/GetTaskEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/<ts>_ContentAddTasks.cs` (generated)

### Backend — Content module (modified files)
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContext.cs` — add `DbSet<ContentTask> Tasks`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IContentReader.cs` — add `GetTaskBySlugAsync`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentReader.cs` — implement above
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/ContentModule.cs` — register handler/seeder, map endpoint

### Backend — Execution module (new files)
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/IRunner.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/ITestFormat.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/RunRequest.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/RunVerdict.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/RunStatus.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/IRunEventStream.cs` + `RunEvent.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Domain/Run.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/Configurations/RunConfiguration.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/InMemoryRunEventStream.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/TextTestFormat.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/CSharpRunner.cs` + `CSharpRunnerOptions.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/Migrations/<ts>_ExecutionInitial.cs` (generated)
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContextDesignTimeFactory.cs` (mirror of Content one — needed for EF tooling)
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/SubmitRunCommand.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/SubmitRunHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/SubmitRunEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/ExecuteRunRequested.cs` — intra-module message
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/ExecuteRunHandler.cs` — Wolverine consumer
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/GetRun/GetRunEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/StreamRunEvents/StreamRunEventsEndpoint.cs`

### Backend — Execution module (modified files)
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContext.cs` — add `DbSet<Run> Runs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/ExecutionModule.cs` — register everything, map endpoints

### Backend — Web (modified files)
- `backend/ArenaApi/src/ArenaApi.Web/Program.cs` — `MapExecutionEndpoints()`, seeder hosted service
- `backend/ArenaApi/src/ArenaApi.Web/appsettings.json` — `CSharpRunner` block (image tag, defaults)
- `backend/ArenaApi/src/ArenaApi.Web/appsettings.Development.json` — same
- `backend/ArenaApi/src/ArenaApi.Web/appsettings.Docker.json` — same

### Backend — Contracts (new files)
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/TaskResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Execution/SubmitRunRequest.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Execution/RunResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Execution/RunEventPayload.cs`

### Backend — Tests
- `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Execution/TextTestFormatTests.cs`
- `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Execution/SubmitRunEndpointTests.cs`
- `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs` — extend to migrate Execution too, register a `FakeRunner` override

### Runner image (rewritten files)
- `runners/csharp/Dockerfile`
- `runners/csharp/entrypoint.sh`
- `runners/csharp/Solution.csproj` (new — bundled csproj template)

### Scripts (modified)
- `scripts/dev.sh` — fix broken `migrate` command (refers to deleted `Infrastructure.Postgres`); add `runner-build` subcommand

### Frontend — package + setup
- `frontend/package.json` — add `@monaco-editor/react`, `@tanstack/react-query`
- `frontend/src/shared/providers/query-provider.tsx`
- `frontend/src/app/layout.tsx` — wrap children
- `frontend/.env.local.example` — document `NEXT_PUBLIC_API_URL`

### Frontend — slices
- `frontend/src/shared/api/client.ts` + `index.ts`
- `frontend/src/entities/task/api.ts` (TanStack query options)
- `frontend/src/entities/task/types.ts` — extend with API DTO (`TaskDetail` from API)
- `frontend/src/entities/task/index.ts` — re-export
- `frontend/src/entities/run/types.ts`
- `frontend/src/entities/run/api.ts`
- `frontend/src/entities/run/index.ts`
- `frontend/src/features/run-code/use-run-code.ts`
- `frontend/src/features/run-code/index.ts`
- `frontend/src/widgets/task-workspace/task-editor-panel.tsx` — Monaco-backed, dispatches `useRunCode`
- `frontend/src/widgets/task-workspace/task-tests-panel.tsx` — shows real verdict from hook
- `frontend/src/widgets/task-workspace/index.ts` — re-export the new `TaskWorkspace` wrapper
- `frontend/src/widgets/task-workspace/task-workspace.tsx` — new wrapper that owns the `useRunCode` state and passes it to the two panels (so they share state without lifting through page)
- `frontend/src/app/arena/tasks/[id]/page.tsx` — fetch from API instead of mock

### Docs
- `docs/ROADMAP.md` — flip Phase 1 checkboxes as items complete
- `docs/ARCHITECTURE.md` — add `/api/tasks/`, `/api/runs/`, `/api/runs/{id}/events` rows to API table
- `CLAUDE.md` — record SSE exception under "What NOT to add"

---

## Conventions used in tasks below

- Each task lists **Files** and a list of checkboxed **Step**s.
- Every code step includes the **full content** of the change, not just a diff hint.
- `<ts>` in migration filenames is the EF-generated timestamp; don't pick one yourself.
- Build/run commands assume PWD = repo root unless stated.
- After each task with new code, **commit** with a Conventional Commits message scoped to the module.

---

## Task 1: `ContentTask` aggregate in Content/Domain

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/ContentTask.cs`

- [ ] **Step 1: Write the entity**

```csharp
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Core.Modules.Content.Domain;

internal sealed class ContentTask
{
    public Guid Id { get; private init; }
    public string Slug { get; private init; } = null!;
    public string Title { get; private init; } = null!;
    public string Language { get; private init; } = null!;
    public string ProblemMarkdown { get; private init; } = null!;
    public string StarterCode { get; private init; } = null!;
    public string HarnessCode { get; private init; } = null!;
    public int TimeLimitSeconds { get; private init; }
    public int MemoryLimitMb { get; private init; }
    public DateTimeOffset CreatedAt { get; private init; }

    private ContentTask() { } // EF Core

    public static Result<ContentTask, Error> Create(
        string slug,
        string title,
        string language,
        string problemMarkdown,
        string starterCode,
        string harnessCode,
        int timeLimitSeconds,
        int memoryLimitMb,
        DateTimeOffset createdAt)
    {
        if (string.IsNullOrWhiteSpace(slug))
            return Error.Validation(nameof(slug), "Slug must not be empty.");
        if (string.IsNullOrWhiteSpace(title))
            return Error.Validation(nameof(title), "Title must not be empty.");
        if (language != "csharp")
            return Error.Validation(nameof(language), "Only 'csharp' is supported in Phase 1.");
        if (string.IsNullOrWhiteSpace(harnessCode))
            return Error.Validation(nameof(harnessCode), "Harness code must not be empty.");
        if (timeLimitSeconds is <= 0 or > 60)
            return Error.Validation(nameof(timeLimitSeconds), "Time limit must be between 1 and 60 seconds.");
        if (memoryLimitMb is < 32 or > 1024)
            return Error.Validation(nameof(memoryLimitMb), "Memory limit must be between 32 and 1024 MB.");

        return new ContentTask
        {
            Id = Guid.CreateVersion7(),
            Slug = slug.Trim(),
            Title = title.Trim(),
            Language = language,
            ProblemMarkdown = problemMarkdown ?? string.Empty,
            StarterCode = starterCode ?? string.Empty,
            HarnessCode = harnessCode,
            TimeLimitSeconds = timeLimitSeconds,
            MemoryLimitMb = memoryLimitMb,
            CreatedAt = createdAt,
        };
    }
}
```

- [ ] **Step 2: Build the Core project to verify it compiles**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded` with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/ContentTask.cs
git commit -m "feat(content): add ContentTask aggregate"
```

---

## Task 2: `TaskView` cross-module projection

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TaskView.cs`

- [ ] **Step 1: Write the projection**

`TaskView` carries `HarnessCode` because Execution needs it at run-time. The HTTP-facing `TaskResponse` (added later, in Contracts) is a stricter projection that omits the harness.

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

/// Cross-module projection of a content task. Carries everything other
/// modules need to act on the task, including the runner harness — Execution
/// reads this to assemble the runner submission.
public sealed record TaskView(
    Guid Id,
    string Slug,
    string Title,
    string Language,
    string ProblemMarkdown,
    string StarterCode,
    string HarnessCode,
    int TimeLimitSeconds,
    int MemoryLimitMb,
    DateTimeOffset CreatedAt);
```

- [ ] **Step 2: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TaskView.cs
git commit -m "feat(content): add TaskView cross-module projection"
```

---

## Task 3: `ContentTaskConfiguration` EF Core mapping

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/ContentTaskConfiguration.cs`

- [ ] **Step 1: Write the configuration**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Core.Modules.Content.Infrastructure.Configurations;

internal sealed class ContentTaskConfiguration : IEntityTypeConfiguration<ContentTask>
{
    public void Configure(EntityTypeBuilder<ContentTask> b)
    {
        b.ToTable("tasks");

        b.HasKey(t => t.Id);
        b.Property(t => t.Id).HasColumnName("id");

        b.Property(t => t.Slug).HasColumnName("slug").HasMaxLength(120).IsRequired();
        b.HasIndex(t => t.Slug).IsUnique();

        b.Property(t => t.Title).HasColumnName("title").HasMaxLength(200).IsRequired();
        b.Property(t => t.Language).HasColumnName("language").HasMaxLength(32).IsRequired();
        b.Property(t => t.ProblemMarkdown).HasColumnName("problem_markdown").IsRequired();
        b.Property(t => t.StarterCode).HasColumnName("starter_code").IsRequired();
        b.Property(t => t.HarnessCode).HasColumnName("harness_code").IsRequired();
        b.Property(t => t.TimeLimitSeconds).HasColumnName("time_limit_seconds").IsRequired();
        b.Property(t => t.MemoryLimitMb).HasColumnName("memory_limit_mb").IsRequired();
        b.Property(t => t.CreatedAt).HasColumnName("created_at").IsRequired();
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/ContentTaskConfiguration.cs
git commit -m "feat(content): map ContentTask to arena_content.tasks"
```

---

## Task 4: Expose `Tasks` DbSet on `ContentDbContext`

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContext.cs`

- [ ] **Step 1: Add the DbSet**

Replace the entire file with:

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Infrastructure;

public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_content";

    internal DbSet<Package> Packages => Set<Package>();
    internal DbSet<ContentTask> Tasks => Set<ContentTask>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ContentDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Core.Modules.Content.Infrastructure.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
```

- [ ] **Step 2: Build to confirm**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContext.cs
git commit -m "feat(content): expose Tasks DbSet on ContentDbContext"
```

---

## Task 5: Extend `IContentReader` with `GetTaskBySlugAsync`

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IContentReader.cs`
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentReader.cs`

- [ ] **Step 1: Update the interface**

Replace the entire file:

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

/// Sync read contract for other modules. Implementation lives in
/// Content/Infrastructure/ContentReader.cs and queries ContentDbContext.
public interface IContentReader
{
    Task<PackageView?> GetPackageAsync(Guid packageId, CancellationToken cancellationToken = default);

    Task<TaskView?> GetTaskBySlugAsync(string slug, CancellationToken cancellationToken = default);

    Task<TaskView?> GetTaskByIdAsync(Guid taskId, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 2: Update the implementation**

Replace `ContentReader.cs` entirely:

```csharp
using ArenaApi.Core.Modules.Content.Public;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Infrastructure;

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

    public Task<TaskView?> GetTaskBySlugAsync(string slug, CancellationToken cancellationToken = default)
    {
        return db.Tasks
            .AsNoTracking()
            .Where(t => t.Slug == slug)
            .Select(t => new TaskView(
                t.Id,
                t.Slug,
                t.Title,
                t.Language,
                t.ProblemMarkdown,
                t.StarterCode,
                t.HarnessCode,
                t.TimeLimitSeconds,
                t.MemoryLimitMb,
                t.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public Task<TaskView?> GetTaskByIdAsync(Guid taskId, CancellationToken cancellationToken = default)
    {
        return db.Tasks
            .AsNoTracking()
            .Where(t => t.Id == taskId)
            .Select(t => new TaskView(
                t.Id,
                t.Slug,
                t.Title,
                t.Language,
                t.ProblemMarkdown,
                t.StarterCode,
                t.HarnessCode,
                t.TimeLimitSeconds,
                t.MemoryLimitMb,
                t.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IContentReader.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentReader.cs
git commit -m "feat(content): expose GetTaskBySlugAsync / GetTaskByIdAsync"
```

---

## Task 6: Generate `ContentAddTasks` EF migration

**Files:**
- Generated: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/<ts>_ContentAddTasks.cs`
- Generated: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/<ts>_ContentAddTasks.Designer.cs`
- Generated/updated: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/ContentDbContextModelSnapshot.cs`

- [ ] **Step 1: Generate the migration**

Run from repo root:

```bash
dotnet ef migrations add ContentAddTasks \
  --project backend/ArenaApi/src/ArenaApi.Core \
  --startup-project backend/ArenaApi/src/ArenaApi.Web \
  --context ContentDbContext \
  --output-dir Modules/Content/Infrastructure/Migrations
```

Expected: A new migration file pair under the Migrations folder and an updated snapshot. The `Up` body should `CreateTable("tasks", schema: "arena_content", ...)` with columns matching `ContentTaskConfiguration`.

- [ ] **Step 2: Inspect the generated Up()**

Open the generated `<ts>_ContentAddTasks.cs` and verify:
- Schema is `arena_content`
- All columns from `ContentTaskConfiguration` are present
- `slug` has a unique index
- `problem_markdown`, `starter_code`, `harness_code` are unbounded `text` (Postgres default for unconstrained strings)

If anything is wrong (e.g. mismatched lengths), delete the migration with `dotnet ef migrations remove --project ... --startup-project ...`, fix the configuration, and regenerate.

- [ ] **Step 3: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/
git commit -m "feat(content): add ContentAddTasks migration"
```

---

## Task 7: `GetTask` feature slice (handler + endpoint)

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/GetTaskHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/GetTaskEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/TaskResponse.cs`

- [ ] **Step 1: Write the HTTP DTO**

`backend/ArenaApi/src/ArenaApi.Contracts/Content/TaskResponse.cs`:

```csharp
namespace ArenaApi.Contracts.Content;

/// HTTP-facing task projection. Excludes harness code — that lives server-side
/// only and is never sent to the client. starter_code is included so the
/// editor can pre-populate.
public sealed record TaskResponse(
    Guid Id,
    string Slug,
    string Title,
    string Language,
    string ProblemMarkdown,
    string StarterCode,
    int TimeLimitSeconds,
    int MemoryLimitMb);
```

- [ ] **Step 2: Write the handler**

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/GetTaskHandler.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Core.Modules.Content.Features.GetTask;

internal sealed class GetTaskHandler(IContentReader reader)
{
    public async Task<Result<TaskView, Error>> HandleAsync(
        string slug,
        CancellationToken cancellationToken)
    {
        TaskView? task = await reader.GetTaskBySlugAsync(slug, cancellationToken).ConfigureAwait(false);
        return task is null
            ? Error.NotFound("Task", slug)
            : task;
    }
}
```

- [ ] **Step 3: Write the endpoint**

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/GetTaskEndpoint.cs`:

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.GetTask;

internal static class GetTaskEndpoint
{
    public static IEndpointRouteBuilder MapGetTask(this IEndpointRouteBuilder group)
    {
        group.MapGet("/{slug}/", HandleAsync)
            .WithName("GetTask")
            .WithTags("Content");
        return group;
    }

    private static async Task<Results<Ok<TaskResponse>, NotFound<ErrorPayload>>> HandleAsync(
        string slug,
        GetTaskHandler handler,
        CancellationToken cancellationToken)
    {
        Result<TaskView, Error> result = await handler
            .HandleAsync(slug, cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            return TypedResults.NotFound(new ErrorPayload(result.Error.Code, result.Error.Message));
        }

        TaskView v = result.Value;
        return TypedResults.Ok(new TaskResponse(
            v.Id, v.Slug, v.Title, v.Language, v.ProblemMarkdown,
            v.StarterCode, v.TimeLimitSeconds, v.MemoryLimitMb));
    }

    internal sealed record ErrorPayload(string Code, string Message);
}
```

- [ ] **Step 4: Build**

Run: `dotnet build backend/ArenaApi -nologo`
Expected: `Build succeeded`.

- [ ] **Step 5: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Content/TaskResponse.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/
git commit -m "feat(content): GET /api/tasks/{slug}/ endpoint"
```

---

## Task 8: Hardcoded `ContentSeeder` for one FizzBuzz task

Inserts one task at startup if `arena_content.tasks` is empty. The harness is a self-contained C# `Program.cs` that prints `TEST <n> PASS|FAIL` lines.

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentSeeder.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentSeederHostedService.cs`

- [ ] **Step 1: Write the seeder**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Shared.Errors;
using ArenaApi.Core.Shared.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ArenaApi.Core.Modules.Content.Infrastructure;

internal sealed partial class ContentSeeder(
    ContentDbContext db,
    IClock clock,
    ILogger<ContentSeeder> logger)
{
    private const string FizzBuzzSlug = "fizzbuzz";

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        bool alreadySeeded = await db.Tasks
            .AsNoTracking()
            .AnyAsync(t => t.Slug == FizzBuzzSlug, cancellationToken)
            .ConfigureAwait(false);

        if (alreadySeeded)
        {
            LogSkipped(logger, FizzBuzzSlug);
            return;
        }

        Result<ContentTask, Error> result = ContentTask.Create(
            slug: FizzBuzzSlug,
            title: "FizzBuzz",
            language: "csharp",
            problemMarkdown: FizzBuzzProblem,
            starterCode: FizzBuzzStarter,
            harnessCode: FizzBuzzHarness,
            timeLimitSeconds: 5,
            memoryLimitMb: 128,
            createdAt: clock.UtcNow);

        if (result.IsFailure)
        {
            throw new InvalidOperationException(
                $"FizzBuzz seed task failed validation: {result.Error.Code} — {result.Error.Message}");
        }

        await db.Tasks.AddAsync(result.Value, cancellationToken).ConfigureAwait(false);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        LogSeeded(logger, FizzBuzzSlug, result.Value.Id);
    }

    [LoggerMessage(EventId = 100, Level = LogLevel.Information, Message = "ContentSeeder: '{Slug}' already present; nothing to do.")]
    private static partial void LogSkipped(ILogger logger, string slug);

    [LoggerMessage(EventId = 101, Level = LogLevel.Information, Message = "ContentSeeder: inserted '{Slug}' as {TaskId}.")]
    private static partial void LogSeeded(ILogger logger, string slug, Guid taskId);

    private const string FizzBuzzProblem = """
        # FizzBuzz

        Implement `Solution.FizzBuzz(int n)` that returns a list of strings of length `n` where:

        - Multiples of 3 are `"Fizz"`.
        - Multiples of 5 are `"Buzz"`.
        - Multiples of both 3 and 5 are `"FizzBuzz"`.
        - All other numbers are the number itself, as a string.

        The list is 1-indexed: the first element is for `1`, the last for `n`.
        """;

    private const string FizzBuzzStarter = """
        using System;
        using System.Collections.Generic;

        public static class Solution
        {
            public static List<string> FizzBuzz(int n)
            {
                // Your code here.
                return new List<string>();
            }
        }
        """;

    private const string FizzBuzzHarness = """
        using System;
        using System.Collections.Generic;
        using System.Linq;

        public static class Harness
        {
            public static int Main()
            {
                int passed = 0;
                int total = 0;

                Check(1, () =>
                {
                    var r = Solution.FizzBuzz(3);
                    return r.Count == 3
                        && r[0] == "1" && r[1] == "2" && r[2] == "Fizz"
                        ? null
                        : "Expected [1,2,Fizz], got [" + string.Join(",", r) + "]";
                }, ref passed, ref total);

                Check(2, () =>
                {
                    var r = Solution.FizzBuzz(5);
                    return r.Count == 5
                        && r[4] == "Buzz"
                        ? null
                        : "Element 5 should be Buzz; got " + (r.Count >= 5 ? r[4] : "<missing>");
                }, ref passed, ref total);

                Check(3, () =>
                {
                    var r = Solution.FizzBuzz(15);
                    return r.Count == 15 && r[14] == "FizzBuzz"
                        ? null
                        : "Element 15 should be FizzBuzz; got " + (r.Count >= 15 ? r[14] : "<missing>");
                }, ref passed, ref total);

                Console.WriteLine($"SUMMARY {passed}/{total}");
                return passed == total ? 0 : 1;
            }

            private static void Check(int index, Func<string?> body, ref int passed, ref int total)
            {
                total++;
                try
                {
                    string? failure = body();
                    if (failure is null)
                    {
                        Console.WriteLine($"TEST {index} PASS");
                        passed++;
                    }
                    else
                    {
                        Console.WriteLine($"TEST {index} FAIL: {failure}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"TEST {index} FAIL: {ex.GetType().Name} — {ex.Message}");
                }
            }
        }
        """;
}
```

- [ ] **Step 2: Write the hosted service that runs it once**

`ContentSeederHostedService.cs`:

```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace ArenaApi.Core.Modules.Content.Infrastructure;

internal sealed class ContentSeederHostedService(IServiceScopeFactory scopeFactory) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using IServiceScope scope = scopeFactory.CreateScope();
        ContentSeeder seeder = scope.ServiceProvider.GetRequiredService<ContentSeeder>();
        await seeder.SeedAsync(cancellationToken).ConfigureAwait(false);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
```

- [ ] **Step 3: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentSeeder.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentSeederHostedService.cs
git commit -m "feat(content): seed FizzBuzz task on startup"
```

---

## Task 9: Register seeder + GetTask handler + endpoint in `ContentModule`

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/ContentModule.cs`

- [ ] **Step 1: Update the module registration**

Replace the file entirely:

```csharp
using ArenaApi.Core.Modules.Content.Features.CreatePackage;
using ArenaApi.Core.Modules.Content.Features.GetTask;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Shared.Time;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace ArenaApi.Core.Modules.Content;

public static class ContentModule
{
    public static IServiceCollection AddContentModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ContentDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ArenaApi.Core.ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ContentDbContext.SchemaName)));

        services.AddScoped<IContentReader, ContentReader>();
        services.AddScoped<ContentOutboxService>();
        services.AddScoped<CreatePackageHandler>();
        services.AddScoped<GetTaskHandler>();
        services.AddScoped<ContentSeeder>();
        services.AddHostedService<ContentSeederHostedService>();
        services.AddSingleton<IClock, SystemClock>();

        return services;
    }

    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder packages = app.MapGroup("/api/packages");
        packages.MapCreatePackage();

        RouteGroupBuilder tasks = app.MapGroup("/api/tasks");
        tasks.MapGetTask();

        return app;
    }
}
```

- [ ] **Step 2: Build the full backend**

Run: `dotnet build backend/ArenaApi -nologo`
Expected: `Build succeeded`.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/ContentModule.cs
git commit -m "feat(content): wire GetTask endpoint and FizzBuzz seeder"
```

---

## Task 10: `Execution.Public` — `RunStatus`, `RunRequest`, `RunVerdict`, `RunEvent`

These are the language-agnostic contracts named in `docs/ARCHITECTURE.md`. They live in `Public/` because other modules and the SSE endpoint depend on them.

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/RunStatus.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/RunRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/RunVerdict.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/RunEvent.cs`

- [ ] **Step 1: Write `RunStatus`**

```csharp
namespace ArenaApi.Core.Modules.Execution.Public;

public enum RunStatus
{
    Pending = 0,
    Running = 1,
    Passed = 2,
    Failed = 3,
    CompileError = 4,
    RuntimeError = 5,
    Timeout = 6,
    OutOfMemory = 7,
    RunnerError = 8,
}

public static class RunStatusExtensions
{
    public static bool IsTerminal(this RunStatus status) =>
        status is RunStatus.Passed or RunStatus.Failed
              or RunStatus.CompileError or RunStatus.RuntimeError
              or RunStatus.Timeout or RunStatus.OutOfMemory
              or RunStatus.RunnerError;
}
```

- [ ] **Step 2: Write `RunRequest`**

```csharp
namespace ArenaApi.Core.Modules.Execution.Public;

public sealed record RunRequest(
    string UserCode,
    string HarnessCode,
    TimeSpan TimeLimit,
    int MemoryLimitMb);
```

- [ ] **Step 3: Write `RunVerdict`**

```csharp
namespace ArenaApi.Core.Modules.Execution.Public;

public sealed record RunVerdict(
    RunStatus Status,
    int TestsPassed,
    int TestsTotal,
    int DurationMs,
    string Stdout,
    string Stderr);
```

- [ ] **Step 4: Write `RunEvent`**

```csharp
namespace ArenaApi.Core.Modules.Execution.Public;

/// Single SSE-bound update for a run. Emitted by ExecuteRunHandler at start
/// and on terminal completion. Verdict is null until the run reaches a
/// terminal status.
public sealed record RunEvent(
    Guid RunId,
    RunStatus Status,
    RunVerdict? Verdict);
```

- [ ] **Step 5: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 6: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/
git commit -m "feat(execution): RunStatus/RunRequest/RunVerdict/RunEvent contracts"
```

---

## Task 11: `IRunner` and `ITestFormat` interfaces

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/IRunner.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/ITestFormat.cs`

- [ ] **Step 1: Write `IRunner`**

```csharp
namespace ArenaApi.Core.Modules.Execution.Public;

/// One implementation per supported language. Phase 1 ships CSharpRunner;
/// adding TypeScript = new IRunner + new runners/typescript/Dockerfile, no
/// changes to the engine.
public interface IRunner
{
    string Language { get; }

    Task<RunVerdict> RunAsync(RunRequest request, CancellationToken cancellationToken);
}
```

- [ ] **Step 2: Write `ITestFormat`**

```csharp
namespace ArenaApi.Core.Modules.Execution.Public;

/// Parses the stdout/stderr of a finished runner process into a structured
/// RunVerdict. One implementation per harness convention (TextTestFormat for
/// the `TEST n PASS|FAIL` lines; future ones for xUnit TRX, Jest, etc.).
public interface ITestFormat
{
    RunVerdict Parse(int exitCode, string stdout, string stderr, int durationMs, bool timedOut);
}
```

- [ ] **Step 3: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/IRunner.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/ITestFormat.cs
git commit -m "feat(execution): IRunner + ITestFormat abstractions"
```

---

## Task 12: `IRunEventStream` pub/sub contract

In-memory bus the Wolverine `ExecuteRunHandler` pushes `RunEvent`s into, and the SSE endpoint subscribes to per-runId. Single-process is fine for Phase 1; replacing with Redis pub/sub later is mechanical.

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/IRunEventStream.cs`

- [ ] **Step 1: Write the interface**

```csharp
namespace ArenaApi.Core.Modules.Execution.Public;

/// In-process pub/sub for RunEvent. The SSE endpoint subscribes per-runId
/// and reads from the returned channel; ExecuteRunHandler publishes events
/// as it works. Multiple subscribers per runId are supported (the same run
/// could be watched from two browser tabs).
public interface IRunEventStream
{
    /// Subscribe to events for a specific run. Cancelling the token completes
    /// the channel from the writer side so the reader's await terminates.
    IAsyncEnumerable<RunEvent> SubscribeAsync(Guid runId, CancellationToken cancellationToken);

    Task PublishAsync(RunEvent runEvent, CancellationToken cancellationToken);
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Public/IRunEventStream.cs
git commit -m "feat(execution): IRunEventStream pub/sub contract"
```

---

## Task 13: `Run` aggregate in Execution/Domain

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Domain/Run.cs`

- [ ] **Step 1: Write the entity**

```csharp
using ArenaApi.Core.Modules.Execution.Public;

namespace ArenaApi.Core.Modules.Execution.Domain;

internal sealed class Run
{
    public Guid Id { get; private init; }
    public Guid UserId { get; private init; }
    public Guid TaskId { get; private init; }
    public string Language { get; private init; } = null!;
    public string UserCode { get; private init; } = null!;
    public RunStatus Status { get; private set; }
    public int TestsPassed { get; private set; }
    public int TestsTotal { get; private set; }
    public int DurationMs { get; private set; }
    public string Stdout { get; private set; } = string.Empty;
    public string Stderr { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private init; }
    public DateTimeOffset? CompletedAt { get; private set; }

    private Run() { } // EF Core

    public static Run Submit(
        Guid userId,
        Guid taskId,
        string language,
        string userCode,
        DateTimeOffset createdAt) => new()
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            TaskId = taskId,
            Language = language,
            UserCode = userCode,
            Status = RunStatus.Pending,
            CreatedAt = createdAt,
        };

    public void MarkRunning() => Status = RunStatus.Running;

    public void ApplyVerdict(RunVerdict verdict, DateTimeOffset completedAt)
    {
        Status = verdict.Status;
        TestsPassed = verdict.TestsPassed;
        TestsTotal = verdict.TestsTotal;
        DurationMs = verdict.DurationMs;
        Stdout = verdict.Stdout ?? string.Empty;
        Stderr = verdict.Stderr ?? string.Empty;
        CompletedAt = completedAt;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Domain/Run.cs
git commit -m "feat(execution): Run aggregate"
```

---

## Task 14: `RunConfiguration` EF mapping + DbContext update

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/Configurations/RunConfiguration.cs`
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContext.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContextDesignTimeFactory.cs`

- [ ] **Step 1: Write `RunConfiguration`**

```csharp
using ArenaApi.Core.Modules.Execution.Domain;
using ArenaApi.Core.Modules.Execution.Public;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Core.Modules.Execution.Infrastructure.Configurations;

internal sealed class RunConfiguration : IEntityTypeConfiguration<Run>
{
    public void Configure(EntityTypeBuilder<Run> b)
    {
        b.ToTable("runs");

        b.HasKey(r => r.Id);
        b.Property(r => r.Id).HasColumnName("id");
        b.Property(r => r.UserId).HasColumnName("user_id").IsRequired();
        b.Property(r => r.TaskId).HasColumnName("task_id").IsRequired();
        b.HasIndex(r => r.TaskId);
        b.HasIndex(r => r.UserId);

        b.Property(r => r.Language).HasColumnName("language").HasMaxLength(32).IsRequired();
        b.Property(r => r.UserCode).HasColumnName("user_code").IsRequired();

        b.Property(r => r.Status)
            .HasColumnName("status")
            .HasConversion<int>()
            .IsRequired();

        b.Property(r => r.TestsPassed).HasColumnName("tests_passed").IsRequired();
        b.Property(r => r.TestsTotal).HasColumnName("tests_total").IsRequired();
        b.Property(r => r.DurationMs).HasColumnName("duration_ms").IsRequired();

        b.Property(r => r.Stdout).HasColumnName("stdout").IsRequired();
        b.Property(r => r.Stderr).HasColumnName("stderr").IsRequired();

        b.Property(r => r.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(r => r.CompletedAt).HasColumnName("completed_at");
    }
}
```

- [ ] **Step 2: Update `ExecutionDbContext`**

Replace the file:

```csharp
using ArenaApi.Core.Modules.Execution.Domain;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Execution.Infrastructure;

public sealed class ExecutionDbContext(DbContextOptions<ExecutionDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_execution";

    internal DbSet<Run> Runs => Set<Run>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ExecutionDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Core.Modules.Execution.Infrastructure.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
```

- [ ] **Step 3: Write the design-time factory (mirror of Content)**

`ExecutionDbContextDesignTimeFactory.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ArenaApi.Core.Modules.Execution.Infrastructure;

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

- [ ] **Step 4: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 5: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/Configurations/RunConfiguration.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContext.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/ExecutionDbContextDesignTimeFactory.cs
git commit -m "feat(execution): map Run to arena_execution.runs + design-time factory"
```

---

## Task 15: Generate `ExecutionInitial` EF migration

**Files:**
- Generated: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/Migrations/<ts>_ExecutionInitial.cs`

- [ ] **Step 1: Generate**

```bash
dotnet ef migrations add ExecutionInitial \
  --project backend/ArenaApi/src/ArenaApi.Core \
  --startup-project backend/ArenaApi/src/ArenaApi.Web \
  --context ExecutionDbContext \
  --output-dir Modules/Execution/Infrastructure/Migrations
```

Expected: A new migration creating `arena_execution.runs` with all columns from `RunConfiguration`, plus the two non-unique indexes on `task_id` and `user_id`.

- [ ] **Step 2: Inspect the generated Up()**

Open the new migration file and verify:
- `EnsureSchema("arena_execution")`
- `CreateTable("runs", schema: "arena_execution", ...)`
- `status` is `int` (because we configured `HasConversion<int>()`)
- Indexes `IX_runs_task_id` and `IX_runs_user_id` are present
- `completed_at` is nullable

If anything is wrong, `dotnet ef migrations remove ...` and regenerate after fixing the configuration.

- [ ] **Step 3: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/Migrations/
git commit -m "feat(execution): ExecutionInitial migration for runs table"
```

---

## Task 16: `InMemoryRunEventStream` implementation

Per-runId `Channel<RunEvent>`s held in a `ConcurrentDictionary`. When a subscriber's cancellation fires, the channel is removed. Publishes fan out to all current subscribers for the runId, then keep the channel around in case a late subscriber joins (we cap retention with a small last-event buffer so a subscriber who connects after the run finished still sees the terminal event — needed for SSE reconnects).

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/InMemoryRunEventStream.cs`

- [ ] **Step 1: Write it**

```csharp
using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading.Channels;
using ArenaApi.Core.Modules.Execution.Public;

namespace ArenaApi.Core.Modules.Execution.Infrastructure;

internal sealed class InMemoryRunEventStream : IRunEventStream
{
    private sealed class RunChannel
    {
        public readonly List<Channel<RunEvent>> Subscribers = new();
        public RunEvent? LastEvent;
    }

    private readonly ConcurrentDictionary<Guid, RunChannel> _channels = new();
    private readonly object _gate = new();

    public async IAsyncEnumerable<RunEvent> SubscribeAsync(
        Guid runId,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        Channel<RunEvent> channel = Channel.CreateUnbounded<RunEvent>(
            new UnboundedChannelOptions { SingleReader = true, SingleWriter = false });

        RunChannel runChannel;
        RunEvent? replay;
        lock (_gate)
        {
            runChannel = _channels.GetOrAdd(runId, _ => new RunChannel());
            runChannel.Subscribers.Add(channel);
            replay = runChannel.LastEvent;
        }

        if (replay is not null)
        {
            yield return replay;
            if (replay.Status.IsTerminal())
            {
                Remove(runId, channel);
                yield break;
            }
        }

        try
        {
            await foreach (RunEvent ev in channel.Reader.ReadAllAsync(cancellationToken).ConfigureAwait(false))
            {
                yield return ev;
                if (ev.Status.IsTerminal())
                {
                    yield break;
                }
            }
        }
        finally
        {
            Remove(runId, channel);
        }
    }

    public Task PublishAsync(RunEvent runEvent, CancellationToken cancellationToken)
    {
        List<Channel<RunEvent>> subscribers;
        lock (_gate)
        {
            RunChannel runChannel = _channels.GetOrAdd(runEvent.RunId, _ => new RunChannel());
            runChannel.LastEvent = runEvent;
            subscribers = new List<Channel<RunEvent>>(runChannel.Subscribers);
        }

        foreach (Channel<RunEvent> ch in subscribers)
        {
            ch.Writer.TryWrite(runEvent);
            if (runEvent.Status.IsTerminal())
            {
                ch.Writer.TryComplete();
            }
        }

        return Task.CompletedTask;
    }

    private void Remove(Guid runId, Channel<RunEvent> channel)
    {
        lock (_gate)
        {
            if (_channels.TryGetValue(runId, out RunChannel? runChannel))
            {
                runChannel.Subscribers.Remove(channel);
                // We intentionally keep the entry around (with LastEvent) so a
                // late subscriber that connects within the same process lifetime
                // can still replay the terminal event. The dictionary is bounded
                // in practice by the run rate per process.
            }
        }
    }
}
```

- [ ] **Step 2: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/InMemoryRunEventStream.cs
git commit -m "feat(execution): in-memory IRunEventStream for SSE fanout"
```

---

## Task 17: `TextTestFormat` parser + unit tests

Parses harness stdout looking for `TEST <n> PASS` and `TEST <n> FAIL[: msg]` lines, plus an optional `SUMMARY <p>/<t>` trailer. Maps exit code / `timedOut` / stderr to the right `RunStatus`.

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/TextTestFormat.cs`
- Create: `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Execution/TextTestFormatTests.cs`

- [ ] **Step 1: Write the failing tests**

`TextTestFormatTests.cs`:

```csharp
using ArenaApi.Core.Modules.Execution.Infrastructure;
using ArenaApi.Core.Modules.Execution.Public;
using Xunit;

namespace ArenaApi.UnitTests.Modules.Execution;

public sealed class TextTestFormatTests
{
    private readonly TextTestFormat _sut = new();

    [Fact]
    public void All_passes_returns_Passed()
    {
        string stdout = "TEST 1 PASS\nTEST 2 PASS\nTEST 3 PASS\nSUMMARY 3/3\n";

        RunVerdict v = _sut.Parse(exitCode: 0, stdout: stdout, stderr: "", durationMs: 123, timedOut: false);

        Assert.Equal(RunStatus.Passed, v.Status);
        Assert.Equal(3, v.TestsPassed);
        Assert.Equal(3, v.TestsTotal);
        Assert.Equal(123, v.DurationMs);
    }

    [Fact]
    public void Partial_pass_returns_Failed_with_counts()
    {
        string stdout = "TEST 1 PASS\nTEST 2 FAIL: expected 3 got 5\nTEST 3 PASS\n";

        RunVerdict v = _sut.Parse(exitCode: 1, stdout: stdout, stderr: "", durationMs: 80, timedOut: false);

        Assert.Equal(RunStatus.Failed, v.Status);
        Assert.Equal(2, v.TestsPassed);
        Assert.Equal(3, v.TestsTotal);
    }

    [Fact]
    public void TimedOut_overrides_exit_code()
    {
        RunVerdict v = _sut.Parse(exitCode: 137, stdout: "", stderr: "", durationMs: 5000, timedOut: true);
        Assert.Equal(RunStatus.Timeout, v.Status);
    }

    [Fact]
    public void Empty_stdout_and_nonzero_exit_returns_RuntimeError()
    {
        RunVerdict v = _sut.Parse(exitCode: 1, stdout: "", stderr: "boom", durationMs: 10, timedOut: false);
        Assert.Equal(RunStatus.RuntimeError, v.Status);
    }

    [Fact]
    public void Compile_error_marker_returns_CompileError()
    {
        string stderr = "Solution.cs(5,9): error CS1002: ; expected";
        RunVerdict v = _sut.Parse(exitCode: 1, stdout: "", stderr: stderr, durationMs: 200, timedOut: false);
        Assert.Equal(RunStatus.CompileError, v.Status);
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~TextTestFormatTests" -nologo`
Expected: All tests FAIL (`TextTestFormat` does not exist yet).

- [ ] **Step 3: Write the implementation**

`TextTestFormat.cs`:

```csharp
using System.Text.RegularExpressions;
using ArenaApi.Core.Modules.Execution.Public;

namespace ArenaApi.Core.Modules.Execution.Infrastructure;

internal sealed partial class TextTestFormat : ITestFormat
{
    [GeneratedRegex(@"^TEST\s+(\d+)\s+(PASS|FAIL)(?::\s*(.*))?$", RegexOptions.Multiline)]
    private static partial Regex TestLineRegex();

    [GeneratedRegex(@"\berror\s+CS\d{4}\b", RegexOptions.IgnoreCase)]
    private static partial Regex CompileErrorRegex();

    public RunVerdict Parse(int exitCode, string stdout, string stderr, int durationMs, bool timedOut)
    {
        if (timedOut)
        {
            return new RunVerdict(RunStatus.Timeout, 0, 0, durationMs, stdout, stderr);
        }

        int passed = 0;
        int total = 0;
        foreach (Match m in TestLineRegex().Matches(stdout))
        {
            total++;
            if (m.Groups[2].Value == "PASS") passed++;
        }

        if (total == 0)
        {
            if (CompileErrorRegex().IsMatch(stderr))
            {
                return new RunVerdict(RunStatus.CompileError, 0, 0, durationMs, stdout, stderr);
            }

            return new RunVerdict(
                exitCode == 0 ? RunStatus.RunnerError : RunStatus.RuntimeError,
                0, 0, durationMs, stdout, stderr);
        }

        RunStatus status = passed == total ? RunStatus.Passed : RunStatus.Failed;
        return new RunVerdict(status, passed, total, durationMs, stdout, stderr);
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~TextTestFormatTests" -nologo`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/TextTestFormat.cs \
        backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Execution/TextTestFormatTests.cs
git commit -m "feat(execution): TextTestFormat parser + tests"
```

---

## Task 18: `CSharpRunnerOptions` + config wiring

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/CSharpRunnerOptions.cs`

- [ ] **Step 1: Write the options**

```csharp
namespace ArenaApi.Core.Modules.Execution.Infrastructure;

public sealed class CSharpRunnerOptions
{
    public const string SectionName = "CSharpRunner";

    /// Image tag built by `runners/csharp/Dockerfile`. Default matches
    /// `scripts/dev.sh runner-build`.
    public string Image { get; init; } = "sharp-arena/runner-csharp:dev";

    /// Path to docker CLI. Empty = take from PATH.
    public string DockerExecutable { get; init; } = "docker";

    /// CPU limit passed as `--cpus`.
    public string CpuLimit { get; init; } = "1";

    /// Pids limit. Hard cap on processes inside the sandbox.
    public int PidsLimit { get; init; } = 64;

    /// Host directory used to stage submission files. Each submission gets
    /// a unique subdirectory under here that is mounted into the container.
    /// Default: %TMP%/sharp-arena-runs (Path.Combine(Path.GetTempPath(), ...)
    /// at runtime if left null).
    public string? StagingRoot { get; init; }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/CSharpRunnerOptions.cs
git commit -m "feat(execution): CSharpRunnerOptions"
```

---

## Task 19: `CSharpRunner` Docker-spawn implementation

Stages `Solution.cs` (user code) + `Harness.cs` (harness code) into a per-run temp directory, runs:

```
docker run --rm \
  --cpus=1 --memory=<MB>m --pids-limit=64 --network=none \
  -v <staging>:/workspace:ro \
  sharp-arena/runner-csharp:dev
```

Captures stdout/stderr, hands them to `ITestFormat`, returns the verdict.

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/CSharpRunner.cs`

- [ ] **Step 1: Write it**

```csharp
using System.Diagnostics;
using System.Text;
using ArenaApi.Core.Modules.Execution.Public;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ArenaApi.Core.Modules.Execution.Infrastructure;

internal sealed partial class CSharpRunner(
    IOptions<CSharpRunnerOptions> options,
    ITestFormat testFormat,
    ILogger<CSharpRunner> logger) : IRunner
{
    private readonly CSharpRunnerOptions _options = options.Value;

    public string Language => "csharp";

    public async Task<RunVerdict> RunAsync(RunRequest request, CancellationToken cancellationToken)
    {
        string stagingRoot = _options.StagingRoot
            ?? Path.Combine(Path.GetTempPath(), "sharp-arena-runs");
        Directory.CreateDirectory(stagingRoot);

        string workDir = Path.Combine(stagingRoot, Guid.CreateVersion7().ToString("N"));
        Directory.CreateDirectory(workDir);

        try
        {
            await File.WriteAllTextAsync(
                Path.Combine(workDir, "Solution.cs"),
                request.UserCode ?? string.Empty,
                cancellationToken).ConfigureAwait(false);

            await File.WriteAllTextAsync(
                Path.Combine(workDir, "Harness.cs"),
                request.HarnessCode ?? string.Empty,
                cancellationToken).ConfigureAwait(false);

            string args = string.Join(" ",
                "run", "--rm",
                "--cpus=" + _options.CpuLimit,
                "--memory=" + request.MemoryLimitMb + "m",
                "--pids-limit=" + _options.PidsLimit,
                "--network=none",
                "-v", workDir + ":/workspace:ro",
                _options.Image);

            ProcessStartInfo psi = new()
            {
                FileName = _options.DockerExecutable,
                Arguments = args,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            LogSpawning(logger, _options.DockerExecutable, args);

            using Process proc = new() { StartInfo = psi };
            StringBuilder stdoutBuf = new();
            StringBuilder stderrBuf = new();
            proc.OutputDataReceived += (_, e) => { if (e.Data is not null) stdoutBuf.AppendLine(e.Data); };
            proc.ErrorDataReceived += (_, e) => { if (e.Data is not null) stderrBuf.AppendLine(e.Data); };

            Stopwatch sw = Stopwatch.StartNew();
            if (!proc.Start())
            {
                return new RunVerdict(RunStatus.RunnerError, 0, 0, 0, "",
                    "Failed to start docker process.");
            }

            proc.BeginOutputReadLine();
            proc.BeginErrorReadLine();

            using CancellationTokenSource timeoutCts = new(request.TimeLimit + TimeSpan.FromSeconds(2));
            using CancellationTokenSource linkedCts =
                CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

            bool timedOut = false;
            try
            {
                await proc.WaitForExitAsync(linkedCts.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                timedOut = !cancellationToken.IsCancellationRequested;
                try
                {
                    if (!proc.HasExited) proc.Kill(entireProcessTree: true);
                }
                catch (InvalidOperationException) { /* exited between checks */ }
            }

            sw.Stop();

            int exitCode = proc.HasExited ? proc.ExitCode : -1;
            string stdout = stdoutBuf.ToString();
            string stderr = stderrBuf.ToString();
            int durationMs = (int)sw.ElapsedMilliseconds;

            LogFinished(logger, exitCode, durationMs, timedOut, stdout.Length, stderr.Length);

            return testFormat.Parse(exitCode, stdout, stderr, durationMs, timedOut);
        }
        finally
        {
            try { Directory.Delete(workDir, recursive: true); }
            catch (IOException) { /* leave artifacts; cleanup is best-effort */ }
            catch (UnauthorizedAccessException) { /* same */ }
        }
    }

    [LoggerMessage(EventId = 200, Level = LogLevel.Debug, Message = "CSharpRunner: spawning {Exe} {Args}")]
    private static partial void LogSpawning(ILogger logger, string exe, string args);

    [LoggerMessage(EventId = 201, Level = LogLevel.Information,
        Message = "CSharpRunner: finished exit={ExitCode} durationMs={DurationMs} timedOut={TimedOut} stdoutBytes={StdoutBytes} stderrBytes={StderrBytes}")]
    private static partial void LogFinished(ILogger logger, int exitCode, int durationMs, bool timedOut, int stdoutBytes, int stderrBytes);
}
```

- [ ] **Step 2: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Infrastructure/CSharpRunner.cs
git commit -m "feat(execution): CSharpRunner spawns docker run sandbox"
```

---

## Task 20: `ExecuteRunRequested` intra-module message

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/ExecuteRunRequested.cs`

- [ ] **Step 1: Write the message**

```csharp
namespace ArenaApi.Core.Modules.Execution.Features.SubmitRun;

/// Intra-module Wolverine message. Stays inside Execution — does not cross
/// the module boundary, so it lives next to its sender/handler rather than
/// in Public/IntegrationEvents/. SubmitRunHandler publishes via the durable
/// outbox; ExecuteRunHandler picks it up and runs the sandbox.
internal sealed record ExecuteRunRequested(Guid RunId);
```

- [ ] **Step 2: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/ExecuteRunRequested.cs
git commit -m "feat(execution): ExecuteRunRequested message"
```

---

## Task 21: `SubmitRunCommand` + `SubmitRunHandler`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/SubmitRunCommand.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/SubmitRunHandler.cs`

- [ ] **Step 1: Write the command**

```csharp
namespace ArenaApi.Core.Modules.Execution.Features.SubmitRun;

internal sealed record SubmitRunCommand(string TaskSlug, string UserCode);
```

- [ ] **Step 2: Write the handler**

```csharp
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Modules.Execution.Domain;
using ArenaApi.Core.Modules.Execution.Infrastructure;
using ArenaApi.Core.Modules.IdentityStub.Public;
using ArenaApi.Core.Shared.Errors;
using ArenaApi.Core.Shared.Time;
using CSharpFunctionalExtensions;

namespace ArenaApi.Core.Modules.Execution.Features.SubmitRun;

internal sealed class SubmitRunHandler(
    ExecutionDbContext db,
    ExecutionOutboxService outbox,
    IContentReader content,
    ICurrentUser currentUser,
    IClock clock)
{
    public async Task<Result<Guid, Error>> HandleAsync(
        SubmitRunCommand command,
        CancellationToken cancellationToken)
    {
        TaskView? task = await content.GetTaskBySlugAsync(command.TaskSlug, cancellationToken).ConfigureAwait(false);
        if (task is null)
        {
            return Error.NotFound("Task", command.TaskSlug);
        }

        if (string.IsNullOrWhiteSpace(command.UserCode))
        {
            return Error.Validation(nameof(command.UserCode), "User code must not be empty.");
        }

        Run run = Run.Submit(
            userId: currentUser.UserId,
            taskId: task.Id,
            language: task.Language,
            userCode: command.UserCode,
            createdAt: clock.UtcNow);

        await db.Runs.AddAsync(run, cancellationToken).ConfigureAwait(false);

        await outbox.PublishAsync(new ExecuteRunRequested(run.Id), cancellationToken).ConfigureAwait(false);

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        return run.Id;
    }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/SubmitRunCommand.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/SubmitRunHandler.cs
git commit -m "feat(execution): SubmitRunHandler writes Run row + outbox event"
```

---

## Task 22: `SubmitRunEndpoint` + HTTP DTOs

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Execution/SubmitRunRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Execution/SubmitRunResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/SubmitRunEndpoint.cs`

- [ ] **Step 1: Write the request DTO**

```csharp
namespace ArenaApi.Contracts.Execution;

public sealed record SubmitRunRequest(string TaskSlug, string UserCode);
```

- [ ] **Step 2: Write the response DTO**

```csharp
namespace ArenaApi.Contracts.Execution;

public sealed record SubmitRunResponse(Guid RunId);
```

- [ ] **Step 3: Write the endpoint**

```csharp
using ArenaApi.Contracts.Execution;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Execution.Features.SubmitRun;

internal static class SubmitRunEndpoint
{
    public static IEndpointRouteBuilder MapSubmitRun(this IEndpointRouteBuilder group)
    {
        group.MapPost("/", HandleAsync)
            .WithName("SubmitRun")
            .WithTags("Execution");
        return group;
    }

    private static async Task<Results<
        Accepted<SubmitRunResponse>,
        NotFound<ErrorPayload>,
        BadRequest<ErrorPayload>>> HandleAsync(
            SubmitRunRequest request,
            SubmitRunHandler handler,
            CancellationToken cancellationToken)
    {
        Result<Guid, Error> result = await handler
            .HandleAsync(new SubmitRunCommand(request.TaskSlug, request.UserCode), cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            return result.Error.Code.EndsWith("NotFound", StringComparison.Ordinal)
                ? TypedResults.NotFound(payload)
                : TypedResults.BadRequest(payload);
        }

        Guid runId = result.Value;
        return TypedResults.Accepted($"/api/runs/{runId}/", new SubmitRunResponse(runId));
    }

    internal sealed record ErrorPayload(string Code, string Message);
}
```

- [ ] **Step 4: Build**

Run: `dotnet build backend/ArenaApi -nologo`
Expected: `Build succeeded`.

- [ ] **Step 5: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Execution/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/SubmitRunEndpoint.cs
git commit -m "feat(execution): POST /api/runs/ endpoint"
```

---

## Task 23: `ExecuteRunHandler` — Wolverine consumer that runs the sandbox

Reads the Run row + Task (via `IContentReader`), publishes a `Running` `RunEvent`, calls `IRunner`, applies the verdict, publishes a terminal `RunEvent`, persists with a single `SaveChangesAsync`.

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/ExecuteRunHandler.cs`

- [ ] **Step 1: Write the handler**

```csharp
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Modules.Execution.Domain;
using ArenaApi.Core.Modules.Execution.Infrastructure;
using ArenaApi.Core.Modules.Execution.Public;
using ArenaApi.Core.Shared.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ArenaApi.Core.Modules.Execution.Features.SubmitRun;

internal sealed partial class ExecuteRunHandler
{
    public static async Task HandleAsync(
        ExecuteRunRequested message,
        ExecutionDbContext db,
        IContentReader content,
        IRunner runner,
        IRunEventStream events,
        IClock clock,
        ILogger<ExecuteRunHandlerCategory> logger,
        CancellationToken cancellationToken)
    {
        Run? run = await db.Runs.FirstOrDefaultAsync(r => r.Id == message.RunId, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            LogRunMissing(logger, message.RunId);
            return;
        }

        TaskView? task = await content.GetTaskByIdAsync(run.TaskId, cancellationToken).ConfigureAwait(false);
        if (task is null)
        {
            LogTaskMissing(logger, run.TaskId);
            RunVerdict missing = new(RunStatus.RunnerError, 0, 0, 0, "", $"Task {run.TaskId} not found.");
            run.ApplyVerdict(missing, clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await events.PublishAsync(new RunEvent(run.Id, missing.Status, missing), cancellationToken).ConfigureAwait(false);
            return;
        }

        run.MarkRunning();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await events.PublishAsync(new RunEvent(run.Id, RunStatus.Running, null), cancellationToken).ConfigureAwait(false);

        RunVerdict verdict;
        try
        {
            verdict = await runner.RunAsync(
                new RunRequest(
                    UserCode: run.UserCode,
                    HarnessCode: task.HarnessCode,
                    TimeLimit: TimeSpan.FromSeconds(task.TimeLimitSeconds),
                    MemoryLimitMb: task.MemoryLimitMb),
                cancellationToken)
                .ConfigureAwait(false);
        }
#pragma warning disable CA1031 // Runner failures must produce a verdict; swallowing here is intentional.
        catch (Exception ex)
        {
            LogRunnerThrew(logger, run.Id, ex);
            verdict = new RunVerdict(RunStatus.RunnerError, 0, 0, 0, "", ex.GetType().Name + ": " + ex.Message);
        }
#pragma warning restore CA1031

        run.ApplyVerdict(verdict, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        await events.PublishAsync(new RunEvent(run.Id, verdict.Status, verdict), cancellationToken).ConfigureAwait(false);
    }

    [LoggerMessage(EventId = 300, Level = LogLevel.Warning, Message = "ExecuteRunHandler: run {RunId} not found.")]
    private static partial void LogRunMissing(ILogger logger, Guid runId);

    [LoggerMessage(EventId = 301, Level = LogLevel.Error, Message = "ExecuteRunHandler: task {TaskId} not found.")]
    private static partial void LogTaskMissing(ILogger logger, Guid taskId);

    [LoggerMessage(EventId = 302, Level = LogLevel.Error, Message = "ExecuteRunHandler: runner threw for run {RunId}.")]
    private static partial void LogRunnerThrew(ILogger logger, Guid runId, Exception exception);

    public sealed class ExecuteRunHandlerCategory;
}
```

- [ ] **Step 2: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo`
Expected: `Build succeeded`.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/SubmitRun/ExecuteRunHandler.cs
git commit -m "feat(execution): ExecuteRunHandler runs sandbox + emits RunEvents"
```

---

## Task 24: `GetRun` endpoint

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Execution/RunResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/GetRun/GetRunEndpoint.cs`

- [ ] **Step 1: Write the response DTO**

```csharp
namespace ArenaApi.Contracts.Execution;

public sealed record RunResponse(
    Guid Id,
    Guid TaskId,
    string Status,
    int TestsPassed,
    int TestsTotal,
    int DurationMs,
    string Stdout,
    string Stderr,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt);
```

- [ ] **Step 2: Write the endpoint**

```csharp
using ArenaApi.Contracts.Execution;
using ArenaApi.Core.Modules.Execution.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Execution.Features.GetRun;

internal static class GetRunEndpoint
{
    public static IEndpointRouteBuilder MapGetRun(this IEndpointRouteBuilder group)
    {
        group.MapGet("/{runId:guid}/", HandleAsync)
            .WithName("GetRun")
            .WithTags("Execution");
        return group;
    }

    private static async Task<Results<Ok<RunResponse>, NotFound>> HandleAsync(
        Guid runId,
        ExecutionDbContext db,
        CancellationToken cancellationToken)
    {
        RunResponse? row = await db.Runs
            .AsNoTracking()
            .Where(r => r.Id == runId)
            .Select(r => new RunResponse(
                r.Id, r.TaskId, r.Status.ToString(),
                r.TestsPassed, r.TestsTotal, r.DurationMs,
                r.Stdout, r.Stderr,
                r.CreatedAt, r.CompletedAt))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return row is null ? TypedResults.NotFound() : TypedResults.Ok(row);
    }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build backend/ArenaApi -nologo`
Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Execution/RunResponse.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/GetRun/
git commit -m "feat(execution): GET /api/runs/{id}/ endpoint"
```

---

## Task 25: SSE endpoint — `GET /api/runs/{id}/events`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Execution/RunEventPayload.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/StreamRunEvents/StreamRunEventsEndpoint.cs`

- [ ] **Step 1: Write the SSE payload DTO**

```csharp
namespace ArenaApi.Contracts.Execution;

public sealed record RunEventPayload(
    Guid RunId,
    string Status,
    int? TestsPassed,
    int? TestsTotal,
    int? DurationMs,
    string? Stdout,
    string? Stderr);
```

- [ ] **Step 2: Write the endpoint**

```csharp
using System.Text.Json;
using ArenaApi.Contracts.Execution;
using ArenaApi.Core.Modules.Execution.Public;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Execution.Features.StreamRunEvents;

internal static class StreamRunEventsEndpoint
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapStreamRunEvents(this IEndpointRouteBuilder group)
    {
        group.MapGet("/{runId:guid}/events/", HandleAsync)
            .WithName("StreamRunEvents")
            .WithTags("Execution");
        return group;
    }

    private static async Task HandleAsync(
        Guid runId,
        HttpContext http,
        IRunEventStream stream,
        CancellationToken cancellationToken)
    {
        http.Response.Headers.ContentType = "text/event-stream";
        http.Response.Headers.CacheControl = "no-cache";
        http.Response.Headers["X-Accel-Buffering"] = "no"; // nginx: disable proxy buffering
        await http.Response.Body.FlushAsync(cancellationToken).ConfigureAwait(false);

        await foreach (RunEvent ev in stream.SubscribeAsync(runId, cancellationToken).ConfigureAwait(false))
        {
            RunEventPayload payload = new(
                RunId: ev.RunId,
                Status: ev.Status.ToString(),
                TestsPassed: ev.Verdict?.TestsPassed,
                TestsTotal: ev.Verdict?.TestsTotal,
                DurationMs: ev.Verdict?.DurationMs,
                Stdout: ev.Verdict?.Stdout,
                Stderr: ev.Verdict?.Stderr);

            string json = JsonSerializer.Serialize(payload, JsonOpts);
            await http.Response.WriteAsync($"data: {json}\n\n", cancellationToken).ConfigureAwait(false);
            await http.Response.Body.FlushAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build backend/ArenaApi -nologo`
Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Execution/RunEventPayload.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/Features/StreamRunEvents/
git commit -m "feat(execution): SSE endpoint GET /api/runs/{id}/events/"
```

---

## Task 26: Wire everything in `ExecutionModule`

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/ExecutionModule.cs`

- [ ] **Step 1: Replace the file**

```csharp
using ArenaApi.Core.Modules.Execution.Features.GetRun;
using ArenaApi.Core.Modules.Execution.Features.StreamRunEvents;
using ArenaApi.Core.Modules.Execution.Features.SubmitRun;
using ArenaApi.Core.Modules.Execution.Infrastructure;
using ArenaApi.Core.Modules.Execution.Public;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Core.Modules.Execution;

public static class ExecutionModule
{
    public static IServiceCollection AddExecutionModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ExecutionDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ArenaApi.Core.ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ExecutionDbContext.SchemaName)));

        services.AddScoped<ExecutionOutboxService>();
        services.AddScoped<SubmitRunHandler>();

        services
            .AddOptions<CSharpRunnerOptions>()
            .Bind(configuration.GetSection(CSharpRunnerOptions.SectionName))
            .ValidateOnStart();

        services.AddSingleton<ITestFormat, TextTestFormat>();
        services.AddSingleton<IRunner, CSharpRunner>();
        services.AddSingleton<IRunEventStream, InMemoryRunEventStream>();

        return services;
    }

    public static IEndpointRouteBuilder MapExecutionEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder runs = app.MapGroup("/api/runs");
        runs.MapSubmitRun();
        runs.MapGetRun();
        runs.MapStreamRunEvents();
        return app;
    }
}
```

- [ ] **Step 2: Build the whole backend**

Run: `dotnet build backend/ArenaApi -nologo`
Expected: `Build succeeded`.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Execution/ExecutionModule.cs
git commit -m "feat(execution): wire IRunner / ITestFormat / SSE + endpoint mapping"
```

---

## Task 27: Update `Program.cs` to map Execution endpoints

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Web/Program.cs`

- [ ] **Step 1: Add `MapExecutionEndpoints()` call**

After the existing `app.MapContentEndpoints();` line, add:

```csharp
app.MapExecutionEndpoints();
```

The full updated file:

```csharp
using ArenaApi.Core;
using ArenaApi.Core.Features.Health;
using ArenaApi.Core.Modules.Content;
using ArenaApi.Core.Modules.Execution;
using ArenaApi.Core.Modules.IdentityStub;
using ArenaApi.Core.Modules.Progress;
using ArenaApi.Web.Configuration;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

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
app.MapExecutionEndpoints();

await app.RunAsync();

namespace ArenaApi.Web
{
    public sealed class Program;
}
```

- [ ] **Step 2: Build the host**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Web -nologo`
Expected: `Build succeeded`.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Web/Program.cs
git commit -m "feat(web): map Execution endpoints"
```

---

## Task 28: Add `CSharpRunner` config to all `appsettings.*.json`

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Web/appsettings.json`
- Modify: `backend/ArenaApi/src/ArenaApi.Web/appsettings.Development.json`
- Modify: `backend/ArenaApi/src/ArenaApi.Web/appsettings.Docker.json`

- [ ] **Step 1: `appsettings.json` — defaults only (no overrides)**

Add a `CSharpRunner` block alongside the existing top-level keys. Final file:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "Database": "Host=localhost;Port=5432;Database=sharp_arena;Username=arena;Password=arena",
    "RabbitMq": "amqp://arena:arena@localhost:5672/",
    "Redis": "localhost:6379"
  },
  "CSharpRunner": {
    "Image": "sharp-arena/runner-csharp:dev",
    "DockerExecutable": "docker",
    "CpuLimit": "1",
    "PidsLimit": 64
  }
}
```

- [ ] **Step 2: `appsettings.Development.json` — no changes needed**

Defaults from `appsettings.json` already work for local dev. Leave the file as-is.

- [ ] **Step 3: `appsettings.Docker.json` — note about Docker-in-Docker**

When the backend itself runs in Docker (`docker-compose up`), the runner spawn needs the host docker socket mounted into the backend container. That mount is added to `docker-compose.yml` in Task 33, not here. Settings stay the same:

```json
{
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "Database": "Host=postgres;Port=5432;Database=sharp_arena;Username=arena;Password=arena",
    "RabbitMq": "amqp://arena:arena@rabbitmq:5672/",
    "Redis": "redis:6379"
  },
  "IdentityStub": {
    "HardcodedUserId": "01970000-0000-7000-8000-000000000001"
  },
  "CSharpRunner": {
    "Image": "sharp-arena/runner-csharp:dev",
    "DockerExecutable": "docker",
    "CpuLimit": "1",
    "PidsLimit": 64
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Web/appsettings.json \
        backend/ArenaApi/src/ArenaApi.Web/appsettings.Docker.json
git commit -m "chore(web): add CSharpRunner config block"
```

---

## Task 29: Update `IntegrationTestsWebFactory` — migrate Execution + override `IRunner`

The existing factory only migrates Content. Now we need to migrate Execution as well, and provide a way to override `IRunner` with a fake so SubmitRun tests don't actually spawn Docker.

**Files:**
- Modify: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs`

- [ ] **Step 1: Replace the file**

```csharp
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Modules.Execution.Infrastructure;
using ArenaApi.Core.Modules.Execution.Public;
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

    public string PostgresConnectionString => _postgres.GetConnectionString();
    public string RabbitConnectionString => _rabbit.GetConnectionString();

    /// Set in test arrange step to swap out the real CSharpRunner.
    public IRunner? RunnerOverride { get; set; }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await _rabbit.StartAsync();
        await CreateSchemasAsync();

        using IServiceScope scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ContentDbContext>().Database.MigrateAsync();
        await scope.ServiceProvider.GetRequiredService<ExecutionDbContext>().Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
        await _rabbit.DisposeAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Database", PostgresConnectionString);
        builder.UseSetting("ConnectionStrings:RabbitMq", RabbitConnectionString);
        builder.UseSetting("ConnectionStrings:Redis", "localhost:6379");
        builder.UseSetting("IdentityStub:HardcodedUserId", Guid.CreateVersion7().ToString());

        builder.ConfigureServices(services =>
        {
            // Replace the real CSharpRunner with whatever the test set on
            // `RunnerOverride`. Tests register a fake before creating the client.
            services.RemoveAll<IRunner>();
            services.AddSingleton<IRunner>(_ => RunnerOverride
                ?? throw new InvalidOperationException(
                    "Integration tests must set IntegrationTestsWebFactory.RunnerOverride before creating an HttpClient."));
        });
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

- [ ] **Step 2: Add `using Microsoft.Extensions.DependencyInjection.Extensions;` if `RemoveAll` is not found**

In the same file add the import:

```csharp
using Microsoft.Extensions.DependencyInjection.Extensions;
```

- [ ] **Step 3: Build the tests project**

Run: `dotnet build backend/ArenaApi/tests/ArenaApi.IntegrationTests -nologo`
Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs
git commit -m "test(it): migrate Execution + allow IRunner override"
```

---

## Task 30: Integration test — `POST /api/runs/` end-to-end with `FakeRunner`

Uses the seeded FizzBuzz task. Verifies:
1. `POST /api/runs/` returns 202 Accepted with a `runId`.
2. After Wolverine processes the message, `GET /api/runs/{id}/` returns a terminal status matching what the fake produced.

**Files:**
- Create: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Execution/SubmitRunEndpointTests.cs`

- [ ] **Step 1: Write the test**

```csharp
using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using ArenaApi.Contracts.Execution;
using ArenaApi.Core.Modules.Execution.Public;
using ArenaApi.IntegrationTests.Infrastructure;
using Xunit;

namespace ArenaApi.IntegrationTests.Modules.Execution;

[Collection(nameof(IntegrationTestsCollection))]
public sealed class SubmitRunEndpointTests
{
    private readonly IntegrationTestsWebFactory _factory;

    public SubmitRunEndpointTests(IntegrationTestsWebFactory factory) => _factory = factory;

    private sealed class FakeRunner(RunVerdict verdict) : IRunner
    {
        public string Language => "csharp";
        public Task<RunVerdict> RunAsync(RunRequest request, CancellationToken cancellationToken)
            => Task.FromResult(verdict);
    }

    [Fact]
    public async Task SubmitRun_persists_run_and_applies_fake_verdict()
    {
        _factory.RunnerOverride = new FakeRunner(
            new RunVerdict(RunStatus.Passed, 3, 3, 42, "TEST 1 PASS\nTEST 2 PASS\nTEST 3 PASS\n", ""));

        HttpClient client = _factory.CreateClient();

        HttpResponseMessage submit = await client.PostAsJsonAsync(
            "/api/runs/",
            new SubmitRunRequest(TaskSlug: "fizzbuzz", UserCode: "// dummy"));

        Assert.Equal(HttpStatusCode.Accepted, submit.StatusCode);

        SubmitRunResponse? submitBody = await submit.Content.ReadFromJsonAsync<SubmitRunResponse>();
        Assert.NotNull(submitBody);
        Assert.NotEqual(Guid.Empty, submitBody!.RunId);

        RunResponse? final = await WaitForTerminalAsync(client, submitBody.RunId);
        Assert.NotNull(final);
        Assert.Equal("Passed", final!.Status);
        Assert.Equal(3, final.TestsPassed);
        Assert.Equal(3, final.TestsTotal);
    }

    private static async Task<RunResponse?> WaitForTerminalAsync(HttpClient client, Guid runId)
    {
        DateTime deadline = DateTime.UtcNow.AddSeconds(20);
        while (DateTime.UtcNow < deadline)
        {
            HttpResponseMessage r = await client.GetAsync(
                new Uri($"/api/runs/{runId.ToString("D", CultureInfo.InvariantCulture)}/", UriKind.Relative));

            if (r.StatusCode == HttpStatusCode.OK)
            {
                RunResponse? body = await r.Content.ReadFromJsonAsync<RunResponse>();
                if (body is not null && body.Status is not "Pending" and not "Running")
                {
                    return body;
                }
            }

            await Task.Delay(250);
        }

        return null;
    }
}
```

- [ ] **Step 2: Run the test**

Run: `dotnet test backend/ArenaApi/tests/ArenaApi.IntegrationTests --filter "FullyQualifiedName~SubmitRunEndpointTests" -nologo`
Expected: PASS within 20 s. (First run is slow — Testcontainers pulls images.)

- [ ] **Step 3: If the test fails because the FizzBuzz seed never ran**

Reason: the hosted seeder service runs on app start, but `WebApplicationFactory` runs Wolverine asynchronously. The seeder logs `inserted 'fizzbuzz'` once. If the test races it, the slug lookup returns null and SubmitRun returns 404.

Fix: Before sending the POST, hit a warmup endpoint that forces the host to fully start. The simplest path:

```csharp
HttpResponseMessage warmup = await client.GetAsync(new Uri("/health/", UriKind.Relative));
Assert.True(warmup.IsSuccessStatusCode);
```

But — `HealthEndpoints` already maps `/health` (no trailing slash). Check the path in `HealthEndpoints.cs`. If it's `/health`, call that path. Add this line at the start of the test, before the POST.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Execution/SubmitRunEndpointTests.cs
git commit -m "test(it): SubmitRun + ExecuteRunHandler end-to-end with FakeRunner"
```

---

## Task 31: Real `runners/csharp/Dockerfile` + `entrypoint.sh` + `Solution.csproj`

Replaces the Phase 0 stubs. The image ships a pre-baked `Solution.csproj` that references `Solution.cs` (user code) and `Harness.cs` (harness code), both mounted at `/workspace`. The entrypoint copies them into a working dir, runs `dotnet run`, returns the subprocess exit code.

We pre-restore packages at build time by warming the NuGet cache with a placeholder build, so the per-submission `dotnet run` doesn't go to the network (the sandbox runs with `--network=none`).

**Files:**
- Replace: `runners/csharp/Dockerfile`
- Replace: `runners/csharp/entrypoint.sh`
- Create: `runners/csharp/Solution.csproj`

- [ ] **Step 1: Write `Solution.csproj`**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>Submission</RootNamespace>
    <AssemblyName>Submission</AssemblyName>
    <StartupObject>Harness</StartupObject>
    <UseAppHost>false</UseAppHost>
  </PropertyGroup>
</Project>
```

- [ ] **Step 2: Write `entrypoint.sh`**

```bash
#!/usr/bin/env bash
# Sharp Arena C# runner entrypoint.
#
# Reads /workspace/Solution.cs (user code) and /workspace/Harness.cs (harness)
# from a read-only mount, copies them into /sandbox, and runs `dotnet run`.
# Subprocess stdout/stderr propagate to docker run; its exit code is ours.

set -uo pipefail

if [[ ! -f /workspace/Solution.cs ]]; then
    echo "runner-csharp: /workspace/Solution.cs missing" >&2
    exit 90
fi

if [[ ! -f /workspace/Harness.cs ]]; then
    echo "runner-csharp: /workspace/Harness.cs missing" >&2
    exit 91
fi

cp /workspace/Solution.cs /sandbox/Solution.cs
cp /workspace/Harness.cs /sandbox/Harness.cs

cd /sandbox
exec dotnet run --no-restore --configuration Release --project /sandbox/Solution.csproj
```

- [ ] **Step 3: Write the `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
#
# Sharp Arena C# runner — Phase 1 real implementation.
# Build: docker build -t sharp-arena/runner-csharp:dev runners/csharp
# Run shape (production):
#   docker run --rm --cpus=1 --memory=128m --pids-limit=64 --network=none \
#     -v <staging-dir>:/workspace:ro sharp-arena/runner-csharp:dev

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS final

ENV DOTNET_NOLOGO=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_GENERATE_ASPNET_CERTIFICATE=false \
    NUGET_XMLDOC_MODE=skip \
    DOTNET_USE_POLLING_FILE_WATCHER=1 \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1

# /sandbox holds the assembled project. We pre-warm restore by building a
# trivial placeholder so the per-submission `dotnet run` skips network.
WORKDIR /sandbox
COPY Solution.csproj /sandbox/Solution.csproj
RUN <<EOF
cat > /sandbox/Solution.cs <<'CS'
namespace Submission { public static class Solution {} }
CS
cat > /sandbox/Harness.cs <<'CS'
public static class Harness {
    public static int Main() { System.Console.WriteLine("warmup"); return 0; }
}
CS
dotnet restore --packages /root/.nuget/packages /sandbox/Solution.csproj
dotnet build --no-restore --configuration Release /sandbox/Solution.csproj
rm /sandbox/Solution.cs /sandbox/Harness.cs
EOF

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

- [ ] **Step 4: Build the image**

Run from repo root:

```bash
docker build -t sharp-arena/runner-csharp:dev runners/csharp
```

Expected: Image builds successfully. The build is slow first time (~3–5 min: SDK pull + restore + placeholder build), fast on rebuilds.

- [ ] **Step 5: Smoke test the image manually**

```bash
mkdir -p /tmp/runner-smoke
cat > /tmp/runner-smoke/Solution.cs <<'CS'
using System;
using System.Collections.Generic;
public static class Solution {
    public static List<string> FizzBuzz(int n) {
        var r = new List<string>();
        for (int i = 1; i <= n; i++) {
            if (i % 15 == 0) r.Add("FizzBuzz");
            else if (i % 3 == 0) r.Add("Fizz");
            else if (i % 5 == 0) r.Add("Buzz");
            else r.Add(i.ToString());
        }
        return r;
    }
}
CS
# Copy the FizzBuzz harness from ContentSeeder.cs FizzBuzzHarness const into:
#   /tmp/runner-smoke/Harness.cs

docker run --rm --cpus=1 --memory=128m --pids-limit=64 --network=none \
  -v /tmp/runner-smoke:/workspace:ro \
  sharp-arena/runner-csharp:dev
```

Expected: stdout shows `TEST 1 PASS`, `TEST 2 PASS`, `TEST 3 PASS`, `SUMMARY 3/3`. Exit code 0.

- [ ] **Step 6: Commit**

```bash
git add runners/csharp/Dockerfile runners/csharp/entrypoint.sh runners/csharp/Solution.csproj
git commit -m "feat(runners): real C# runner image (dotnet run, no-network sandbox)"
```

---

## Task 32: `scripts/dev.sh` — fix `migrate`, add `runner-build`

The existing `migrate` subcommand points to the deleted `ArenaApi.Infrastructure.Postgres` project. Fix it to use per-module contexts, and add a `runner-build` helper.

**Files:**
- Modify: `scripts/dev.sh`

- [ ] **Step 1: Replace the migrate case + add runner-build**

Find the existing `migrate)` case and replace it; add a new `runner-build)` case before the catch-all `*)`. Final file:

```bash
#!/usr/bin/env bash
# Sharp Arena — dev orchestration.
#
# Usage:
#   ./scripts/dev.sh up              Start postgres + rabbitmq + redis + backend + frontend
#   ./scripts/dev.sh up-infra        Start postgres + rabbitmq + redis only
#   ./scripts/dev.sh down            Stop and remove containers (keeps the volume)
#   ./scripts/dev.sh nuke            Stop, remove containers AND volumes
#   ./scripts/dev.sh logs [svc]      Tail logs for one or all services
#   ./scripts/dev.sh migrate         Apply EF Core migrations for all modules
#   ./scripts/dev.sh runner-build    Build the runners/csharp image (sharp-arena/runner-csharp:dev)
#   ./scripts/dev.sh psql            Open a psql shell in the postgres container

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .env ]; then
    # shellcheck disable=SC2046
    export $(grep -v '^[[:space:]]*#' .env | grep -v '^[[:space:]]*$' | xargs -0 echo | tr ' ' '\n' | xargs)
fi

CMD=${1:-up}
shift || true

case "$CMD" in
up)
    docker compose up -d --build
    ;;
up-infra)
    docker compose up -d postgres rabbitmq redis
    ;;
down)
    docker compose down
    ;;
nuke)
    docker compose down -v
    ;;
logs)
    docker compose logs -f "${1:-}"
    ;;
migrate)
    for ctx in ContentDbContext ExecutionDbContext; do
        echo ">>> dotnet ef database update --context $ctx"
        dotnet ef database update \
            --project backend/ArenaApi/src/ArenaApi.Core \
            --startup-project backend/ArenaApi/src/ArenaApi.Web \
            --context "$ctx"
    done
    ;;
runner-build)
    docker build -t sharp-arena/runner-csharp:dev runners/csharp
    ;;
psql)
    docker compose exec postgres \
        psql -U "${POSTGRES_USER:-arena}" -d "${POSTGRES_DB:-sharp_arena}"
    ;;
*)
    echo "Unknown command: $CMD" >&2
    echo "Usage: $0 {up|up-infra|down|nuke|logs [svc]|migrate|runner-build|psql}" >&2
    exit 2
    ;;
esac
```

- [ ] **Step 2: Verify the script parses**

Run: `bash -n scripts/dev.sh`
Expected: exit 0, no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/dev.sh
git commit -m "chore(scripts): fix dev.sh migrate; add runner-build subcommand"
```

---

## Task 33: Mount Docker socket into backend container in `docker-compose.yml`

So that the `backend` service can spawn sibling runner containers when the full stack runs via compose. Local dev where `dotnet run` is on the host doesn't need this.

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add the volume + the docker CLI to the backend service**

In the `backend:` block in `docker-compose.yml`, add a `volumes:` entry mounting the host socket, and an environment override pointing the runner staging root at a path both backend container and host can see. Replace the existing `backend:` service block with:

```yaml
  backend:
    image: sharp-arena/arena-api:dev
    build:
      context: ./backend
      dockerfile: ArenaApi/Dockerfile
    container_name: arena-api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      ASPNETCORE_ENVIRONMENT: ${ASPNETCORE_ENVIRONMENT:-Docker}
      ConnectionStrings__Database: "Host=postgres;Port=5432;Database=${POSTGRES_DB:-sharp_arena};Username=${POSTGRES_USER:-arena};Password=${POSTGRES_PASSWORD:-arena}"
      ConnectionStrings__RabbitMq: "amqp://${RABBITMQ_USER:-arena}:${RABBITMQ_PASSWORD:-arena}@rabbitmq:5672/"
      ConnectionStrings__Redis: "redis:6379"
      CSharpRunner__StagingRoot: "/tmp/sharp-arena-runs"
    volumes:
      # Mount host Docker socket — runner spawns sibling containers on the host.
      - /var/run/docker.sock:/var/run/docker.sock
      # Shared staging dir: both the backend container and the sibling runner
      # containers (which run on the host) need to read the same paths.
      - sharp_arena_runs:/tmp/sharp-arena-runs
    ports:
      - "${ARENA_API_PORT:-5000}:5000"
```

And add the volume to the bottom `volumes:` block:

```yaml
volumes:
  postgres_data:
    name: arena_postgres_data
  sharp_arena_runs:
    name: sharp_arena_runs
```

- [ ] **Step 2: Install Docker CLI into the backend image**

The backend image is `mcr.microsoft.com/dotnet/aspnet:10.0` which has no `docker` CLI. Either install it in `backend/ArenaApi/Dockerfile` (apt install docker-ce-cli) or skip this for now and verify the loop locally with `dotnet run` on the host instead. For Phase 1 base, **document this as a follow-up**: the loop works end-to-end with backend on host + infra in compose. Full-compose runner support lands in a follow-up bundle.

Add to the **plan execution notes**, not the Dockerfile itself for now. Action: Skip the Dockerfile change. The compose mount above is harmless on Linux; macOS users can ignore it (the docker socket binding still works but they'll likely run backend on host anyway).

- [ ] **Step 3: Validate compose file**

Run: `docker compose config -q`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(compose): mount docker.sock + staging volume for runner sibling-spawn"
```

---

## Task 34: Frontend — install Monaco + TanStack Query

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json` (regenerated)
- Create: `frontend/.env.local.example`

- [ ] **Step 1: Install the deps**

Run from `frontend/`:

```bash
npm install @monaco-editor/react@^4.7.0 @tanstack/react-query@^5.62.7
```

Expected: deps added to `package.json` `dependencies`, lockfile regenerated.

- [ ] **Step 2: Add the env var example**

`frontend/.env.local.example`:

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/.env.local.example
git commit -m "chore(frontend): add @monaco-editor/react + @tanstack/react-query"
```

---

## Task 35: `shared/api` — fetch client

**Files:**
- Create: `frontend/src/shared/api/client.ts`
- Create: `frontend/src/shared/api/index.ts`

- [ ] **Step 1: Write the client**

`client.ts`:

```ts
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export type ApiError = {
  status: number;
  code: string;
  message: string;
};

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(path.replace(/^\//, ""), BASE_URL + "/");
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let payload: { code?: string; message?: string } = {};
    try {
      payload = await res.json();
    } catch {
      /* ignore body parse failures */
    }
    const err: ApiError = {
      status: res.status,
      code: payload.code ?? "UnknownError",
      message: payload.message ?? res.statusText,
    };
    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: "GET" }),
  post: <TBody, TResponse>(path: string, body: TBody, init?: RequestInit) =>
    request<TResponse>(path, {
      ...init,
      method: "POST",
      body: JSON.stringify(body),
    }),
  baseUrl: BASE_URL,
};
```

- [ ] **Step 2: Write the barrel**

`index.ts`:

```ts
export { api, type ApiError } from "./client";
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/api/
git commit -m "feat(shared/api): typed fetch client"
```

---

## Task 36: `QueryProvider` wrapper + `app/layout` wiring

**Files:**
- Create: `frontend/src/shared/providers/query-provider.tsx`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Write the provider**

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Wrap `RootLayout` body**

Modify `frontend/src/app/layout.tsx`:

In the imports add:

```tsx
import { QueryProvider } from "@/shared/providers/query-provider";
```

Replace the `<body>` JSX with:

```tsx
<body className="min-h-screen overflow-x-hidden bg-bg-deep antialiased">
  <QueryProvider>
    <TopNav />
    <main className="mx-auto w-full max-w-[1440px] px-3 py-5 sm:px-6 sm:py-8">
      {children}
    </main>
  </QueryProvider>
</body>
```

- [ ] **Step 3: Lint**

Run from `frontend/`: `npm run lint`
Expected: no errors. (boundaries plugin: `shared/providers/...` imports `@tanstack/react-query` — that's a node-module import, not a layer import, so it's fine.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/providers/query-provider.tsx \
        frontend/src/app/layout.tsx
git commit -m "feat(frontend): wrap app in TanStack QueryClientProvider"
```

---

## Task 37: `entities/task` — API DTO + TanStack query options

The existing `types.ts` is mock-shaped (`TaskDetail` carries Leetcode-style `examples`, `constraints`, `topics`, `xpReward`, etc.). The API DTO is leaner. Rather than rip out the mock — needed by `arena/page.tsx` listing UI which we're NOT replacing in this slice — we add a parallel API shape `ApiTaskDetail`.

**Files:**
- Modify: `frontend/src/entities/task/types.ts`
- Create: `frontend/src/entities/task/api.ts`
- Modify: `frontend/src/entities/task/index.ts`

- [ ] **Step 1: Add `ApiTaskDetail` to `types.ts`**

Append at the bottom of `types.ts`:

```ts
/**
 * Server-shape task detail returned by `GET /api/tasks/{slug}/`.
 * Separate from the mock `TaskDetail` because the listing UI on `/arena` still
 * uses the mock data; the in-progress task page uses the API.
 */
export type ApiTaskDetail = {
  id: string;
  slug: string;
  title: string;
  language: string;
  problemMarkdown: string;
  starterCode: string;
  timeLimitSeconds: number;
  memoryLimitMb: number;
};
```

- [ ] **Step 2: Write `api.ts`**

```ts
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/shared/api";
import type { ApiTaskDetail } from "./types";

export const taskQueryKeys = {
  all: ["tasks"] as const,
  bySlug: (slug: string) => ["tasks", "by-slug", slug] as const,
};

export function getTaskQueryOptions(slug: string) {
  return queryOptions({
    queryKey: taskQueryKeys.bySlug(slug),
    queryFn: () => api.get<ApiTaskDetail>(`tasks/${slug}/`),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 3: Update the barrel**

Replace `frontend/src/entities/task/index.ts` with:

```ts
export type {
  TaskSummary,
  TaskDetail,
  TaskExample,
  TaskTopic,
  ApiTaskDetail,
} from "./types";
export { MOCK_TASKS, MOCK_TASK_DETAIL, getTaskBySlug } from "./mock-data";
export { TaskListRow } from "./ui/task-list-row";
export { taskQueryKeys, getTaskQueryOptions } from "./api";
```

- [ ] **Step 4: Lint**

Run from `frontend/`: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/entities/task/
git commit -m "feat(entities/task): API DTO + TanStack query options for getTask"
```

---

## Task 38: `entities/run` — types + submit/stream APIs

**Files:**
- Create: `frontend/src/entities/run/types.ts`
- Create: `frontend/src/entities/run/api.ts`
- Create: `frontend/src/entities/run/index.ts`

- [ ] **Step 1: Write the types**

`types.ts`:

```ts
export type RunStatus =
  | "Pending"
  | "Running"
  | "Passed"
  | "Failed"
  | "CompileError"
  | "RuntimeError"
  | "Timeout"
  | "OutOfMemory"
  | "RunnerError";

export const TERMINAL_RUN_STATUSES: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "Passed",
  "Failed",
  "CompileError",
  "RuntimeError",
  "Timeout",
  "OutOfMemory",
  "RunnerError",
]);

export type RunSnapshot = {
  runId: string;
  status: RunStatus;
  testsPassed?: number;
  testsTotal?: number;
  durationMs?: number;
  stdout?: string;
  stderr?: string;
};

export type SubmitRunInput = {
  taskSlug: string;
  userCode: string;
};

export type SubmitRunResult = {
  runId: string;
};
```

- [ ] **Step 2: Write `api.ts`**

```ts
import { api } from "@/shared/api";
import type { RunSnapshot, RunStatus, SubmitRunInput, SubmitRunResult } from "./types";

type ServerSubmitResponse = { runId: string };

type ServerRunEvent = {
  runId: string;
  status: RunStatus;
  testsPassed: number | null;
  testsTotal: number | null;
  durationMs: number | null;
  stdout: string | null;
  stderr: string | null;
};

export async function submitRun(input: SubmitRunInput): Promise<SubmitRunResult> {
  const body = await api.post<
    { taskSlug: string; userCode: string },
    ServerSubmitResponse
  >("runs/", { taskSlug: input.taskSlug, userCode: input.userCode });
  return { runId: body.runId };
}

/**
 * Subscribe to SSE events for one run. The returned function unsubscribes.
 * `onEvent` is called for every update; once the status is terminal, the
 * source closes itself.
 */
export function subscribeRunEvents(
  runId: string,
  onEvent: (snap: RunSnapshot) => void,
  onError?: (err: Event) => void,
): () => void {
  const url = `${api.baseUrl}/runs/${runId}/events/`;
  const source = new EventSource(url);

  source.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as ServerRunEvent;
      onEvent({
        runId: data.runId,
        status: data.status,
        testsPassed: data.testsPassed ?? undefined,
        testsTotal: data.testsTotal ?? undefined,
        durationMs: data.durationMs ?? undefined,
        stdout: data.stdout ?? undefined,
        stderr: data.stderr ?? undefined,
      });
    } catch (_err) {
      // Drop malformed envelopes — server only sends well-formed payloads,
      // a parse failure here means the stream is corrupt and the EventSource
      // will retry on its own.
    }
  };

  source.onerror = (ev) => {
    onError?.(ev);
  };

  return () => source.close();
}
```

- [ ] **Step 3: Write the barrel**

`index.ts`:

```ts
export type {
  RunStatus,
  RunSnapshot,
  SubmitRunInput,
  SubmitRunResult,
} from "./types";
export { TERMINAL_RUN_STATUSES } from "./types";
export { submitRun, subscribeRunEvents } from "./api";
```

- [ ] **Step 4: Lint**

Run from `frontend/`: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/entities/run/
git commit -m "feat(entities/run): submit + SSE subscribe"
```

---

## Task 39: `features/run-code` — `useRunCode` hook

Combines `submitRun` (mutation) and `subscribeRunEvents` (effect) into one stateful primitive consumed by the workspace.

**Files:**
- Create: `frontend/src/features/run-code/use-run-code.ts`
- Create: `frontend/src/features/run-code/index.ts`

- [ ] **Step 1: Write the hook**

`use-run-code.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import {
  TERMINAL_RUN_STATUSES,
  submitRun,
  subscribeRunEvents,
  type RunSnapshot,
} from "@/entities/run";

export type UseRunCodeState = {
  status: "idle" | "submitting" | "running" | "terminal" | "error";
  snapshot?: RunSnapshot;
  error?: string;
};

export type UseRunCodeApi = UseRunCodeState & {
  run: (taskSlug: string, userCode: string) => Promise<void>;
  reset: () => void;
};

export function useRunCode(): UseRunCodeApi {
  const [state, setState] = useState<UseRunCodeState>({ status: "idle" });
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  const reset = () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setState({ status: "idle" });
  };

  const run = async (taskSlug: string, userCode: string) => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setState({ status: "submitting" });

    let runId: string;
    try {
      const r = await submitRun({ taskSlug, userCode });
      runId = r.runId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: "error", error: message });
      return;
    }

    setState({
      status: "running",
      snapshot: { runId, status: "Pending" },
    });

    unsubscribeRef.current = subscribeRunEvents(
      runId,
      (snap) => {
        setState({
          status: TERMINAL_RUN_STATUSES.has(snap.status) ? "terminal" : "running",
          snapshot: snap,
        });
      },
      () => {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Lost connection to run event stream.",
        }));
      },
    );
  };

  return { ...state, run, reset };
}
```

- [ ] **Step 2: Write the barrel**

`index.ts`:

```ts
export { useRunCode, type UseRunCodeApi, type UseRunCodeState } from "./use-run-code";
```

- [ ] **Step 3: Lint**

Run from `frontend/`: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/run-code/
git commit -m "feat(features/run-code): useRunCode hook (submit + SSE)"
```

---

## Task 40: `task-workspace` wrapper + Monaco-backed editor + real verdict panel

Introduces a small `TaskWorkspace` wrapper widget that owns the `useRunCode` state and the editor buffer, then passes both into the existing editor + tests panels. The page becomes a thin shell that fetches the task.

**Files:**
- Modify: `frontend/src/widgets/task-workspace/task-editor-panel.tsx` (Monaco-backed)
- Modify: `frontend/src/widgets/task-workspace/task-tests-panel.tsx` (real verdict)
- Create: `frontend/src/widgets/task-workspace/task-workspace.tsx` (state owner)
- Modify: `frontend/src/widgets/task-workspace/index.ts` (export wrapper)

- [ ] **Step 1: Write `TaskWorkspace` wrapper**

`task-workspace.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRunCode } from "@/features/run-code";
import type { ApiTaskDetail } from "@/entities/task";
import { TaskEditorPanel } from "./task-editor-panel";
import { TaskTestsPanel } from "./task-tests-panel";

export function TaskWorkspace({ task }: { task: ApiTaskDetail }) {
  const [code, setCode] = useState(task.starterCode);
  const runner = useRunCode();

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="grid min-h-0 grid-rows-[auto_auto] gap-4 lg:grid-rows-[minmax(0,1fr)]">
        <TaskEditorPanel
          code={code}
          onCodeChange={setCode}
          onRun={() => runner.run(task.slug, code)}
          onReset={() => {
            setCode(task.starterCode);
            runner.reset();
          }}
          isRunning={runner.status === "submitting" || runner.status === "running"}
          language={task.language}
        />
      </div>
      <TaskTestsPanel runner={runner} />
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `TaskEditorPanel` to use Monaco**

`task-editor-panel.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { Play, RotateCcw } from "lucide-react";
import { Button, Panel } from "@/shared/ui";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  { ssr: false },
);

type TaskEditorPanelProps = {
  code: string;
  onCodeChange: (code: string) => void;
  onRun: () => void;
  onReset: () => void;
  isRunning: boolean;
  language: string;
};

export function TaskEditorPanel({
  code,
  onCodeChange,
  onRun,
  onReset,
  isRunning,
  language,
}: TaskEditorPanelProps) {
  return (
    <Panel className="relative flex min-h-[420px] flex-col overflow-hidden lg:h-full lg:min-h-0">
      <div className="min-h-0 flex-1">
        <MonacoEditor
          height="100%"
          defaultLanguage={language === "csharp" ? "csharp" : "plaintext"}
          language={language === "csharp" ? "csharp" : "plaintext"}
          value={code}
          onChange={(value) => onCodeChange(value ?? "")}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            tabSize: 4,
            insertSpaces: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border-subtle bg-bg-elevated/40 p-3">
        <Button
          variant="secondary"
          size="sm"
          leading={<RotateCcw className="size-3.5" aria-hidden />}
          onClick={onReset}
          disabled={isRunning}
        >
          Сброс
        </Button>
        <Button
          variant="primary"
          size="md"
          leading={<Play className="size-4" aria-hidden />}
          onClick={onRun}
          disabled={isRunning}
        >
          {isRunning ? "Запуск..." : "Запуск"}
        </Button>
      </div>
    </Panel>
  );
}
```

- [ ] **Step 3: Rewrite `TaskTestsPanel` to show real verdict**

`task-tests-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Panel, SegmentedTabs } from "@/shared/ui";
import type { UseRunCodeApi } from "@/features/run-code";

type Tab = "tests" | "console";

export function TaskTestsPanel({ runner }: { runner: UseRunCodeApi }) {
  const [tab, setTab] = useState<Tab>("tests");

  return (
    <Panel className="flex min-h-[260px] flex-col overflow-hidden lg:h-full lg:min-h-0">
      <div className="border-b border-border-subtle px-5 pt-3">
        <SegmentedTabs
          items={[
            { id: "tests", label: "Тесты" },
            { id: "console", label: "Консоль" },
          ]}
          defaultActiveId="tests"
          onChange={(id) => setTab(id as Tab)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-5 font-mono text-xs leading-relaxed text-text">
        {tab === "tests" ? <TestsBody runner={runner} /> : <ConsoleBody runner={runner} />}
      </div>
    </Panel>
  );
}

function TestsBody({ runner }: { runner: UseRunCodeApi }) {
  if (runner.status === "idle") {
    return <p className="text-text-dim">Нажми «Запуск», чтобы прогнать тесты.</p>;
  }

  if (runner.status === "submitting" || runner.status === "running") {
    return <p className="text-text-dim">Отправляем код в песочницу...</p>;
  }

  if (runner.status === "error") {
    return <p className="text-accent-red">Ошибка: {runner.error ?? "неизвестно"}</p>;
  }

  const snap = runner.snapshot;
  if (!snap) return null;

  const passedAll =
    snap.status === "Passed" &&
    snap.testsPassed != null &&
    snap.testsTotal != null &&
    snap.testsPassed === snap.testsTotal;

  return (
    <div className="space-y-2">
      <p className={passedAll ? "text-accent-green" : "text-accent-red"}>
        {snap.status} — {snap.testsPassed ?? 0}/{snap.testsTotal ?? 0} тестов пройдено
      </p>
      {snap.durationMs != null ? (
        <p className="text-text-dim">
          <span className="text-text-muted">Время:</span> {snap.durationMs} мс
        </p>
      ) : null}
    </div>
  );
}

function ConsoleBody({ runner }: { runner: UseRunCodeApi }) {
  const snap = runner.snapshot;
  if (!snap || (!snap.stdout && !snap.stderr)) {
    return <p className="text-text-dim">Консольный вывод появится после запуска.</p>;
  }

  return (
    <pre className="whitespace-pre-wrap break-words">
      {snap.stdout ? (
        <span className="text-text">{snap.stdout}</span>
      ) : null}
      {snap.stderr ? (
        <span className="text-accent-red">{"\n"}{snap.stderr}</span>
      ) : null}
    </pre>
  );
}
```

- [ ] **Step 4: Update the barrel**

`index.ts`:

```ts
export { TaskWorkspace } from "./task-workspace";
export { TaskEditorPanel } from "./task-editor-panel";
export { TaskTestsPanel } from "./task-tests-panel";
export { TaskStatementPanel } from "./task-statement-panel";
```

- [ ] **Step 5: Lint**

Run from `frontend/`: `npm run lint`
Expected: no errors. (Existing `TaskStatementPanel` consumes the mock `TaskDetail` — we're not touching it here. The page will pass mock-shaped data into it OR we adjust it in the next task.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/widgets/task-workspace/
git commit -m "feat(task-workspace): Monaco editor + real verdict panel + workspace wrapper"
```

---

## Task 41: Swap `/arena/tasks/[id]` page to fetch from API

The page currently calls `getTaskBySlug(id)` (mock). Swap to a TanStack Query that fetches `ApiTaskDetail`, render `TaskStatementPanel` with the markdown, and use the new `TaskWorkspace`.

`TaskStatementPanel` was built for the mock shape (`examples`, `constraints`, `hints`). Rewrite it minimally to just render `problemMarkdown` as a `<pre>` block — markdown rendering library is out of scope for the base; we'll add `react-markdown` later. Title + problem text is enough to validate the loop.

**Files:**
- Modify: `frontend/src/widgets/task-workspace/task-statement-panel.tsx`
- Modify: `frontend/src/app/arena/tasks/[id]/page.tsx`

- [ ] **Step 1: Replace `TaskStatementPanel` with the API-shape version**

```tsx
import { Panel } from "@/shared/ui";
import type { ApiTaskDetail } from "@/entities/task";

export function TaskStatementPanel({ task }: { task: ApiTaskDetail }) {
  return (
    <Panel className="flex min-h-[420px] flex-col overflow-hidden lg:h-full lg:min-h-0">
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
        <header>
          <h2 className="text-2xl font-semibold text-text">{task.title}</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
            {task.language} · ⏱ {task.timeLimitSeconds}s · 🧠 {task.memoryLimitMb}MB
          </p>
        </header>
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-text-dim">
          {task.problemMarkdown}
        </pre>
      </div>
    </Panel>
  );
}
```

- [ ] **Step 2: Rewrite the page**

`frontend/src/app/arena/tasks/[id]/page.tsx`:

```tsx
"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/shared/ui";
import { getTaskQueryOptions } from "@/entities/task";
import { TaskStatementPanel, TaskWorkspace } from "@/widgets/task-workspace";

export default function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, isError, error } = useQuery(getTaskQueryOptions(id));

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-text-dim">
        Загрузка задачи...
      </div>
    );
  }

  if (isError) {
    const err = error as { status?: number } | null;
    if (err?.status === 404) {
      notFound();
    }
    return (
      <div className="flex h-[60vh] items-center justify-center text-accent-red">
        Не удалось загрузить задачу.
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-7.5rem)] lg:min-h-[640px]">
      <PageHeader
        backHref="/arena"
        backLabel="Арена"
        title={data.title}
        className="rounded-xl border border-border-subtle bg-bg-panel"
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <TaskStatementPanel task={data} />
        <TaskWorkspace task={data} />
      </div>
    </div>
  );
}
```

Note: This drops `generateMetadata` (which needed sync access to the mock data). Add it back later by switching to a server component shell that hands off to a client child for the workspace — out of scope for the base.

- [ ] **Step 3: Lint + build**

Run from `frontend/`:

```bash
npm run lint
npm run build
```

Expected: lint passes, `npm run build` succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/widgets/task-workspace/task-statement-panel.tsx \
        frontend/src/app/arena/tasks/[id]/page.tsx
git commit -m "feat(arena): task page fetches /api/tasks/{slug}/ + uses TaskWorkspace"
```

---

## Task 42: Backend CORS for the frontend origin

`fetch()` from `localhost:3000` against `localhost:5000` is cross-origin. Without CORS, both the JSON requests and the SSE stream fail with a browser-side block.

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Web/Program.cs`
- Modify: `backend/ArenaApi/src/ArenaApi.Web/appsettings.Development.json`

- [ ] **Step 1: Add CORS config + middleware**

Replace `Program.cs` with:

```csharp
using ArenaApi.Core;
using ArenaApi.Core.Features.Health;
using ArenaApi.Core.Modules.Content;
using ArenaApi.Core.Modules.Execution;
using ArenaApi.Core.Modules.IdentityStub;
using ArenaApi.Core.Modules.Progress;
using ArenaApi.Web.Configuration;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

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

string[] corsOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? ["http://localhost:3000"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.UseArenaWolverine();

builder.Services.AddOpenApi();

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

app.MapHealthEndpoints();
app.MapContentEndpoints();
app.MapExecutionEndpoints();

await app.RunAsync();

namespace ArenaApi.Web
{
    public sealed class Program;
}
```

- [ ] **Step 2: Add allowed origins to `appsettings.Development.json`**

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft.AspNetCore": "Information"
    }
  },
  "IdentityStub": {
    "HardcodedUserId": "01970000-0000-7000-8000-000000000001"
  },
  "Cors": {
    "AllowedOrigins": ["http://localhost:3000"]
  }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build backend/ArenaApi/src/ArenaApi.Web -nologo`
Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Web/Program.cs \
        backend/ArenaApi/src/ArenaApi.Web/appsettings.Development.json
git commit -m "feat(web): CORS allow http://localhost:3000 for frontend dev"
```

---

## Task 43: End-to-end manual smoke

Validates the whole loop runs against real Docker.

- [ ] **Step 1: Start infra**

Run: `./scripts/dev.sh up-infra`
Expected: postgres, rabbitmq, redis healthy.

- [ ] **Step 2: Apply migrations**

Run: `./scripts/dev.sh migrate`
Expected: both `ContentDbContext` and `ExecutionDbContext` migrations apply cleanly.

- [ ] **Step 3: Build the runner image**

Run: `./scripts/dev.sh runner-build`
Expected: `sharp-arena/runner-csharp:dev` built, ~1.5 GB.

- [ ] **Step 4: Start the backend on host**

Run (in a separate terminal):

```bash
dotnet run --project backend/ArenaApi/src/ArenaApi.Web
```

Expected logs:
- `ContentSeeder: inserted 'fizzbuzz' as <guid>.`
- Wolverine starts, RabbitMQ queues provisioned.
- Listening on `http://localhost:5000`.

- [ ] **Step 5: Smoke test the API with curl**

```bash
curl -s http://localhost:5000/api/tasks/fizzbuzz/ | jq
```

Expected: 200 OK, JSON with `id`, `slug=fizzbuzz`, `title=FizzBuzz`, full `problemMarkdown`, `starterCode`.

```bash
RUN_ID=$(curl -s -X POST http://localhost:5000/api/runs/ \
  -H 'Content-Type: application/json' \
  -d '{"taskSlug":"fizzbuzz","userCode":"using System;using System.Collections.Generic;public static class Solution{public static List<string> FizzBuzz(int n){var r=new List<string>();for(int i=1;i<=n;i++){if(i%15==0)r.Add(\"FizzBuzz\");else if(i%3==0)r.Add(\"Fizz\");else if(i%5==0)r.Add(\"Buzz\");else r.Add(i.ToString());}return r;}}"}' \
  | jq -r .runId)
echo "runId=$RUN_ID"
sleep 8
curl -s http://localhost:5000/api/runs/$RUN_ID/ | jq
```

Expected: status `"Passed"`, `testsPassed=3`, `testsTotal=3`.

- [ ] **Step 6: Smoke test SSE**

```bash
curl -N http://localhost:5000/api/runs/$RUN_ID/events/
```

Expected: at least one `data: {...}` line with the final verdict (the line ending `"status":"Passed"`).

- [ ] **Step 7: Start the frontend**

Run (separate terminal):

```bash
cd frontend && cp .env.local.example .env.local && npm run dev
```

Expected: Next.js dev server on `http://localhost:3000`.

- [ ] **Step 8: Open the task page in a browser**

Navigate to `http://localhost:3000/arena/tasks/fizzbuzz`.
Expected:
- Title "FizzBuzz", problem text on the left.
- Monaco editor on the right pre-filled with the starter code.
- Click "Запуск". The editor disables, "Запуск..." appears.
- Within a few seconds the Tests panel shows `Passed — 3/3 тестов пройдено`.

- [ ] **Step 9: Failure path**

Edit the editor — break the implementation (e.g. always return empty list). Click "Запуск". Expected: status `Failed`, `0/3`. The Console tab shows `TEST 1 FAIL: ...` lines.

- [ ] **Step 10: Commit nothing**

This task is verification only. Move on if all steps pass; if any step fails, debug *before* declaring Phase 1 base done.

---

## Task 44: Update `docs/ROADMAP.md` and `docs/ARCHITECTURE.md`

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Flip Phase 1 checkboxes that this plan completes**

In `docs/ROADMAP.md`, mark these items `[x]`:
- `- [x] EF migrations for arena.packages, arena.tasks, ...` (partial — only `arena_content.tasks` and `arena_execution.runs` for the base)
- `- [x] Vertical slices: Tasks/GetTask, Runs/SubmitRun, Runs/GetRunStatus`
- `- [x] IRunner + CSharpRunner (Docker spawn, output parsing).`
- `- [x] runners/csharp/ — real Dockerfile + entrypoint that compiles & runs.`
- `- [x] Frontend: /arena/tasks/[id] Monaco editor, use-run-code hook with polling.` (Replace "with polling" with "via SSE" in-place.)
- `- [x] Seed 1 package × 5 tasks to demo the loop.` → REPLACE with `- [x] Seed 1 FizzBuzz task (base MVP); full package×5 deferred.`

Leave un-flipped (out of scope for the base): `Package`/`Chapter` aggregates, package catalog UI, anonymous-cookie auth, `VictoryOverlay` wiring.

- [ ] **Step 2: Add the new endpoints to `docs/ARCHITECTURE.md`**

In the "Planned (Phase 1+)" API table, move these rows above the table and mark them as live, or simply add a new "Shipped in Phase 1 base" table just after the Phase 0 table:

```markdown
**Shipped in Phase 1 base:**

| Method | Path                                     | Purpose                                |
| ------ | ---------------------------------------- | -------------------------------------- |
| GET    | `/api/tasks/{slug}/`                     | Task detail for the editor             |
| POST   | `/api/runs/`                             | Submit a run → `{ runId }`             |
| GET    | `/api/runs/{runId}/`                     | Snapshot of a run's verdict            |
| GET    | `/api/runs/{runId}/events/`              | SSE stream of run state transitions    |
```

- [ ] **Step 3: Commit**

```bash
git add docs/ROADMAP.md docs/ARCHITECTURE.md
git commit -m "docs: mark Phase 1 base items as shipped; record run/sse endpoints"
```

---

## Task 45: Record SSE exception in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Edit the "What NOT to add" section**

Find the line `- WebSockets, SSE` under `## What NOT to add without explicit ask` and replace with:

```markdown
- WebSockets (still off). SSE is allowed for the run-verdict stream
  (`GET /api/runs/{id}/events/`); broader SSE usage still needs an explicit ask.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): record SSE exception for run verdict stream"
```

---

## Self-Review Summary

### Spec coverage check (against the user's request)

| User requirement                                                                    | Covered by                                                  |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| One C# task lives in backend                                                        | Tasks 1–9 (entity, migration, seeder, GetTask)              |
| Open task on frontend in arena mode                                                 | Tasks 37, 41 (`getTaskQueryOptions`, page swap)             |
| Run code, code executes in Docker                                                   | Tasks 18–19, 31 (runner, Docker spawn, real image)          |
| Architecture with abstractions for future languages                                 | Tasks 10–12 (`IRunner`, `ITestFormat`, `RunVerdict`, etc.)  |
| SSE for verdict push (user-requested explicit deviation)                            | Tasks 12, 16, 25, 38–40, 45                                 |
| Hardcoded startup seeder (user-chosen)                                              | Task 8                                                      |
| Frontend scope = task page only (user-chosen)                                       | Tasks 37, 40, 41 only — no catalog rewire, no Package work  |

### Out-of-scope (deliberately deferred — not in this plan)

- Real `Package` aggregate, package listing API, package detail page.
- `Chapter` / Story mode.
- Anonymous-cookie auth — `IdentityStub` is still hardcoded.
- xUnit/TRX `ITestFormat` — `TextTestFormat` only.
- Markdown rendering of `problemMarkdown` — rendered as `<pre>` for now.
- Backend CSharpRunner inside its own container (Docker-in-Docker via socket mount is wired in compose, but the backend `Dockerfile` needs the docker CLI installed to actually exercise it — flagged in Task 33 step 2).
- `VictoryOverlay` re-wire on success.
- Architecture tests for new modules — existing `NetArchTest` rules continue to enforce module boundaries; no new rules added because no new modules were introduced.

### Placeholder scan

Scanned for: TBD, TODO, "implement later", "fill in details", "add appropriate error handling", references to undefined types. None found in the plan. All code blocks are complete.

### Type-consistency check

- `RunStatus` is used identically across backend (`RunStatus` enum) and frontend (`RunStatus` string union) — server emits via `.ToString()` (Tasks 24, 25) and client matches by name (Task 38).
- `TaskView` (server projection) is consumed by `IContentReader.GetTask*` (Task 5) and by `ExecuteRunHandler` (Task 23) and by `GetTaskHandler` (Task 7) — fields match `ContentTask`.
- `ApiTaskDetail` (client) matches `TaskResponse` (server, Task 7) field-for-field after camelCase serialization.
- `RunEventPayload` ↔ `ServerRunEvent` in `entities/run/api.ts` (Task 38) match exactly.
- `UseRunCodeApi` (Task 39) is consumed unchanged by `TaskWorkspace` (Task 40) and `TaskTestsPanel` (Task 40).

### Migration sanity

- Content migration: `ContentAddTasks` extends existing schema (Task 6). Snapshot updates pick up `Packages` (existing) + `Tasks` (new).
- Execution migration: `ExecutionInitial` is the first migration in this module (Task 15). No prior snapshot to merge with.

### Commit count

This plan generates ~30 commits. None are amends; each is forward-only.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-24-phase-1-mvp-loop.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Pick one. If subagent-driven, suggest also starting via `superpowers:using-git-worktrees` with the worktree name `phase-1-mvp-loop` first.
