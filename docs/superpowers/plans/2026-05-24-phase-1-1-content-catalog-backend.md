# Phase 1.1 Content Catalog Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the `Content` module to back the full Arena catalog out of Postgres. After this plan, an admin can curl `/api/admin/topics/`, `/api/admin/tasks/`, `/api/admin/collections/` to author content end-to-end, anonymous users can browse `/api/v1/tasks/`, `/api/v1/topics/`, `/api/v1/collections/`, and a startup seeder inserts the same 12 tasks + 5 topics + 4 collections that the frontend currently mocks. Frontend is **not touched** here — that is Phase 1.2. Run / execution is **not touched** here — that is the existing `2026-05-24-phase-1-mvp-loop.md`.

**Architecture:**
- **Single Content module, two route groups.** `/api/v1/*` (anonymous, only `Published`) and `/api/admin/*` (admin-only, all statuses). Both live under `ArenaApi.Core.Modules.Content.Features.*` — admin features sit in `Features/Admin/<Action><Name>/`, public ones stay flat in `Features/<Action><Name>/`.
- **Aggregates.** `Topic`, `ContentTask` (aggregate root with owned `TaskAsset` / `TaskUnitTest` collections), `Collection` (with owned `CollectionTask` ordered list). `TaskTopic` is a separate M:N join entity. `Status` lifecycles: `Draft → Published → Archived → Published` for tasks and collections.
- **Visibility rules.** Public API never returns `Status != Published`, never returns `task_unit_tests`, and never returns `kind = Constraint|Hint|Starter` raw content where it would expose authoring metadata other than its `content` field. (`TaskAsset.Kind = Example` is the user-facing "input/output/explanation" block; `Kind = Constraint` is the markdown list of constraints; `Kind = Hint` is one revealable hint per row; `Kind = Starter` is the starter source for the editor — all returned in `/api/v1/tasks/{slug}/`.) Only `task_unit_tests` are admin-only.
- **Admin authorization.** `ICurrentUser` grows `IsAdmin`. `IdentityStub` binds it from `appsettings:IdentityStub:IsAdmin` (boolean; local dev = `true`). A new `RequireAdminFilter` endpoint filter in `Web/Authorization/` short-circuits to 403 when `!currentUser.IsAdmin`. The `/api/admin` route group adds the filter once.
- **Persistence.** Single `ContentDbContext`, schema `arena_content`. All new tables join the existing `packages` table. Enums stored as `smallint` (not native pg enum, to keep migrations safe). Owned collections use `OwnsMany`. Join tables (`task_topics`, `collection_tasks`) are explicit entities.
- **Seed.** `CatalogSeeder` is an `IHostedService` that runs once at startup. Idempotent — if `arena_content.topics` has any row, it does nothing. Otherwise it inserts the canonical Phase 0 dataset (5 topics, 12 tasks, 4 collections), all in `Published` status. The exact values mirror the frontend mocks under `frontend/src/entities/{task,collection}/mock-data.ts`.

**Tech Stack:** .NET 10 (existing), Wolverine 5.x + RabbitMQ + Postgres outbox (existing), EF Core 10 + Npgsql 10 (existing), xUnit + Testcontainers (existing). No new package references.

**Conventions used throughout:**
- All entity primary keys: `Guid.CreateVersion7()`. `Guid.NewGuid()` is banned.
- All HTTP API URLs end with `/` (nginx 301-redirects otherwise).
- Handlers return `Result<T, Error>`. No throwing for business outcomes.
- Cross-module reads via `IContentReader` from `Public/`. No direct DbContext leakage.
- Domain entities aren't qualified with `System.Threading.Tasks.Task` — the aggregate root is named `ContentTask`. Collection is `Collection` (no clash). Topic is `Topic`. Asset row is `TaskAsset`. Unit-test row is `TaskUnitTest`.
- Enums in domain are full C# enums backed by `short` (`smallint`). EF maps with `.HasConversion<short>()`.
- Status filtering: every public read query has `.Where(x => x.Status == Status.Published)`. Admin queries omit the filter.
- Each commit is small and self-contained. Build + tests at marked checkpoints.

**Worktree recommendation:** This plan touches one project (`ArenaApi.Core`) across a single module and produces one EF migration. Worktree is optional; if you're in parallel with another backend stream, isolate via `superpowers:using-git-worktrees` in a `phase-1-1-content-catalog` worktree.

**Out-of-scope (explicit):**
- Frontend. The `/arena` mocked page keeps reading from `frontend/src/entities/task/mock-data.ts` until Phase 1.2 swaps it for the real API.
- Run execution / `Run` aggregate / `IRunner`. Stays in the separate `2026-05-24-phase-1-mvp-loop.md`.
- Auth beyond a single hardcoded admin flag. No JWT, no cookies, no real authorization service.
- Multi-language. `language` column accepts only `"csharp"` in this phase (validated in the aggregate factory).
- Removing the `packages` table or its `POST /api/packages/` endpoint — `Package` aggregate is marked `[Obsolete]` but lives on until a future cleanup migration.

---

## File Structure

### Backend — Content module (new files)

- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Enums.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Topic.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/ContentTask.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/TaskAsset.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/TaskUnitTest.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/TaskTopic.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Collection.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/CollectionTask.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/DomainEvents/ContentTaskCreatedDomainEvent.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/DomainEvents/ContentTaskPublishedDomainEvent.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TopicConfiguration.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/ContentTaskConfiguration.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TaskAssetConfiguration.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TaskUnitTestConfiguration.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TaskTopicConfiguration.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/CollectionConfiguration.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/CollectionTaskConfiguration.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/<ts>_ContentCatalogInitial.cs` (generated)
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TaskSummaryView.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TaskDetailView.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TaskAssetView.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TopicView.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/CollectionSummaryView.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/CollectionDetailView.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TaskFilter.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/PagedResult.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IntegrationEvents/ContentTaskPublished.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListTasks/ListTasksHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListTasks/ListTasksEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/GetTaskHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/GetTaskEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListTopics/ListTopicsHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListTopics/ListTopicsEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListCollections/ListCollectionsHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListCollections/ListCollectionsEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetCollection/GetCollectionHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetCollection/GetCollectionEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateTopic/CreateTopicHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateTopic/CreateTopicEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTopic/UpdateTopicHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTopic/UpdateTopicEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteTopic/DeleteTopicHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteTopic/DeleteTopicEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListTopicsAdmin/ListTopicsAdminHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListTopicsAdmin/ListTopicsAdminEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateContentTask/CreateContentTaskHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateContentTask/CreateContentTaskEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskMetadata/UpdateTaskMetadataHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskMetadata/UpdateTaskMetadataEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskAssets/UpdateTaskAssetsHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskAssets/UpdateTaskAssetsEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskUnitTests/UpdateTaskUnitTestsHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskUnitTests/UpdateTaskUnitTestsEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/PublishTask/PublishTaskHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/PublishTask/PublishTaskEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ArchiveTask/ArchiveTaskHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ArchiveTask/ArchiveTaskEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteTask/DeleteTaskHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteTask/DeleteTaskEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListTasksAdmin/ListTasksAdminHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListTasksAdmin/ListTasksAdminEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/GetTaskAdmin/GetTaskAdminHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/GetTaskAdmin/GetTaskAdminEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateCollection/CreateCollectionHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateCollection/CreateCollectionEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateCollection/UpdateCollectionHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateCollection/UpdateCollectionEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteCollection/DeleteCollectionHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteCollection/DeleteCollectionEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListCollectionsAdmin/ListCollectionsAdminHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListCollectionsAdmin/ListCollectionsAdminEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/SetCollectionTasks/SetCollectionTasksHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/SetCollectionTasks/SetCollectionTasksEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/PublishCollection/PublishCollectionHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/PublishCollection/PublishCollectionEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ArchiveCollection/ArchiveCollectionHandler.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ArchiveCollection/ArchiveCollectionEndpoint.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Seed/CatalogSeeder.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Seed/CatalogSeederHostedService.cs`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Seed/SeedData.cs`

### Backend — Content module (modified files)

- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContext.cs` — add DbSets
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentReader.cs` — replace body
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IContentReader.cs` — extend
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/ContentModule.cs` — register everything
- `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Package.cs` — `[Obsolete]` marker

### Backend — IdentityStub module (modified files)

- `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/IdentityStubOptions.cs` — add `IsAdmin`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Public/ICurrentUser.cs` — add `IsAdmin`
- `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Infrastructure/StubCurrentUser.cs` — surface it

### Backend — Web project (new + modified)

- `backend/ArenaApi/src/ArenaApi.Web/Authorization/RequireAdminFilter.cs` (new)
- `backend/ArenaApi/src/ArenaApi.Web/appsettings.json` — add `IdentityStub:IsAdmin: false`
- `backend/ArenaApi/src/ArenaApi.Web/appsettings.Development.json` — `IsAdmin: true`
- `backend/ArenaApi/src/ArenaApi.Web/appsettings.Docker.json` — `IsAdmin: true`
- `backend/ArenaApi/src/ArenaApi.Web/Program.cs` — no behavioral change (endpoints still wire through `MapContentEndpoints`)

### Backend — Progress module (modified files)

- `backend/ArenaApi/src/ArenaApi.Core/Modules/Progress/EventHandlers/PackageCreatedHandler.cs` — keep, only message wording untouched. (No code change required; listed for awareness.)

### Backend — Contracts (new files)

- `backend/ArenaApi/src/ArenaApi.Contracts/Content/TaskCardResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/TaskDetailResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/TaskExampleResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/TopicResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/CollectionCardResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/CollectionDetailResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/PagedResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/ErrorPayload.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/CreateTopicRequest.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTopicRequest.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/TopicAdminResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/CreateContentTaskRequest.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTaskMetadataRequest.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTaskAssetsRequest.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTaskUnitTestsRequest.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/TaskAdminResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/TaskAssetAdminResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/TaskUnitTestAdminResponse.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/CreateCollectionRequest.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateCollectionRequest.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/SetCollectionTasksRequest.cs`
- `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/CollectionAdminResponse.cs`

### Backend — Tests (new files)

- `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/EnumsTests.cs`
- `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/TopicTests.cs`
- `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/ContentTaskTests.cs`
- `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/CollectionTests.cs`
- `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/IdentityStub/StubCurrentUserTests.cs`
- `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/AdminAuthorizationTests.cs`
- `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/TopicsAdminEndpointsTests.cs`
- `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/TaskAdminEndpointsTests.cs`
- `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/CollectionAdminEndpointsTests.cs`
- `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/PublicCatalogEndpointsTests.cs`
- `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/CatalogSeederTests.cs`

### Backend — Tests (modified files)

- `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs` — toggle `IsAdmin`, disable seeder by default, helper to reset DB.
- `backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs` — add a test that no module depends on `ArenaApi.Web.Authorization`.

### Scripts (new)

- `scripts/verify-content-catalog.sh` — end-to-end curl smoke.

### Docs (modified)

- `backend/ArenaApi/CLAUDE.md` — update "Phase 0 status" section to reflect new Content state.

---

## Conventions used in tasks below

- Each task lists **Files** then a list of checkboxed **Step**s.
- Every code step includes the **full content** of the change, not just a diff hint.
- `<ts>` in migration filenames is the EF-generated timestamp; don't pick one yourself.
- Build/run commands assume PWD = repo root unless stated.
- After each task with new code, **commit** with a Conventional Commits message scoped to `content`.
- Unit-test method names follow `Method_state_expected` (e.g. `Publish_with_no_assets_returns_validation_error`).
- Integration tests use the existing `IntegrationTestsCollection` xUnit collection so the Testcontainer fixture is shared.
- Admin endpoints all return `403 Forbidden` (body: `{ "code":"Forbidden.Admin", "message":"Admin privileges required." }`) when `ICurrentUser.IsAdmin == false`. Test asserts on `StatusCode == Forbidden` plus the code string.

---

## Task 1: Add `IsAdmin` to `ICurrentUser` and `IdentityStubOptions`

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Public/ICurrentUser.cs`
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/IdentityStubOptions.cs`
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Infrastructure/StubCurrentUser.cs`
- Modify: `backend/ArenaApi/src/ArenaApi.Web/appsettings.json`
- Modify: `backend/ArenaApi/src/ArenaApi.Web/appsettings.Development.json`
- Modify: `backend/ArenaApi/src/ArenaApi.Web/appsettings.Docker.json`
- Test: `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/IdentityStub/StubCurrentUserTests.cs`

- [ ] **Step 1: Write the failing test**

`backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/IdentityStub/StubCurrentUserTests.cs`:

```csharp
using ArenaApi.Core.Modules.IdentityStub;
using ArenaApi.Core.Modules.IdentityStub.Infrastructure;
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
            // IsAdmin omitted → default false
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

Run: `dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~StubCurrentUserTests" -nologo`
Expected: 4 failures with `CS0117 'ICurrentUser' does not contain a definition for 'IsAdmin'` or test failures.

- [ ] **Step 2: Add `IsAdmin` to `ICurrentUser`**

Replace `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Public/ICurrentUser.cs`:

```csharp
namespace ArenaApi.Core.Modules.IdentityStub.Public;

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

- [ ] **Step 3: Add `IsAdmin` to options**

Replace `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/IdentityStubOptions.cs`:

```csharp
namespace ArenaApi.Core.Modules.IdentityStub;

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

- [ ] **Step 4: Surface `IsAdmin` in `StubCurrentUser`**

Replace `backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/Infrastructure/StubCurrentUser.cs`:

```csharp
using ArenaApi.Core.Modules.IdentityStub.Public;
using Microsoft.Extensions.Options;

namespace ArenaApi.Core.Modules.IdentityStub.Infrastructure;

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

- [ ] **Step 5: Update appsettings**

`backend/ArenaApi/src/ArenaApi.Web/appsettings.json`:

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
  "IdentityStub": {
    "IsAdmin": false
  }
}
```

`backend/ArenaApi/src/ArenaApi.Web/appsettings.Development.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft.AspNetCore": "Information"
    }
  },
  "IdentityStub": {
    "HardcodedUserId": "01970000-0000-7000-8000-000000000001",
    "IsAdmin": true
  }
}
```

`backend/ArenaApi/src/ArenaApi.Web/appsettings.Docker.json`:

```json
{
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "Database": "Host=postgres;Port=5432;Database=sharp_arena;Username=arena;Password=arena",
    "RabbitMq": "amqp://arena:arena@rabbitmq:5672/",
    "Redis": "redis:6379"
  },
  "IdentityStub": {
    "HardcodedUserId": "01970000-0000-7000-8000-000000000001",
    "IsAdmin": true
  }
}
```

- [ ] **Step 6: Run tests**

```
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~StubCurrentUserTests" -nologo
```

Expected: `Passed: 4`.

- [ ] **Step 7: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/IdentityStub/ \
        backend/ArenaApi/src/ArenaApi.Web/appsettings*.json \
        backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/IdentityStub/
git commit -m "feat(identity): add IsAdmin flag to ICurrentUser and IdentityStub"
```

---

## Task 2: `RequireAdminFilter` endpoint filter

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Web/Authorization/RequireAdminFilter.cs`
- Modify: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs`
- Test: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/AdminAuthorizationTests.cs`

The filter is a single class in the Web project so the Core module never depends on `Microsoft.AspNetCore.Http.IEndpointFilter`. The Content module's `MapContentEndpoints` accepts the filter by `Type` via `.AddEndpointFilter<RequireAdminFilter>()` — but `RequireAdminFilter` lives in Web, which the Core module would have to reference. To keep the boundary clean, `MapContentEndpoints` exposes a hook (`Action<RouteGroupBuilder>? configureAdminGroup`) that the Web project calls with the filter registration.

- [ ] **Step 1: Write the filter**

```csharp
using ArenaApi.Core.Modules.IdentityStub.Public;
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

- [ ] **Step 2: Update the integration test web factory**

Replace `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Infrastructure;
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
            TRUNCATE TABLE arena_content.collection_tasks,
                           arena_content.collections,
                           arena_content.task_unit_tests,
                           arena_content.task_assets,
                           arena_content.task_topics,
                           arena_content.tasks,
                           arena_content.topics,
                           arena_content.packages
            RESTART IDENTITY CASCADE;
        """;
        await cmd.ExecuteNonQueryAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Database", PostgresConnectionString);
        builder.UseSetting("ConnectionStrings:RabbitMq", RabbitConnectionString);
        builder.UseSetting("ConnectionStrings:Redis", "localhost:6379");
        builder.UseSetting("IdentityStub:HardcodedUserId", Guid.CreateVersion7().ToString());
        builder.UseSetting("IdentityStub:IsAdmin", DefaultIsAdmin ? "true" : "false");

        // Disable the catalog seeder during tests — every test sets its own
        // fixtures. CatalogSeederHostedService inspects this flag and exits early.
        builder.UseSetting("Content:DisableCatalogSeeder", "true");
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

Note: the `TRUNCATE` helper references tables that don't exist yet — it will only be called from tests written *after* Task 12 lands the migration. That's fine: the helper compiles independent of the table presence.

- [ ] **Step 3: Write the failing authorization test**

`backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/AdminAuthorizationTests.cs`:

```csharp
using System.Net;
using ArenaApi.IntegrationTests.Infrastructure;
using Xunit;

namespace ArenaApi.IntegrationTests.Modules.Content;

[Collection(nameof(IntegrationTestsCollection))]
public sealed class AdminAuthorizationTests
{
    private readonly IntegrationTestsWebFactory _factory;

    public AdminAuthorizationTests(IntegrationTestsWebFactory factory) => _factory = factory;

    [Fact]
    public async Task Anonymous_call_to_admin_endpoint_returns_403()
    {
        HttpClient anon = _factory.CreateAnonymousClient();

        HttpResponseMessage resp = await anon.GetAsync("/api/admin/topics/");

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
        string body = await resp.Content.ReadAsStringAsync();
        Assert.Contains("Forbidden.Admin", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Admin_call_to_admin_endpoint_returns_200()
    {
        HttpClient admin = _factory.CreateAdminClient();
        await _factory.ResetContentSchemaAsync();

        HttpResponseMessage resp = await admin.GetAsync("/api/admin/topics/");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }
}
```

This test will not even compile until the admin endpoints exist (Task 19+). That's by design — it stays red until then. Tag it `[Trait("Bundle", "Admin")]` if you want to exclude it from intermediate runs; otherwise expect a build failure and skip-run until Task 29 lands the route group.

- [ ] **Step 4: Build the Web project**

```
dotnet build backend/ArenaApi/src/ArenaApi.Web -nologo
```

Expected: `Build succeeded`. The Web project compiles independent of the admin endpoints — the filter file is standalone.

- [ ] **Step 5: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Web/Authorization/RequireAdminFilter.cs \
        backend/ArenaApi/tests/ArenaApi.IntegrationTests/Infrastructure/IntegrationTestsWebFactory.cs \
        backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/AdminAuthorizationTests.cs
git commit -m "feat(web): RequireAdminFilter and admin client helpers"
```

---

## Task 3: Update architecture tests

**Files:**
- Modify: `backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs`

The filter lives in `ArenaApi.Web.Authorization`. We want to enforce that no module's Core code depends on it (it's a host concern).

- [ ] **Step 1: Add the rule**

Replace the file entirely:

```csharp
using System.Reflection;
using NetArchTest.Rules;
using Xunit;

namespace ArenaApi.UnitTests.Architecture;

public sealed class ModuleBoundariesTests
{
    private static Assembly CoreAssembly =>
        typeof(ArenaApi.Core.Modules.Content.ContentModule).Assembly;

    private const string ContentNs = "ArenaApi.Core.Modules.Content";
    private const string ExecutionNs = "ArenaApi.Core.Modules.Execution";
    private const string ProgressNs = "ArenaApi.Core.Modules.Progress";
    private const string IdentityNs = "ArenaApi.Core.Modules.IdentityStub";
    private const string WebAuthNs = "ArenaApi.Web.Authorization";

    [Fact]
    public void Content_internals_are_not_referenced_from_other_modules()
    {
        AssertNoCrossModuleInternalRef(sourceModule: ContentNs, otherModules: [ExecutionNs, ProgressNs]);
    }

    [Fact]
    public void Execution_internals_are_not_referenced_from_other_modules()
    {
        AssertNoCrossModuleInternalRef(sourceModule: ExecutionNs, otherModules: [ContentNs, ProgressNs]);
    }

    [Fact]
    public void Progress_internals_are_not_referenced_from_other_modules()
    {
        AssertNoCrossModuleInternalRef(sourceModule: ProgressNs, otherModules: [ContentNs, ExecutionNs]);
    }

    [Fact]
    public void IdentityStub_only_exposes_Public_namespace()
    {
        TestResult result = Types
            .InAssembly(CoreAssembly)
            .That()
            .ResideInNamespaceMatching($"^(?!{IdentityNs}).*")
            .ShouldNot()
            .HaveDependencyOn($"{IdentityNs}.Infrastructure")
            .GetResult();

        Assert.True(
            result.IsSuccessful,
            FailingTypesMessage("Non-IdentityStub code depends on IdentityStub.Infrastructure", result));
    }

    [Fact]
    public void Core_modules_do_not_depend_on_Web_authorization()
    {
        // ArenaApi.Web.Authorization is a host concern (endpoint filters). No
        // Core module is allowed to reference it — wiring happens in Program.cs
        // / ContentModule.MapContentEndpoints via an Action<RouteGroupBuilder>.
        TestResult result = Types
            .InAssembly(CoreAssembly)
            .ShouldNot()
            .HaveDependencyOn(WebAuthNs)
            .GetResult();

        Assert.True(
            result.IsSuccessful,
            FailingTypesMessage("Core has dependency on Web.Authorization", result));
    }

    [Fact]
    public void DbContexts_are_not_referenced_outside_their_owning_module()
    {
        Assert.All(
            new (string Owner, string Type)[]
            {
                (ContentNs, $"{ContentNs}.Infrastructure.ContentDbContext"),
                (ExecutionNs, $"{ExecutionNs}.Infrastructure.ExecutionDbContext"),
                (ProgressNs, $"{ProgressNs}.Infrastructure.ProgressDbContext"),
            },
            x =>
            {
                TestResult result = Types
                    .InAssembly(CoreAssembly)
                    .That()
                    .ResideInNamespaceMatching($"^(?!{x.Owner}).*")
                    .And()
                    .DoNotResideInNamespace("ArenaApi.Core")
                    .ShouldNot()
                    .HaveDependencyOn(x.Type)
                    .GetResult();

                Assert.True(
                    result.IsSuccessful,
                    FailingTypesMessage($"{x.Type} referenced outside {x.Owner}", result));
            });
    }

    private static void AssertNoCrossModuleInternalRef(string sourceModule, string[] otherModules)
    {
        foreach (string other in otherModules)
        {
            TestResult result = Types
                .InAssembly(CoreAssembly)
                .That()
                .ResideInNamespaceMatching($@"^{other}\.(?!Public).*")
                .ShouldNot()
                .HaveDependencyOnAny(
                    $"{sourceModule}.Domain",
                    $"{sourceModule}.Infrastructure",
                    $"{sourceModule}.Features")
                .GetResult();

            Assert.True(
                result.IsSuccessful,
                FailingTypesMessage($"{other} depends on {sourceModule} internals", result));
        }
    }

    private static string FailingTypesMessage(string title, TestResult result)
    {
        IEnumerable<string> failing = result.FailingTypeNames ?? [];
        return $"{title}: {string.Join(", ", failing)}";
    }
}
```

- [ ] **Step 2: Run**

```
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~ModuleBoundariesTests" -nologo
```

Expected: `Passed: 5`. The new `Core_modules_do_not_depend_on_Web_authorization` test passes because no Core type references that namespace today.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/tests/ArenaApi.UnitTests/Architecture/ModuleBoundariesTests.cs
git commit -m "test(arch): forbid Core dependencies on Web.Authorization"
```

---

## Task 4: Content domain enums

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Enums.cs`
- Test: `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/EnumsTests.cs`

All enums are `short`-backed so EF stores them as `smallint`. Casting via explicit `(short)` is verified in the test.

- [ ] **Step 1: Write the failing test**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Xunit;

namespace ArenaApi.UnitTests.Modules.Content;

public sealed class EnumsTests
{
    [Theory]
    [InlineData(Difficulty.Easy, (short)1)]
    [InlineData(Difficulty.Medium, (short)2)]
    [InlineData(Difficulty.Hard, (short)3)]
    [InlineData(Difficulty.Expert, (short)4)]
    public void Difficulty_short_round_trip(Difficulty v, short expected)
    {
        Assert.Equal(expected, (short)v);
        Assert.Equal(v, (Difficulty)expected);
    }

    [Theory]
    [InlineData(TaskFormat.Single, (short)1)]
    [InlineData(TaskFormat.MiniQuest, (short)2)]
    [InlineData(TaskFormat.Boss, (short)3)]
    [InlineData(TaskFormat.Pack, (short)4)]
    public void TaskFormat_short_round_trip(TaskFormat v, short expected)
    {
        Assert.Equal(expected, (short)v);
        Assert.Equal(v, (TaskFormat)expected);
    }

    [Fact]
    public void TestFormat_only_unit_test_is_defined()
    {
        Assert.Equal((short)1, (short)TestFormat.UnitTest);
        Assert.Single(Enum.GetValues<TestFormat>());
    }

    [Theory]
    [InlineData(AssetKind.Starter, (short)1)]
    [InlineData(AssetKind.Example, (short)2)]
    [InlineData(AssetKind.Constraint, (short)3)]
    [InlineData(AssetKind.Hint, (short)4)]
    public void AssetKind_short_round_trip(AssetKind v, short expected)
    {
        Assert.Equal(expected, (short)v);
        Assert.Equal(v, (AssetKind)expected);
    }

    [Theory]
    [InlineData(ContentTaskStatus.Draft, (short)1)]
    [InlineData(ContentTaskStatus.Published, (short)2)]
    [InlineData(ContentTaskStatus.Archived, (short)3)]
    public void ContentTaskStatus_short_round_trip(ContentTaskStatus v, short expected)
    {
        Assert.Equal(expected, (short)v);
        Assert.Equal(v, (ContentTaskStatus)expected);
    }

    [Theory]
    [InlineData(CollectionStatus.Draft, (short)1)]
    [InlineData(CollectionStatus.Published, (short)2)]
    [InlineData(CollectionStatus.Archived, (short)3)]
    public void CollectionStatus_short_round_trip(CollectionStatus v, short expected)
    {
        Assert.Equal(expected, (short)v);
        Assert.Equal(v, (CollectionStatus)expected);
    }
}
```

Run: `dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~EnumsTests" -nologo`
Expected: `Build FAILED — type or namespace 'Difficulty' could not be found`.

- [ ] **Step 2: Write the enums file**

```csharp
namespace ArenaApi.Core.Modules.Content.Domain;

public enum Difficulty : short
{
    Easy = 1,
    Medium = 2,
    Hard = 3,
    Expert = 4,
}

public enum TaskFormat : short
{
    Single = 1,
    MiniQuest = 2,
    Boss = 3,
    Pack = 4,
}

/// Currently we only support the "harness prints TEST n PASS|FAIL" convention
/// (see runners/csharp). xUnit TRX, JUnit XML, etc. become new values when
/// they're added.
public enum TestFormat : short
{
    UnitTest = 1,
}

public enum AssetKind : short
{
    /// Editable source the player starts with. Exactly one expected at publish.
    Starter = 1,

    /// Worked example: `content` is a JSON object {"input":"...","output":"...","explanation":"..."}.
    /// At least one expected at publish.
    Example = 2,

    /// One markdown bullet of a constraint (e.g. "1 ≤ n ≤ 10^5").
    Constraint = 3,

    /// One revealable hint (markdown).
    Hint = 4,
}

public enum ContentTaskStatus : short
{
    Draft = 1,
    Published = 2,
    Archived = 3,
}

public enum CollectionStatus : short
{
    Draft = 1,
    Published = 2,
    Archived = 3,
}

public enum IconTone : short
{
    Purple = 1,
    Cyan = 2,
    Gold = 3,
    Green = 4,
    Red = 5,
    Blue = 6,
    Pink = 7,
}

public enum CollectionAccent : short
{
    Purple = 1,
    Cyan = 2,
    Gold = 3,
    Green = 4,
}

/// Shared parsing helpers. Domain factories use these to translate slug-style
/// strings (the API surface) into the enum (the storage surface).
public static class EnumParsing
{
    public static bool TryParseIconTone(string raw, out IconTone tone) =>
        raw switch
        {
            "purple" => Set(IconTone.Purple, out tone),
            "cyan" => Set(IconTone.Cyan, out tone),
            "gold" => Set(IconTone.Gold, out tone),
            "green" => Set(IconTone.Green, out tone),
            "red" => Set(IconTone.Red, out tone),
            "blue" => Set(IconTone.Blue, out tone),
            "pink" => Set(IconTone.Pink, out tone),
            _ => Set(IconTone.Purple, out tone, success: false),
        };

    public static string ToSlug(IconTone tone) => tone switch
    {
        IconTone.Purple => "purple",
        IconTone.Cyan => "cyan",
        IconTone.Gold => "gold",
        IconTone.Green => "green",
        IconTone.Red => "red",
        IconTone.Blue => "blue",
        IconTone.Pink => "pink",
        _ => "purple",
    };

    public static bool TryParseAccent(string raw, out CollectionAccent accent) =>
        raw switch
        {
            "purple" => Set(CollectionAccent.Purple, out accent),
            "cyan" => Set(CollectionAccent.Cyan, out accent),
            "gold" => Set(CollectionAccent.Gold, out accent),
            "green" => Set(CollectionAccent.Green, out accent),
            _ => Set(CollectionAccent.Purple, out accent, success: false),
        };

    public static string ToSlug(CollectionAccent accent) => accent switch
    {
        CollectionAccent.Purple => "purple",
        CollectionAccent.Cyan => "cyan",
        CollectionAccent.Gold => "gold",
        CollectionAccent.Green => "green",
        _ => "purple",
    };

    public static bool TryParseDifficulty(string raw, out Difficulty d) =>
        raw switch
        {
            "easy" => Set(Difficulty.Easy, out d),
            "medium" => Set(Difficulty.Medium, out d),
            "hard" => Set(Difficulty.Hard, out d),
            "expert" => Set(Difficulty.Expert, out d),
            _ => Set(Difficulty.Easy, out d, success: false),
        };

    public static string ToSlug(Difficulty d) => d switch
    {
        Difficulty.Easy => "easy",
        Difficulty.Medium => "medium",
        Difficulty.Hard => "hard",
        Difficulty.Expert => "expert",
        _ => "easy",
    };

    public static bool TryParseFormat(string raw, out TaskFormat f) =>
        raw switch
        {
            "single" => Set(TaskFormat.Single, out f),
            "mini-quest" => Set(TaskFormat.MiniQuest, out f),
            "boss" => Set(TaskFormat.Boss, out f),
            "pack" => Set(TaskFormat.Pack, out f),
            _ => Set(TaskFormat.Single, out f, success: false),
        };

    public static string ToSlug(TaskFormat f) => f switch
    {
        TaskFormat.Single => "single",
        TaskFormat.MiniQuest => "mini-quest",
        TaskFormat.Boss => "boss",
        TaskFormat.Pack => "pack",
        _ => "single",
    };

    private static bool Set<T>(T value, out T target, bool success = true)
    {
        target = value;
        return success;
    }
}
```

- [ ] **Step 3: Run the test**

```
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~EnumsTests" -nologo
```

Expected: `Passed: 17`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Enums.cs \
        backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/EnumsTests.cs
git commit -m "feat(content): domain enums + slug parsing helpers"
```

---

## Task 5: `Topic` aggregate

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Topic.cs`
- Test: `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/TopicTests.cs`

`Topic` is a simple aggregate — slug, label, tone, sort order. No collections, no events.

- [ ] **Step 1: Write the failing test**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using CSharpFunctionalExtensions;
using Xunit;

namespace ArenaApi.UnitTests.Modules.Content;

public sealed class TopicTests
{
    [Fact]
    public void Create_with_valid_inputs_succeeds()
    {
        var result = Topic.Create("csharp-basics", "C# Basics", IconTone.Purple, sortOrder: 0);

        Assert.True(result.IsSuccess);
        Topic topic = result.Value;
        Assert.NotEqual(Guid.Empty, topic.Id);
        Assert.Equal("csharp-basics", topic.Slug);
        Assert.Equal("C# Basics", topic.Label);
        Assert.Equal(IconTone.Purple, topic.Tone);
        Assert.Equal(0, topic.SortOrder);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("UPPER")]
    [InlineData("with space")]
    [InlineData("-leading-dash")]
    [InlineData("9-leading-digit")]
    public void Create_with_invalid_slug_fails(string slug)
    {
        var result = Topic.Create(slug, "Label", IconTone.Purple, 0);

        Assert.True(result.IsFailure);
        Assert.StartsWith("Validation.", result.Error.Code, StringComparison.Ordinal);
    }

    [Fact]
    public void Create_with_blank_label_fails()
    {
        var result = Topic.Create("ok", "   ", IconTone.Purple, 0);

        Assert.True(result.IsFailure);
        Assert.Equal("Validation.label", result.Error.Code);
    }

    [Fact]
    public void Rename_updates_label()
    {
        Topic topic = Topic.Create("csharp", "C#", IconTone.Purple, 0).Value;

        var result = topic.Rename("C Sharp", IconTone.Cyan, 5);

        Assert.True(result.IsSuccess);
        Assert.Equal("C Sharp", topic.Label);
        Assert.Equal(IconTone.Cyan, topic.Tone);
        Assert.Equal(5, topic.SortOrder);
    }

    [Fact]
    public void Rename_with_blank_label_fails()
    {
        Topic topic = Topic.Create("csharp", "C#", IconTone.Purple, 0).Value;

        var result = topic.Rename("", IconTone.Cyan, 5);

        Assert.True(result.IsFailure);
        Assert.Equal("Validation.label", result.Error.Code);
    }
}
```

- [ ] **Step 2: Run — confirm red**

```
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~TopicTests" -nologo
```

Expected: build failure (`Topic` doesn't exist).

- [ ] **Step 3: Write the aggregate**

```csharp
using System.Text.RegularExpressions;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Core.Modules.Content.Domain;

internal sealed partial class Topic
{
    public Guid Id { get; private init; }
    public string Slug { get; private init; } = null!;
    public string Label { get; private set; } = null!;
    public IconTone Tone { get; private set; }
    public int SortOrder { get; private set; }

    private Topic() { } // EF Core

    public static Result<Topic, Error> Create(
        string slug,
        string label,
        IconTone tone,
        int sortOrder)
    {
        Result<string, Error> slugCheck = SlugRules.Validate(slug, nameof(slug));
        if (slugCheck.IsFailure)
        {
            return slugCheck.Error;
        }

        if (string.IsNullOrWhiteSpace(label))
        {
            return Error.Validation("label", "Topic label must not be empty.");
        }

        return new Topic
        {
            Id = Guid.CreateVersion7(),
            Slug = slugCheck.Value,
            Label = label.Trim(),
            Tone = tone,
            SortOrder = sortOrder,
        };
    }

    public Result<Unit, Error> Rename(string label, IconTone tone, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(label))
        {
            return Error.Validation("label", "Topic label must not be empty.");
        }

        Label = label.Trim();
        Tone = tone;
        SortOrder = sortOrder;
        return Unit.Value;
    }
}

internal static partial class SlugRules
{
    private static readonly Regex Pattern = SlugRegex();

    public static Result<string, Error> Validate(string raw, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Error.Validation(fieldName, "Slug must not be empty.");
        }

        string trimmed = raw.Trim();
        if (!Pattern.IsMatch(trimmed))
        {
            return Error.Validation(
                fieldName,
                "Slug must be lowercase kebab-case starting with a letter (e.g. 'csharp-basics').");
        }

        return trimmed;
    }

    [GeneratedRegex("^[a-z][a-z0-9-]*$")]
    private static partial Regex SlugRegex();
}
```

- [ ] **Step 4: Run — confirm green**

```
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~TopicTests" -nologo
```

Expected: `Passed: 10`.

- [ ] **Step 5: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Topic.cs \
        backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/TopicTests.cs
git commit -m "feat(content): Topic aggregate + shared SlugRules"
```

---

## Task 6: `ContentTask` aggregate with owned assets/tests and topics

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/ContentTask.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/TaskAsset.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/TaskUnitTest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/TaskTopic.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/DomainEvents/ContentTaskCreatedDomainEvent.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/DomainEvents/ContentTaskPublishedDomainEvent.cs`
- Test: `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/ContentTaskTests.cs`

`ContentTask` owns:
- A list of `TaskAsset` (owned, by-id) — bulk-replaced via `ReplaceAssets`.
- A list of `TaskUnitTest` (owned, by-id) — bulk-replaced via `ReplaceUnitTests`.
- A list of `TaskTopic` (separate entity, not owned) — replaced via `SetTopics`.

`Publish` validates: ≥1 starter, ≥1 example, ≥1 unit-test, ≥1 topic.

- [ ] **Step 1: Write the failing test**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Domain.DomainEvents;
using ArenaApi.Core.Shared.DomainEvents;
using CSharpFunctionalExtensions;
using Xunit;

namespace ArenaApi.UnitTests.Modules.Content;

public sealed class ContentTaskTests
{
    private static readonly DateTimeOffset Now = new(2026, 5, 24, 12, 0, 0, TimeSpan.Zero);

    private static ContentTask NewDraft() =>
        ContentTask.Create(
            slug: "two-sum",
            title: "Two Sum",
            shortDescription: "Find indices",
            language: "csharp",
            difficulty: Difficulty.Medium,
            format: TaskFormat.Single,
            createdAt: Now).Value;

    [Fact]
    public void Create_emits_ContentTaskCreated_domain_event()
    {
        ContentTask task = NewDraft();

        IDomainEvent ev = Assert.Single(task.DomainEvents);
        ContentTaskCreatedDomainEvent created = Assert.IsType<ContentTaskCreatedDomainEvent>(ev);
        Assert.Equal(task.Id, created.TaskId);
        Assert.Equal("two-sum", created.Slug);
    }

    [Fact]
    public void Create_starts_in_draft_status_with_default_metadata()
    {
        ContentTask task = NewDraft();

        Assert.Equal(ContentTaskStatus.Draft, task.Status);
        Assert.Null(task.PublishedAt);
        Assert.Equal(string.Empty, task.LongDescription);
        Assert.Equal((short)0, task.XpReward);
        Assert.Equal((short)0, task.EstimatedMinutes);
        Assert.Equal("?", task.IconGlyph);
        Assert.Equal(IconTone.Purple, task.IconTone);
        Assert.Equal(TestFormat.UnitTest, task.TestFormat);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("UPPER")]
    public void Create_with_bad_slug_fails(string slug)
    {
        var r = ContentTask.Create(slug, "T", "d", "csharp", Difficulty.Easy, TaskFormat.Single, Now);
        Assert.True(r.IsFailure);
    }

    [Fact]
    public void Create_with_non_csharp_language_fails()
    {
        var r = ContentTask.Create("ok", "T", "d", "python", Difficulty.Easy, TaskFormat.Single, Now);
        Assert.True(r.IsFailure);
        Assert.Equal("Validation.language", r.Error.Code);
    }

    [Fact]
    public void UpdateMetadata_overwrites_editable_fields()
    {
        ContentTask task = NewDraft();

        var r = task.UpdateMetadata(
            title: "Two Sum v2",
            shortDescription: "Find two indices",
            longDescription: "## Problem\n...",
            difficulty: Difficulty.Hard,
            format: TaskFormat.MiniQuest,
            xpReward: 25,
            estimatedMinutes: 30,
            iconGlyph: "Σ",
            iconTone: IconTone.Blue,
            updatedAt: Now);

        Assert.True(r.IsSuccess);
        Assert.Equal("Two Sum v2", task.Title);
        Assert.Equal("Find two indices", task.ShortDescription);
        Assert.Equal("## Problem\n...", task.LongDescription);
        Assert.Equal(Difficulty.Hard, task.Difficulty);
        Assert.Equal(TaskFormat.MiniQuest, task.Format);
        Assert.Equal((short)25, task.XpReward);
        Assert.Equal((short)30, task.EstimatedMinutes);
        Assert.Equal("Σ", task.IconGlyph);
        Assert.Equal(IconTone.Blue, task.IconTone);
    }

    [Fact]
    public void UpdateMetadata_on_published_task_fails()
    {
        ContentTask task = NewDraft();
        SeedForPublish(task);
        Assert.True(task.Publish(Now).IsSuccess);

        var r = task.UpdateMetadata("X", "Y", "Z", Difficulty.Easy, TaskFormat.Single, 1, 1, "?", IconTone.Purple, Now);

        Assert.True(r.IsFailure);
        Assert.Equal("ContentTask.Conflict", r.Error.Code);
    }

    [Fact]
    public void ReplaceAssets_replaces_existing_collection()
    {
        ContentTask task = NewDraft();
        task.ReplaceAssets(new[]
        {
            new TaskAssetInput(AssetKind.Starter, 0, "public class Solution {}", null),
            new TaskAssetInput(AssetKind.Example, 0,
                "{\"input\":\"[1,2]\",\"output\":\"3\"}", null),
        });

        Assert.Equal(2, task.Assets.Count);

        task.ReplaceAssets(new[]
        {
            new TaskAssetInput(AssetKind.Starter, 0, "public class Solution { /* v2 */ }", null),
        });

        Assert.Single(task.Assets);
        Assert.Contains(task.Assets, a => a.Content.Contains("v2", StringComparison.Ordinal));
    }

    [Fact]
    public void ReplaceUnitTests_replaces_existing_collection()
    {
        ContentTask task = NewDraft();
        task.ReplaceUnitTests(new[]
        {
            new TaskUnitTestInput("HappyPath.cs", "// test", isHidden: true, ordinal: 0),
        });
        Assert.Single(task.UnitTests);

        task.ReplaceUnitTests(new[]
        {
            new TaskUnitTestInput("Happy.cs", "// v2", true, 0),
            new TaskUnitTestInput("Edge.cs", "// edge", false, 1),
        });
        Assert.Equal(2, task.UnitTests.Count);
    }

    [Fact]
    public void SetTopics_replaces_topic_links()
    {
        ContentTask task = NewDraft();
        Guid t1 = Guid.CreateVersion7();
        Guid t2 = Guid.CreateVersion7();
        Guid t3 = Guid.CreateVersion7();

        task.SetTopics(new[] { t1, t2 });
        Assert.Equal(2, task.TopicLinks.Count);

        task.SetTopics(new[] { t2, t3 });
        Assert.Equal(2, task.TopicLinks.Count);
        Assert.DoesNotContain(task.TopicLinks, link => link.TopicId == t1);
    }

    [Fact]
    public void Publish_without_starter_fails()
    {
        ContentTask task = NewDraft();
        // Only example + tests + topics, no starter
        task.ReplaceAssets(new[]
        {
            new TaskAssetInput(AssetKind.Example, 0, "{}", null),
        });
        task.ReplaceUnitTests(new[] { new TaskUnitTestInput("T.cs", "x", true, 0) });
        task.SetTopics(new[] { Guid.CreateVersion7() });

        var r = task.Publish(Now);

        Assert.True(r.IsFailure);
        Assert.Equal("ContentTask.Validation", r.Error.Code);
        Assert.Contains("starter", r.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Publish_without_example_fails()
    {
        ContentTask task = NewDraft();
        task.ReplaceAssets(new[]
        {
            new TaskAssetInput(AssetKind.Starter, 0, "public class Solution {}", null),
        });
        task.ReplaceUnitTests(new[] { new TaskUnitTestInput("T.cs", "x", true, 0) });
        task.SetTopics(new[] { Guid.CreateVersion7() });

        var r = task.Publish(Now);

        Assert.True(r.IsFailure);
        Assert.Contains("example", r.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Publish_without_unit_test_fails()
    {
        ContentTask task = NewDraft();
        task.ReplaceAssets(new[]
        {
            new TaskAssetInput(AssetKind.Starter, 0, "public class Solution {}", null),
            new TaskAssetInput(AssetKind.Example, 0, "{}", null),
        });
        task.SetTopics(new[] { Guid.CreateVersion7() });

        var r = task.Publish(Now);

        Assert.True(r.IsFailure);
        Assert.Contains("unit test", r.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Publish_without_topic_fails()
    {
        ContentTask task = NewDraft();
        SeedAssetsAndTests(task);

        var r = task.Publish(Now);

        Assert.True(r.IsFailure);
        Assert.Contains("topic", r.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Publish_with_everything_succeeds_and_sets_published_at()
    {
        ContentTask task = NewDraft();
        SeedForPublish(task);
        task.ClearDomainEvents();

        var r = task.Publish(Now);

        Assert.True(r.IsSuccess);
        Assert.Equal(ContentTaskStatus.Published, task.Status);
        Assert.Equal(Now, task.PublishedAt);
        IDomainEvent ev = Assert.Single(task.DomainEvents);
        ContentTaskPublishedDomainEvent published = Assert.IsType<ContentTaskPublishedDomainEvent>(ev);
        Assert.Equal(task.Id, published.TaskId);
    }

    [Fact]
    public void Publish_idempotent_when_already_published_is_conflict()
    {
        ContentTask task = NewDraft();
        SeedForPublish(task);
        Assert.True(task.Publish(Now).IsSuccess);

        var r = task.Publish(Now);

        Assert.True(r.IsFailure);
        Assert.Equal("ContentTask.Conflict", r.Error.Code);
    }

    [Fact]
    public void Archive_then_publish_round_trip()
    {
        ContentTask task = NewDraft();
        SeedForPublish(task);
        Assert.True(task.Publish(Now).IsSuccess);

        Assert.True(task.Archive().IsSuccess);
        Assert.Equal(ContentTaskStatus.Archived, task.Status);

        Assert.True(task.Publish(Now.AddMinutes(5)).IsSuccess);
        Assert.Equal(ContentTaskStatus.Published, task.Status);
        Assert.Equal(Now.AddMinutes(5), task.PublishedAt);
    }

    [Fact]
    public void Archive_draft_fails()
    {
        ContentTask task = NewDraft();

        var r = task.Archive();

        Assert.True(r.IsFailure);
        Assert.Equal("ContentTask.Conflict", r.Error.Code);
    }

    private static void SeedAssetsAndTests(ContentTask task)
    {
        task.ReplaceAssets(new[]
        {
            new TaskAssetInput(AssetKind.Starter, 0, "public class Solution {}", null),
            new TaskAssetInput(AssetKind.Example, 0,
                "{\"input\":\"[1,2]\",\"output\":\"3\"}", null),
        });
        task.ReplaceUnitTests(new[] { new TaskUnitTestInput("HappyPath.cs", "// xunit code", true, 0) });
    }

    private static void SeedForPublish(ContentTask task)
    {
        SeedAssetsAndTests(task);
        task.SetTopics(new[] { Guid.CreateVersion7() });
    }
}
```

Run: `dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~ContentTaskTests" -nologo`
Expected: build fails (types missing).

- [ ] **Step 2: Write the domain event records**

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/DomainEvents/ContentTaskCreatedDomainEvent.cs`:

```csharp
using ArenaApi.Core.Shared.DomainEvents;

namespace ArenaApi.Core.Modules.Content.Domain.DomainEvents;

internal sealed record ContentTaskCreatedDomainEvent(Guid TaskId, string Slug) : IDomainEvent;
```

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/DomainEvents/ContentTaskPublishedDomainEvent.cs`:

```csharp
using ArenaApi.Core.Shared.DomainEvents;

namespace ArenaApi.Core.Modules.Content.Domain.DomainEvents;

internal sealed record ContentTaskPublishedDomainEvent(
    Guid TaskId,
    string Slug,
    DateTimeOffset PublishedAt) : IDomainEvent;
```

- [ ] **Step 3: Write `TaskAsset` and its input record**

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/TaskAsset.cs`:

```csharp
namespace ArenaApi.Core.Modules.Content.Domain;

/// Input record used by ContentTask.ReplaceAssets — caller doesn't choose ids
/// or task ids; the aggregate assigns them.
internal sealed record TaskAssetInput(
    AssetKind Kind,
    int Ordinal,
    string Content,
    string? MetadataJson);

internal sealed class TaskAsset
{
    public Guid Id { get; private init; }
    public Guid TaskId { get; private init; }
    public AssetKind Kind { get; private init; }
    public int Ordinal { get; private init; }
    public string Content { get; private init; } = null!;
    public string? MetadataJson { get; private init; }

    private TaskAsset() { } // EF Core

    internal static TaskAsset FromInput(Guid taskId, TaskAssetInput input) => new()
    {
        Id = Guid.CreateVersion7(),
        TaskId = taskId,
        Kind = input.Kind,
        Ordinal = input.Ordinal,
        Content = input.Content ?? string.Empty,
        MetadataJson = input.MetadataJson,
    };
}
```

- [ ] **Step 4: Write `TaskUnitTest` and its input record**

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/TaskUnitTest.cs`:

```csharp
namespace ArenaApi.Core.Modules.Content.Domain;

internal sealed record TaskUnitTestInput(
    string Filename,
    string Content,
    bool IsHidden,
    int Ordinal);

internal sealed class TaskUnitTest
{
    public Guid Id { get; private init; }
    public Guid TaskId { get; private init; }
    public string Filename { get; private init; } = null!;
    public string Content { get; private init; } = null!;
    public bool IsHidden { get; private init; }
    public int Ordinal { get; private init; }

    private TaskUnitTest() { } // EF Core

    internal static TaskUnitTest FromInput(Guid taskId, TaskUnitTestInput input) => new()
    {
        Id = Guid.CreateVersion7(),
        TaskId = taskId,
        Filename = input.Filename,
        Content = input.Content ?? string.Empty,
        IsHidden = input.IsHidden,
        Ordinal = input.Ordinal,
    };
}
```

- [ ] **Step 5: Write `TaskTopic` join entity**

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/TaskTopic.cs`:

```csharp
namespace ArenaApi.Core.Modules.Content.Domain;

internal sealed class TaskTopic
{
    public Guid TaskId { get; private init; }
    public Guid TopicId { get; private init; }

    private TaskTopic() { } // EF Core

    internal static TaskTopic Link(Guid taskId, Guid topicId) => new()
    {
        TaskId = taskId,
        TopicId = topicId,
    };
}
```

- [ ] **Step 6: Write `ContentTask` aggregate root**

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/ContentTask.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain.DomainEvents;
using ArenaApi.Core.Shared.DomainEvents;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Core.Modules.Content.Domain;

internal sealed class ContentTask : IHasDomainEvents
{
    private readonly List<IDomainEvent> _domainEvents = [];
    private readonly List<TaskAsset> _assets = [];
    private readonly List<TaskUnitTest> _unitTests = [];
    private readonly List<TaskTopic> _topicLinks = [];

    public Guid Id { get; private init; }
    public string Slug { get; private init; } = null!;
    public string Title { get; private set; } = null!;
    public string ShortDescription { get; private set; } = null!;
    public string LongDescription { get; private set; } = string.Empty;
    public string Language { get; private init; } = null!;
    public Difficulty Difficulty { get; private set; }
    public TaskFormat Format { get; private set; }
    public TestFormat TestFormat { get; private init; }
    public short XpReward { get; private set; }
    public short EstimatedMinutes { get; private set; }
    public string IconGlyph { get; private set; } = "?";
    public IconTone IconTone { get; private set; }
    public ContentTaskStatus Status { get; private set; }
    public DateTimeOffset? PublishedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private init; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public IReadOnlyList<TaskAsset> Assets => _assets;
    public IReadOnlyList<TaskUnitTest> UnitTests => _unitTests;
    public IReadOnlyList<TaskTopic> TopicLinks => _topicLinks;
    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents;

    public void ClearDomainEvents() => _domainEvents.Clear();

    private ContentTask() { } // EF Core

    public static Result<ContentTask, Error> Create(
        string slug,
        string title,
        string shortDescription,
        string language,
        Difficulty difficulty,
        TaskFormat format,
        DateTimeOffset createdAt)
    {
        Result<string, Error> slugCheck = SlugRules.Validate(slug, nameof(slug));
        if (slugCheck.IsFailure)
        {
            return slugCheck.Error;
        }

        if (string.IsNullOrWhiteSpace(title))
        {
            return Error.Validation("title", "Title must not be empty.");
        }

        if (language != "csharp")
        {
            return Error.Validation("language", "Only 'csharp' is supported in Phase 1.");
        }

        ContentTask task = new()
        {
            Id = Guid.CreateVersion7(),
            Slug = slugCheck.Value,
            Title = title.Trim(),
            ShortDescription = shortDescription?.Trim() ?? string.Empty,
            LongDescription = string.Empty,
            Language = language,
            Difficulty = difficulty,
            Format = format,
            TestFormat = TestFormat.UnitTest,
            XpReward = 0,
            EstimatedMinutes = 0,
            IconGlyph = "?",
            IconTone = IconTone.Purple,
            Status = ContentTaskStatus.Draft,
            PublishedAt = null,
            CreatedAt = createdAt,
            UpdatedAt = createdAt,
        };

        task._domainEvents.Add(new ContentTaskCreatedDomainEvent(task.Id, task.Slug));
        return task;
    }

    public Result<Unit, Error> UpdateMetadata(
        string title,
        string shortDescription,
        string longDescription,
        Difficulty difficulty,
        TaskFormat format,
        short xpReward,
        short estimatedMinutes,
        string iconGlyph,
        IconTone iconTone,
        DateTimeOffset updatedAt)
    {
        if (Status == ContentTaskStatus.Published)
        {
            return Error.Conflict("ContentTask",
                "Cannot edit metadata while task is Published. Archive first.");
        }

        if (string.IsNullOrWhiteSpace(title))
        {
            return Error.Validation("title", "Title must not be empty.");
        }

        if (xpReward < 0 || xpReward > 1_000)
        {
            return Error.Validation("xpReward", "XP reward must be between 0 and 1000.");
        }

        if (estimatedMinutes < 0 || estimatedMinutes > 1_000)
        {
            return Error.Validation("estimatedMinutes",
                "Estimated minutes must be between 0 and 1000.");
        }

        Title = title.Trim();
        ShortDescription = shortDescription?.Trim() ?? string.Empty;
        LongDescription = longDescription ?? string.Empty;
        Difficulty = difficulty;
        Format = format;
        XpReward = xpReward;
        EstimatedMinutes = estimatedMinutes;
        IconGlyph = string.IsNullOrWhiteSpace(iconGlyph) ? "?" : iconGlyph.Trim();
        IconTone = iconTone;
        UpdatedAt = updatedAt;
        return Unit.Value;
    }

    public void ReplaceAssets(IReadOnlyCollection<TaskAssetInput> assets)
    {
        _assets.Clear();
        foreach (TaskAssetInput input in assets)
        {
            _assets.Add(TaskAsset.FromInput(Id, input));
        }
    }

    public void ReplaceUnitTests(IReadOnlyCollection<TaskUnitTestInput> tests)
    {
        _unitTests.Clear();
        foreach (TaskUnitTestInput input in tests)
        {
            _unitTests.Add(TaskUnitTest.FromInput(Id, input));
        }
    }

    public void SetTopics(IReadOnlyCollection<Guid> topicIds)
    {
        _topicLinks.Clear();
        foreach (Guid topicId in topicIds.Distinct())
        {
            _topicLinks.Add(TaskTopic.Link(Id, topicId));
        }
    }

    public Result<Unit, Error> Publish(DateTimeOffset publishedAt)
    {
        if (Status == ContentTaskStatus.Published)
        {
            return Error.Conflict("ContentTask", "Task is already Published.");
        }

        if (!_assets.Any(a => a.Kind == AssetKind.Starter))
        {
            return Error.Validation("assets",
                "Cannot publish without at least one starter asset.");
        }

        if (!_assets.Any(a => a.Kind == AssetKind.Example))
        {
            return Error.Validation("assets",
                "Cannot publish without at least one example asset.");
        }

        if (_unitTests.Count == 0)
        {
            return Error.Validation("tests",
                "Cannot publish without at least one unit test.");
        }

        if (_topicLinks.Count == 0)
        {
            return Error.Validation("topics",
                "Cannot publish without at least one topic.");
        }

        Status = ContentTaskStatus.Published;
        PublishedAt = publishedAt;
        UpdatedAt = publishedAt;
        _domainEvents.Add(new ContentTaskPublishedDomainEvent(Id, Slug, publishedAt));
        return Unit.Value;
    }

    public Result<Unit, Error> Archive()
    {
        if (Status != ContentTaskStatus.Published)
        {
            return Error.Conflict("ContentTask",
                "Only Published tasks can be archived.");
        }

        Status = ContentTaskStatus.Archived;
        return Unit.Value;
    }

    // Internal accessor used by EF Core configuration to clear the validation
    // partial Title at hydration time without exposing setters publicly.
    internal void RefreshUpdatedAt(DateTimeOffset value) => UpdatedAt = value;
}

internal static class ContentTaskExtensions
{
    private static readonly Error _conflictError =
        new("ContentTask.Conflict", "placeholder");

    // (kept blank to make the extension file resolvable if future extensions are added.)
}
```

- [ ] **Step 7: Run — confirm green**

```
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~ContentTaskTests" -nologo
```

Expected: `Passed: 17`.

- [ ] **Step 8: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/ \
        backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/ContentTaskTests.cs
git commit -m "feat(content): ContentTask aggregate with owned assets/tests/topics"
```

---

## Task 7: `Collection` aggregate with ordered tasks

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Collection.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/CollectionTask.cs`
- Test: `backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/CollectionTests.cs`

`Collection` mirrors `ContentTask` lifecycle (Draft → Published → Archived). It owns an ordered list of `CollectionTask` (task id + ordinal).

- [ ] **Step 1: Failing test**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using CSharpFunctionalExtensions;
using Xunit;

namespace ArenaApi.UnitTests.Modules.Content;

public sealed class CollectionTests
{
    private static readonly DateTimeOffset Now = new(2026, 5, 24, 12, 0, 0, TimeSpan.Zero);

    private static Collection NewDraft() => Collection.Create(
        slug: "csharp-fundamentals",
        title: "C# Fundamentals Pack",
        subtitle: "Стартовый путь",
        accent: CollectionAccent.Purple,
        iconGlyph: "C#",
        iconTone: IconTone.Purple,
        sortOrder: 0,
        createdAt: Now).Value;

    [Fact]
    public void Create_assigns_id_and_defaults_to_draft()
    {
        Collection c = NewDraft();
        Assert.NotEqual(Guid.Empty, c.Id);
        Assert.Equal(CollectionStatus.Draft, c.Status);
    }

    [Theory]
    [InlineData("")]
    [InlineData("UPPER")]
    public void Create_with_bad_slug_fails(string slug)
    {
        var r = Collection.Create(slug, "T", null, CollectionAccent.Purple, "G", IconTone.Purple, 0, Now);
        Assert.True(r.IsFailure);
    }

    [Fact]
    public void SetTasks_assigns_ordinals_preserving_order()
    {
        Collection c = NewDraft();
        Guid a = Guid.CreateVersion7();
        Guid b = Guid.CreateVersion7();
        Guid d = Guid.CreateVersion7();

        c.SetTasks(new[] { a, b, d });

        Assert.Equal(3, c.Tasks.Count);
        Assert.Equal(a, c.Tasks.Single(t => t.Ordinal == 0).TaskId);
        Assert.Equal(b, c.Tasks.Single(t => t.Ordinal == 1).TaskId);
        Assert.Equal(d, c.Tasks.Single(t => t.Ordinal == 2).TaskId);
    }

    [Fact]
    public void SetTasks_deduplicates_keeping_first_position()
    {
        Collection c = NewDraft();
        Guid a = Guid.CreateVersion7();
        Guid b = Guid.CreateVersion7();

        c.SetTasks(new[] { a, b, a });

        Assert.Equal(2, c.Tasks.Count);
        Assert.Equal(a, c.Tasks.Single(t => t.Ordinal == 0).TaskId);
        Assert.Equal(b, c.Tasks.Single(t => t.Ordinal == 1).TaskId);
    }

    [Fact]
    public void Publish_requires_at_least_one_task()
    {
        Collection c = NewDraft();

        var r = c.Publish(Now);

        Assert.True(r.IsFailure);
        Assert.Equal("Collection.Validation", r.Error.Code);
    }

    [Fact]
    public void Publish_with_tasks_succeeds()
    {
        Collection c = NewDraft();
        c.SetTasks(new[] { Guid.CreateVersion7() });

        var r = c.Publish(Now);

        Assert.True(r.IsSuccess);
        Assert.Equal(CollectionStatus.Published, c.Status);
    }

    [Fact]
    public void Archive_draft_fails()
    {
        Collection c = NewDraft();
        var r = c.Archive();
        Assert.True(r.IsFailure);
    }

    [Fact]
    public void Archive_published_succeeds()
    {
        Collection c = NewDraft();
        c.SetTasks(new[] { Guid.CreateVersion7() });
        c.Publish(Now);

        var r = c.Archive();
        Assert.True(r.IsSuccess);
        Assert.Equal(CollectionStatus.Archived, c.Status);
    }

    [Fact]
    public void UpdateMetadata_overwrites_editable_fields_on_draft()
    {
        Collection c = NewDraft();
        var r = c.UpdateMetadata("New Title", "New subtitle", CollectionAccent.Cyan, "Σ", IconTone.Cyan, sortOrder: 5);
        Assert.True(r.IsSuccess);
        Assert.Equal("New Title", c.Title);
        Assert.Equal("New subtitle", c.Subtitle);
        Assert.Equal(CollectionAccent.Cyan, c.Accent);
        Assert.Equal("Σ", c.IconGlyph);
        Assert.Equal(IconTone.Cyan, c.IconTone);
        Assert.Equal(5, c.SortOrder);
    }

    [Fact]
    public void UpdateMetadata_on_published_fails()
    {
        Collection c = NewDraft();
        c.SetTasks(new[] { Guid.CreateVersion7() });
        c.Publish(Now);

        var r = c.UpdateMetadata("X", null, CollectionAccent.Purple, "?", IconTone.Purple, 0);
        Assert.True(r.IsFailure);
        Assert.Equal("Collection.Conflict", r.Error.Code);
    }
}
```

- [ ] **Step 2: Write the entities**

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/CollectionTask.cs`:

```csharp
namespace ArenaApi.Core.Modules.Content.Domain;

internal sealed class CollectionTask
{
    public Guid CollectionId { get; private init; }
    public Guid TaskId { get; private init; }
    public int Ordinal { get; private init; }

    private CollectionTask() { } // EF Core

    internal static CollectionTask Create(Guid collectionId, Guid taskId, int ordinal) => new()
    {
        CollectionId = collectionId,
        TaskId = taskId,
        Ordinal = ordinal,
    };
}
```

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Collection.cs`:

```csharp
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Core.Modules.Content.Domain;

internal sealed class Collection
{
    private readonly List<CollectionTask> _tasks = [];

    public Guid Id { get; private init; }
    public string Slug { get; private init; } = null!;
    public string Title { get; private set; } = null!;
    public string? Subtitle { get; private set; }
    public CollectionAccent Accent { get; private set; }
    public string IconGlyph { get; private set; } = "?";
    public IconTone IconTone { get; private set; }
    public CollectionStatus Status { get; private set; }
    public int SortOrder { get; private set; }
    public DateTimeOffset CreatedAt { get; private init; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public IReadOnlyList<CollectionTask> Tasks => _tasks;

    private Collection() { } // EF Core

    public static Result<Collection, Error> Create(
        string slug,
        string title,
        string? subtitle,
        CollectionAccent accent,
        string iconGlyph,
        IconTone iconTone,
        int sortOrder,
        DateTimeOffset createdAt)
    {
        Result<string, Error> slugCheck = SlugRules.Validate(slug, nameof(slug));
        if (slugCheck.IsFailure)
        {
            return slugCheck.Error;
        }

        if (string.IsNullOrWhiteSpace(title))
        {
            return Error.Validation("title", "Collection title must not be empty.");
        }

        return new Collection
        {
            Id = Guid.CreateVersion7(),
            Slug = slugCheck.Value,
            Title = title.Trim(),
            Subtitle = string.IsNullOrWhiteSpace(subtitle) ? null : subtitle.Trim(),
            Accent = accent,
            IconGlyph = string.IsNullOrWhiteSpace(iconGlyph) ? "?" : iconGlyph.Trim(),
            IconTone = iconTone,
            Status = CollectionStatus.Draft,
            SortOrder = sortOrder,
            CreatedAt = createdAt,
            UpdatedAt = createdAt,
        };
    }

    public Result<Unit, Error> UpdateMetadata(
        string title,
        string? subtitle,
        CollectionAccent accent,
        string iconGlyph,
        IconTone iconTone,
        int sortOrder)
    {
        if (Status == CollectionStatus.Published)
        {
            return Error.Conflict("Collection",
                "Cannot edit metadata while collection is Published. Archive first.");
        }

        if (string.IsNullOrWhiteSpace(title))
        {
            return Error.Validation("title", "Collection title must not be empty.");
        }

        Title = title.Trim();
        Subtitle = string.IsNullOrWhiteSpace(subtitle) ? null : subtitle.Trim();
        Accent = accent;
        IconGlyph = string.IsNullOrWhiteSpace(iconGlyph) ? "?" : iconGlyph.Trim();
        IconTone = iconTone;
        SortOrder = sortOrder;
        return Unit.Value;
    }

    public void SetTasks(IReadOnlyList<Guid> orderedTaskIds)
    {
        _tasks.Clear();
        int ordinal = 0;
        HashSet<Guid> seen = [];
        foreach (Guid id in orderedTaskIds)
        {
            if (!seen.Add(id))
            {
                continue;
            }

            _tasks.Add(CollectionTask.Create(Id, id, ordinal));
            ordinal++;
        }
    }

    public Result<Unit, Error> Publish(DateTimeOffset publishedAt)
    {
        if (Status == CollectionStatus.Published)
        {
            return Error.Conflict("Collection", "Collection is already Published.");
        }

        if (_tasks.Count == 0)
        {
            return Error.Validation("tasks",
                "Cannot publish a collection with zero tasks.");
        }

        Status = CollectionStatus.Published;
        UpdatedAt = publishedAt;
        return Unit.Value;
    }

    public Result<Unit, Error> Archive()
    {
        if (Status != CollectionStatus.Published)
        {
            return Error.Conflict("Collection",
                "Only Published collections can be archived.");
        }

        Status = CollectionStatus.Archived;
        return Unit.Value;
    }
}
```

- [ ] **Step 3: Run**

```
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~CollectionTests" -nologo
```

Expected: `Passed: 12`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Collection.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/CollectionTask.cs \
        backend/ArenaApi/tests/ArenaApi.UnitTests/Modules/Content/CollectionTests.cs
git commit -m "feat(content): Collection aggregate with ordered tasks"
```

---

## Task 8: EF configurations for `Topic`, `ContentTask`, `TaskAsset`, `TaskUnitTest`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TopicConfiguration.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/ContentTaskConfiguration.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TaskAssetConfiguration.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TaskUnitTestConfiguration.cs`

- [ ] **Step 1: Topic configuration**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Core.Modules.Content.Infrastructure.Configurations;

internal sealed class TopicConfiguration : IEntityTypeConfiguration<Topic>
{
    public void Configure(EntityTypeBuilder<Topic> b)
    {
        b.ToTable("topics");

        b.HasKey(t => t.Id);
        b.Property(t => t.Id).HasColumnName("id");

        b.Property(t => t.Slug).HasColumnName("slug").HasMaxLength(64).IsRequired();
        b.HasIndex(t => t.Slug).IsUnique();

        b.Property(t => t.Label).HasColumnName("label").IsRequired();

        b.Property(t => t.Tone)
            .HasColumnName("tone")
            .HasConversion<short>()
            .IsRequired();

        b.Property(t => t.SortOrder).HasColumnName("sort_order").IsRequired();
    }
}
```

- [ ] **Step 2: ContentTask configuration**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Core.Modules.Content.Infrastructure.Configurations;

internal sealed class ContentTaskConfiguration : IEntityTypeConfiguration<ContentTask>
{
    public void Configure(EntityTypeBuilder<ContentTask> b)
    {
        b.ToTable("content_tasks");

        b.HasKey(t => t.Id);
        b.Property(t => t.Id).HasColumnName("id");

        b.Property(t => t.Slug).HasColumnName("slug").HasMaxLength(64).IsRequired();
        b.HasIndex(t => t.Slug).IsUnique();

        b.Property(t => t.Title).HasColumnName("title").IsRequired();
        b.Property(t => t.ShortDescription).HasColumnName("short_description").IsRequired();
        b.Property(t => t.LongDescription).HasColumnName("long_description").IsRequired();

        b.Property(t => t.Language).HasColumnName("language").HasMaxLength(16).IsRequired();

        b.Property(t => t.Difficulty)
            .HasColumnName("difficulty")
            .HasConversion<short>()
            .IsRequired();

        b.Property(t => t.Format)
            .HasColumnName("format")
            .HasConversion<short>()
            .IsRequired();

        b.Property(t => t.TestFormat)
            .HasColumnName("test_format")
            .HasConversion<short>()
            .IsRequired();

        b.Property(t => t.XpReward).HasColumnName("xp_reward").IsRequired();
        b.Property(t => t.EstimatedMinutes).HasColumnName("estimated_minutes").IsRequired();

        b.Property(t => t.IconGlyph).HasColumnName("icon_glyph").HasMaxLength(8).IsRequired();
        b.Property(t => t.IconTone)
            .HasColumnName("icon_tone")
            .HasConversion<short>()
            .IsRequired();

        b.Property(t => t.Status)
            .HasColumnName("status")
            .HasConversion<short>()
            .IsRequired();
        b.HasIndex(t => t.Status);

        b.Property(t => t.PublishedAt).HasColumnName("published_at");
        b.Property(t => t.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(t => t.UpdatedAt).HasColumnName("updated_at").IsRequired();

        // Owned collections — one-to-many with the aggregate id as FK.
        b.HasMany(t => t.Assets)
            .WithOne()
            .HasForeignKey(a => a.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasMany(t => t.UnitTests)
            .WithOne()
            .HasForeignKey(u => u.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        // Topic links — also cascade with the task. Topic itself is the principal
        // of the other FK, configured in TaskTopicConfiguration.
        b.HasMany(t => t.TopicLinks)
            .WithOne()
            .HasForeignKey(link => link.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Navigation(t => t.Assets).AutoInclude(false);
        b.Navigation(t => t.UnitTests).AutoInclude(false);
        b.Navigation(t => t.TopicLinks).AutoInclude(false);

        b.Ignore(t => t.DomainEvents);
    }
}
```

- [ ] **Step 3: TaskAsset configuration**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Core.Modules.Content.Infrastructure.Configurations;

internal sealed class TaskAssetConfiguration : IEntityTypeConfiguration<TaskAsset>
{
    public void Configure(EntityTypeBuilder<TaskAsset> b)
    {
        b.ToTable("task_assets");

        b.HasKey(a => a.Id);
        b.Property(a => a.Id).HasColumnName("id");

        b.Property(a => a.TaskId).HasColumnName("task_id").IsRequired();
        b.HasIndex(a => a.TaskId);

        b.Property(a => a.Kind)
            .HasColumnName("kind")
            .HasConversion<short>()
            .IsRequired();

        b.Property(a => a.Ordinal).HasColumnName("ordinal").IsRequired();

        b.Property(a => a.Content).HasColumnName("content").IsRequired();

        b.Property(a => a.MetadataJson)
            .HasColumnName("metadata")
            .HasColumnType("jsonb");
    }
}
```

- [ ] **Step 4: TaskUnitTest configuration**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Core.Modules.Content.Infrastructure.Configurations;

internal sealed class TaskUnitTestConfiguration : IEntityTypeConfiguration<TaskUnitTest>
{
    public void Configure(EntityTypeBuilder<TaskUnitTest> b)
    {
        b.ToTable("task_unit_tests");

        b.HasKey(u => u.Id);
        b.Property(u => u.Id).HasColumnName("id");

        b.Property(u => u.TaskId).HasColumnName("task_id").IsRequired();
        b.HasIndex(u => u.TaskId);

        b.Property(u => u.Filename).HasColumnName("filename").HasMaxLength(128).IsRequired();
        b.Property(u => u.Content).HasColumnName("content").IsRequired();
        b.Property(u => u.IsHidden).HasColumnName("is_hidden").IsRequired();
        b.Property(u => u.Ordinal).HasColumnName("ordinal").IsRequired();
    }
}
```

- [ ] **Step 5: Build**

```
dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 6: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TopicConfiguration.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/ContentTaskConfiguration.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TaskAssetConfiguration.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TaskUnitTestConfiguration.cs
git commit -m "feat(content): EF configurations for Topic/ContentTask/TaskAsset/TaskUnitTest"
```

---

## Task 9: EF configurations for `Collection`, `CollectionTask`, `TaskTopic`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/CollectionConfiguration.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/CollectionTaskConfiguration.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TaskTopicConfiguration.cs`

- [ ] **Step 1: Collection configuration**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Core.Modules.Content.Infrastructure.Configurations;

internal sealed class CollectionConfiguration : IEntityTypeConfiguration<Collection>
{
    public void Configure(EntityTypeBuilder<Collection> b)
    {
        b.ToTable("collections");

        b.HasKey(c => c.Id);
        b.Property(c => c.Id).HasColumnName("id");

        b.Property(c => c.Slug).HasColumnName("slug").HasMaxLength(64).IsRequired();
        b.HasIndex(c => c.Slug).IsUnique();

        b.Property(c => c.Title).HasColumnName("title").IsRequired();
        b.Property(c => c.Subtitle).HasColumnName("subtitle");

        b.Property(c => c.Accent)
            .HasColumnName("accent")
            .HasConversion<short>()
            .IsRequired();

        b.Property(c => c.IconGlyph).HasColumnName("icon_glyph").HasMaxLength(8).IsRequired();
        b.Property(c => c.IconTone)
            .HasColumnName("icon_tone")
            .HasConversion<short>()
            .IsRequired();

        b.Property(c => c.Status)
            .HasColumnName("status")
            .HasConversion<short>()
            .IsRequired();
        b.HasIndex(c => c.Status);

        b.Property(c => c.SortOrder).HasColumnName("sort_order").IsRequired();
        b.Property(c => c.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(c => c.UpdatedAt).HasColumnName("updated_at").IsRequired();

        b.HasMany(c => c.Tasks)
            .WithOne()
            .HasForeignKey(ct => ct.CollectionId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Navigation(c => c.Tasks).AutoInclude(false);
    }
}
```

- [ ] **Step 2: CollectionTask configuration**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Core.Modules.Content.Infrastructure.Configurations;

internal sealed class CollectionTaskConfiguration : IEntityTypeConfiguration<CollectionTask>
{
    public void Configure(EntityTypeBuilder<CollectionTask> b)
    {
        b.ToTable("collection_tasks");

        b.HasKey(ct => new { ct.CollectionId, ct.TaskId });

        b.Property(ct => ct.CollectionId).HasColumnName("collection_id");
        b.Property(ct => ct.TaskId).HasColumnName("task_id");
        b.Property(ct => ct.Ordinal).HasColumnName("ordinal").IsRequired();

        b.HasIndex(ct => new { ct.CollectionId, ct.Ordinal });
    }
}
```

- [ ] **Step 3: TaskTopic configuration**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Core.Modules.Content.Infrastructure.Configurations;

internal sealed class TaskTopicConfiguration : IEntityTypeConfiguration<TaskTopic>
{
    public void Configure(EntityTypeBuilder<TaskTopic> b)
    {
        b.ToTable("task_topics");

        b.HasKey(link => new { link.TaskId, link.TopicId });
        b.Property(link => link.TaskId).HasColumnName("task_id");
        b.Property(link => link.TopicId).HasColumnName("topic_id");

        // FK to Topic — on Topic delete, restrict so admin sees a Conflict
        // when trying to delete a Topic that's still in use.
        b.HasOne<Topic>()
            .WithMany()
            .HasForeignKey(link => link.TopicId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(link => link.TopicId);
    }
}
```

- [ ] **Step 4: Build**

```
dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 5: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/CollectionConfiguration.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/CollectionTaskConfiguration.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Configurations/TaskTopicConfiguration.cs
git commit -m "feat(content): EF configurations for Collection/CollectionTask/TaskTopic"
```

---

## Task 10: Extend `ContentDbContext` with new DbSets

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContext.cs`

- [ ] **Step 1: Replace the file**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Infrastructure;

public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_content";

    // Legacy — kept until a cleanup migration drops the `packages` table.
    internal DbSet<Package> Packages => Set<Package>();

    internal DbSet<Topic> Topics => Set<Topic>();
    internal DbSet<ContentTask> ContentTasks => Set<ContentTask>();
    internal DbSet<TaskAsset> TaskAssets => Set<TaskAsset>();
    internal DbSet<TaskUnitTest> TaskUnitTests => Set<TaskUnitTest>();
    internal DbSet<TaskTopic> TaskTopics => Set<TaskTopic>();
    internal DbSet<Collection> Collections => Set<Collection>();
    internal DbSet<CollectionTask> CollectionTasks => Set<CollectionTask>();

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

- [ ] **Step 2: Build**

```
dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 3: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentDbContext.cs
git commit -m "feat(content): expose catalog DbSets on ContentDbContext"
```

---

## Task 11: Generate `ContentCatalogInitial` EF migration

**Files:**
- Generated: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/<ts>_ContentCatalogInitial.cs` and `.Designer.cs`
- Generated/updated: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/ContentDbContextModelSnapshot.cs`

- [ ] **Step 1: Generate the migration**

```bash
dotnet ef migrations add ContentCatalogInitial \
  --project backend/ArenaApi/src/ArenaApi.Core \
  --startup-project backend/ArenaApi/src/ArenaApi.Web \
  --context ContentDbContext \
  --output-dir Modules/Content/Infrastructure/Migrations
```

Expected: a new pair of files appears under `Modules/Content/Infrastructure/Migrations/`. The snapshot updates.

- [ ] **Step 2: Inspect the generated `Up()`**

Open the new `<ts>_ContentCatalogInitial.cs` and verify the body:

- `EnsureSchema(name: "arena_content")` (idempotent — the schema already exists from `ContentInitial`).
- `CreateTable("topics", schema: "arena_content", ...)` with `id uuid PK`, `slug character varying(64) not null`, `label text not null`, `tone smallint not null`, `sort_order integer not null`.
- `CreateTable("content_tasks", schema: "arena_content", ...)` with all `ContentTaskConfiguration` columns, indexes on `slug` (unique) and `status`.
- `CreateTable("task_assets", schema: "arena_content", ...)` with `metadata jsonb null`, `task_id` FK with `ReferentialAction.Cascade`.
- `CreateTable("task_unit_tests", schema: "arena_content", ...)`.
- `CreateTable("task_topics", schema: "arena_content", ...)` with composite PK `(task_id, topic_id)` and FK to `topics(id)` with `ReferentialAction.Restrict`.
- `CreateTable("collections", schema: "arena_content", ...)`.
- `CreateTable("collection_tasks", schema: "arena_content", ...)` composite PK, FK to `collections(id)` with cascade.
- The existing `packages` table is **not** touched.

If anything is wrong, remove the migration with:

```bash
dotnet ef migrations remove \
  --project backend/ArenaApi/src/ArenaApi.Core \
  --startup-project backend/ArenaApi/src/ArenaApi.Web \
  --context ContentDbContext
```

…fix the configuration, and regenerate.

- [ ] **Step 3: Build**

```
dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/Migrations/
git commit -m "feat(content): ContentCatalogInitial migration (topics/tasks/assets/tests/collections)"
```

---

## Task 12: Public projections

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TaskSummaryView.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TaskDetailView.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TaskAssetView.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TopicView.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/CollectionSummaryView.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/CollectionDetailView.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/TaskFilter.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/PagedResult.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IntegrationEvents/ContentTaskPublished.cs`

Projections live in `Public/` because other modules (Progress, eventually Execution) will read them. They never include `task_unit_tests`.

- [ ] **Step 1: `TopicView`**

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

public sealed record TopicView(
    Guid Id,
    string Slug,
    string Label,
    string Tone,
    int SortOrder,
    int PublishedTaskCount);
```

- [ ] **Step 2: `TaskAssetView`**

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

/// Public projection of a TaskAsset row. `Kind` is the slug ("starter",
/// "example", "constraint", "hint") — callers do not need the enum.
public sealed record TaskAssetView(
    Guid Id,
    string Kind,
    int Ordinal,
    string Content,
    string? MetadataJson);
```

- [ ] **Step 3: `TaskSummaryView`**

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

public sealed record TaskSummaryView(
    Guid Id,
    string Slug,
    string Title,
    string ShortDescription,
    string Language,
    string Difficulty,
    string Format,
    short XpReward,
    short EstimatedMinutes,
    string IconGlyph,
    string IconTone,
    DateTimeOffset PublishedAt,
    IReadOnlyList<string> TopicSlugs);
```

- [ ] **Step 4: `TaskDetailView`**

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

public sealed record TaskDetailView(
    Guid Id,
    string Slug,
    string Title,
    string ShortDescription,
    string LongDescription,
    string Language,
    string Difficulty,
    string Format,
    short XpReward,
    short EstimatedMinutes,
    string IconGlyph,
    string IconTone,
    DateTimeOffset PublishedAt,
    IReadOnlyList<string> TopicSlugs,
    IReadOnlyList<TaskAssetView> Assets);
```

- [ ] **Step 5: `CollectionSummaryView`**

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

public sealed record CollectionSummaryView(
    Guid Id,
    string Slug,
    string Title,
    string? Subtitle,
    string Accent,
    string IconGlyph,
    string IconTone,
    int TaskCount,
    short TotalEstimatedMinutes,
    int SortOrder);
```

- [ ] **Step 6: `CollectionDetailView`**

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

public sealed record CollectionDetailView(
    Guid Id,
    string Slug,
    string Title,
    string? Subtitle,
    string Accent,
    string IconGlyph,
    string IconTone,
    int SortOrder,
    IReadOnlyList<string> TaskSlugs);
```

- [ ] **Step 7: `TaskFilter`**

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

/// Cross-module filter spec used by IContentReader.ListPublishedTasksAsync.
/// All fields are optional; null/empty means "no filter on that axis".
public sealed record TaskFilter(
    string? Difficulty = null,
    string? Format = null,
    IReadOnlyList<string>? TopicSlugs = null,
    string? Query = null,
    int Page = 1,
    int PageSize = 24,
    string Sort = "newest");
```

- [ ] **Step 8: `PagedResult`**

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
```

- [ ] **Step 9: `ContentTaskPublished` integration event**

`backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IntegrationEvents/ContentTaskPublished.cs`:

```csharp
namespace ArenaApi.Core.Modules.Content.Public.IntegrationEvents;

/// Published via Wolverine + RabbitMQ when a ContentTask is published. Other
/// modules subscribe by writing an IWolverineHandler method accepting this
/// type. Phase 1.1 has no listeners yet; the event is wired so adding one is
/// a Progress-side change only.
public sealed record ContentTaskPublished(
    Guid TaskId,
    string Slug,
    string Title,
    DateTimeOffset PublishedAt);
```

- [ ] **Step 10: Build**

```
dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 11: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/
git commit -m "feat(content): public projections + TaskFilter + PagedResult + ContentTaskPublished event"
```

---

## Task 13: `IContentReader` + `ContentReader` implementation

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IContentReader.cs`
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentReader.cs`

- [ ] **Step 1: Replace `IContentReader`**

```csharp
namespace ArenaApi.Core.Modules.Content.Public;

/// Sync read contract for other modules. Implementation lives in
/// Content/Infrastructure/ContentReader.cs and queries ContentDbContext.
public interface IContentReader
{
    Task<PackageView?> GetPackageAsync(
        Guid packageId,
        CancellationToken cancellationToken = default);

    Task<PagedResult<TaskSummaryView>> ListPublishedTasksAsync(
        TaskFilter filter,
        CancellationToken cancellationToken = default);

    Task<TaskDetailView?> GetPublishedTaskBySlugAsync(
        string slug,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TopicView>> ListTopicsAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CollectionSummaryView>> ListPublishedCollectionsAsync(
        CancellationToken cancellationToken = default);

    Task<CollectionDetailView?> GetPublishedCollectionBySlugAsync(
        string slug,
        CancellationToken cancellationToken = default);
}
```

- [ ] **Step 2: Replace `ContentReader`**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
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

    public async Task<PagedResult<TaskSummaryView>> ListPublishedTasksAsync(
        TaskFilter filter,
        CancellationToken cancellationToken = default)
    {
        IQueryable<ContentTask> q = db.ContentTasks
            .AsNoTracking()
            .Where(t => t.Status == ContentTaskStatus.Published);

        if (filter.Difficulty is { Length: > 0 } && EnumParsing.TryParseDifficulty(filter.Difficulty, out Difficulty d))
        {
            q = q.Where(t => t.Difficulty == d);
        }

        if (filter.Format is { Length: > 0 } && EnumParsing.TryParseFormat(filter.Format, out TaskFormat f))
        {
            q = q.Where(t => t.Format == f);
        }

        if (filter.Query is { Length: > 0 })
        {
            string like = $"%{filter.Query.Trim()}%";
            q = q.Where(t => EF.Functions.ILike(t.Title, like));
        }

        if (filter.TopicSlugs is { Count: > 0 })
        {
            List<Guid> topicIds = await db.Topics
                .Where(topic => filter.TopicSlugs.Contains(topic.Slug))
                .Select(topic => topic.Id)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            if (topicIds.Count == 0)
            {
                return new PagedResult<TaskSummaryView>(
                    Array.Empty<TaskSummaryView>(), 0, filter.Page, filter.PageSize);
            }

            q = q.Where(t => t.TopicLinks.Any(link => topicIds.Contains(link.TopicId)));
        }

        q = filter.Sort switch
        {
            "title" => q.OrderBy(t => t.Title),
            "xp-desc" => q.OrderByDescending(t => t.XpReward).ThenBy(t => t.Title),
            _ => q.OrderByDescending(t => t.PublishedAt).ThenBy(t => t.Slug),
        };

        int total = await q.CountAsync(cancellationToken).ConfigureAwait(false);

        int page = Math.Max(1, filter.Page);
        int size = Math.Clamp(filter.PageSize, 1, 100);

        List<TaskSummaryProjection> rows = await q
            .Skip((page - 1) * size)
            .Take(size)
            .Select(t => new TaskSummaryProjection
            {
                Id = t.Id,
                Slug = t.Slug,
                Title = t.Title,
                ShortDescription = t.ShortDescription,
                Language = t.Language,
                Difficulty = t.Difficulty,
                Format = t.Format,
                XpReward = t.XpReward,
                EstimatedMinutes = t.EstimatedMinutes,
                IconGlyph = t.IconGlyph,
                IconTone = t.IconTone,
                PublishedAt = t.PublishedAt!.Value,
                TopicSlugs = db.TaskTopics
                    .Where(link => link.TaskId == t.Id)
                    .Join(db.Topics, link => link.TopicId, topic => topic.Id, (_, topic) => topic.Slug)
                    .ToList(),
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        IReadOnlyList<TaskSummaryView> items = rows.Select(r => new TaskSummaryView(
            r.Id, r.Slug, r.Title, r.ShortDescription, r.Language,
            EnumParsing.ToSlug(r.Difficulty), EnumParsing.ToSlug(r.Format),
            r.XpReward, r.EstimatedMinutes, r.IconGlyph,
            EnumParsing.ToSlug(r.IconTone), r.PublishedAt, r.TopicSlugs)).ToList();

        return new PagedResult<TaskSummaryView>(items, total, page, size);
    }

    public async Task<TaskDetailView?> GetPublishedTaskBySlugAsync(
        string slug,
        CancellationToken cancellationToken = default)
    {
        ContentTask? task = await db.ContentTasks
            .AsNoTracking()
            .Include(t => t.Assets)
            .Include(t => t.TopicLinks)
            .FirstOrDefaultAsync(
                t => t.Slug == slug && t.Status == ContentTaskStatus.Published,
                cancellationToken)
            .ConfigureAwait(false);

        if (task is null)
        {
            return null;
        }

        Dictionary<Guid, string> topicSlugById = await db.Topics
            .Where(t => task.TopicLinks.Select(link => link.TopicId).Contains(t.Id))
            .AsNoTracking()
            .ToDictionaryAsync(t => t.Id, t => t.Slug, cancellationToken)
            .ConfigureAwait(false);

        return new TaskDetailView(
            task.Id,
            task.Slug,
            task.Title,
            task.ShortDescription,
            task.LongDescription,
            task.Language,
            EnumParsing.ToSlug(task.Difficulty),
            EnumParsing.ToSlug(task.Format),
            task.XpReward,
            task.EstimatedMinutes,
            task.IconGlyph,
            EnumParsing.ToSlug(task.IconTone),
            task.PublishedAt!.Value,
            task.TopicLinks
                .Select(link => topicSlugById.TryGetValue(link.TopicId, out string? s) ? s : null)
                .Where(s => s is not null)
                .Select(s => s!)
                .ToList(),
            task.Assets
                .OrderBy(a => a.Kind)
                .ThenBy(a => a.Ordinal)
                .Select(a => new TaskAssetView(
                    a.Id,
                    a.Kind switch
                    {
                        AssetKind.Starter => "starter",
                        AssetKind.Example => "example",
                        AssetKind.Constraint => "constraint",
                        AssetKind.Hint => "hint",
                        _ => "starter",
                    },
                    a.Ordinal,
                    a.Content,
                    a.MetadataJson))
                .ToList());
    }

    public async Task<IReadOnlyList<TopicView>> ListTopicsAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await db.Topics
            .AsNoTracking()
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Label)
            .Select(t => new
            {
                t.Id,
                t.Slug,
                t.Label,
                t.Tone,
                t.SortOrder,
                PublishedTaskCount = db.TaskTopics
                    .Where(link => link.TopicId == t.Id)
                    .Join(db.ContentTasks, link => link.TaskId, task => task.Id, (_, task) => task.Status)
                    .Count(s => s == ContentTaskStatus.Published),
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return rows.Select(r => new TopicView(
            r.Id, r.Slug, r.Label, EnumParsing.ToSlug(r.Tone), r.SortOrder, r.PublishedTaskCount)).ToList();
    }

    public async Task<IReadOnlyList<CollectionSummaryView>> ListPublishedCollectionsAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await db.Collections
            .AsNoTracking()
            .Where(c => c.Status == CollectionStatus.Published)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Title)
            .Select(c => new
            {
                c.Id,
                c.Slug,
                c.Title,
                c.Subtitle,
                c.Accent,
                c.IconGlyph,
                c.IconTone,
                c.SortOrder,
                TaskCount = c.Tasks.Count,
                TotalEstimatedMinutes = db.CollectionTasks
                    .Where(ct => ct.CollectionId == c.Id)
                    .Join(db.ContentTasks, ct => ct.TaskId, task => task.Id, (_, task) => task.EstimatedMinutes)
                    .Sum(m => (int)m),
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return rows.Select(r => new CollectionSummaryView(
            r.Id, r.Slug, r.Title, r.Subtitle,
            EnumParsing.ToSlug(r.Accent), r.IconGlyph, EnumParsing.ToSlug(r.IconTone),
            r.TaskCount, (short)r.TotalEstimatedMinutes, r.SortOrder)).ToList();
    }

    public async Task<CollectionDetailView?> GetPublishedCollectionBySlugAsync(
        string slug,
        CancellationToken cancellationToken = default)
    {
        Collection? collection = await db.Collections
            .AsNoTracking()
            .Include(c => c.Tasks)
            .FirstOrDefaultAsync(
                c => c.Slug == slug && c.Status == CollectionStatus.Published,
                cancellationToken)
            .ConfigureAwait(false);

        if (collection is null)
        {
            return null;
        }

        List<Guid> orderedIds = collection.Tasks
            .OrderBy(ct => ct.Ordinal)
            .Select(ct => ct.TaskId)
            .ToList();

        Dictionary<Guid, string> taskSlugById = await db.ContentTasks
            .AsNoTracking()
            .Where(t => orderedIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Slug, cancellationToken)
            .ConfigureAwait(false);

        List<string> taskSlugs = orderedIds
            .Select(id => taskSlugById.TryGetValue(id, out string? s) ? s : null)
            .Where(s => s is not null)
            .Select(s => s!)
            .ToList();

        return new CollectionDetailView(
            collection.Id,
            collection.Slug,
            collection.Title,
            collection.Subtitle,
            EnumParsing.ToSlug(collection.Accent),
            collection.IconGlyph,
            EnumParsing.ToSlug(collection.IconTone),
            collection.SortOrder,
            taskSlugs);
    }

    private sealed class TaskSummaryProjection
    {
        public Guid Id { get; init; }
        public string Slug { get; init; } = null!;
        public string Title { get; init; } = null!;
        public string ShortDescription { get; init; } = null!;
        public string Language { get; init; } = null!;
        public Difficulty Difficulty { get; init; }
        public TaskFormat Format { get; init; }
        public short XpReward { get; init; }
        public short EstimatedMinutes { get; init; }
        public string IconGlyph { get; init; } = null!;
        public IconTone IconTone { get; init; }
        public DateTimeOffset PublishedAt { get; init; }
        public List<string> TopicSlugs { get; init; } = [];
    }
}
```

- [ ] **Step 3: Build**

```
dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Public/IContentReader.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Infrastructure/ContentReader.cs
git commit -m "feat(content): IContentReader + ContentReader (list/get tasks, topics, collections)"
```

---


## Task 14: Shared HTTP contracts and `ErrorPayload`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/ErrorPayload.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/PagedResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/TopicResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/TaskCardResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/TaskDetailResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/TaskExampleResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/CollectionCardResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/CollectionDetailResponse.cs`

- [ ] **Step 1: Write `ErrorPayload`**

```csharp
namespace ArenaApi.Contracts.Content;

public sealed record ErrorPayload(string Code, string Message);
```

- [ ] **Step 2: Write `PagedResponse`**

```csharp
namespace ArenaApi.Contracts.Content;

public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
```

- [ ] **Step 3: Write `TopicResponse`**

```csharp
namespace ArenaApi.Contracts.Content;

public sealed record TopicResponse(
    string Slug,
    string Label,
    string Tone,
    int SortOrder,
    int PublishedTaskCount);
```

- [ ] **Step 4: Write `TaskCardResponse`**

```csharp
namespace ArenaApi.Contracts.Content;

public sealed record TaskCardResponse(
    string Slug,
    string Title,
    string ShortDescription,
    string Language,
    string Difficulty,
    string Format,
    short XpReward,
    short EstimatedMinutes,
    string IconGlyph,
    string IconTone,
    IReadOnlyList<string> Topics);
```

- [ ] **Step 5: Write `TaskExampleResponse`**

```csharp
namespace ArenaApi.Contracts.Content;

public sealed record TaskExampleResponse(string Input, string Output, string? Explanation);
```

- [ ] **Step 6: Write `TaskDetailResponse`**

```csharp
namespace ArenaApi.Contracts.Content;

public sealed record TaskDetailResponse(
    string Slug,
    string Title,
    string ShortDescription,
    string LongDescription,
    string Language,
    string Difficulty,
    string Format,
    short XpReward,
    short EstimatedMinutes,
    string IconGlyph,
    string IconTone,
    IReadOnlyList<string> Topics,
    string StarterCode,
    IReadOnlyList<TaskExampleResponse> Examples,
    IReadOnlyList<string> Constraints,
    IReadOnlyList<string> Hints);
```

- [ ] **Step 7: Write `CollectionCardResponse`**

```csharp
namespace ArenaApi.Contracts.Content;

public sealed record CollectionCardResponse(
    string Slug,
    string Title,
    string? Subtitle,
    string Accent,
    string IconGlyph,
    string IconTone,
    int TaskCount,
    short TotalEstimatedMinutes);
```

- [ ] **Step 8: Write `CollectionDetailResponse`**

```csharp
namespace ArenaApi.Contracts.Content;

public sealed record CollectionDetailResponse(
    string Slug,
    string Title,
    string? Subtitle,
    string Accent,
    string IconGlyph,
    string IconTone,
    IReadOnlyList<string> TaskSlugs);
```

- [ ] **Step 9: Build**

```
dotnet build backend/ArenaApi/src/ArenaApi.Contracts -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 10: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Content/
git commit -m "feat(contracts): public catalog response DTOs"
```

---

## Task 15: Public `ListTasks` feature

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListTasks/ListTasksHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListTasks/ListTasksEndpoint.cs`

- [ ] **Step 1: Write the handler**

```csharp
using ArenaApi.Core.Modules.Content.Public;

namespace ArenaApi.Core.Modules.Content.Features.ListTasks;

internal sealed class ListTasksHandler(IContentReader reader)
{
    public Task<PagedResult<TaskSummaryView>> HandleAsync(
        TaskFilter filter,
        CancellationToken cancellationToken)
        => reader.ListPublishedTasksAsync(filter, cancellationToken);
}
```

- [ ] **Step 2: Write the endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Core.Modules.Content.Public;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.ListTasks;

internal static class ListTasksEndpoint
{
    public static IEndpointRouteBuilder MapListTasks(this IEndpointRouteBuilder group)
    {
        group.MapGet("/", HandleAsync)
            .WithName("ListTasks")
            .WithTags("Content");
        return group;
    }

    private static async Task<Ok<PagedResponse<TaskCardResponse>>> HandleAsync(
        ListTasksHandler handler,
        CancellationToken cancellationToken,
        string? difficulty = null,
        string? format = null,
        string? topics = null,
        string? q = null,
        int page = 1,
        int size = 24,
        string sort = "newest")
    {
        IReadOnlyList<string>? topicSlugs = string.IsNullOrWhiteSpace(topics)
            ? null
            : topics.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        TaskFilter filter = new(
            Difficulty: difficulty,
            Format: format,
            TopicSlugs: topicSlugs,
            Query: q,
            Page: page,
            PageSize: size,
            Sort: sort);

        PagedResult<TaskSummaryView> result =
            await handler.HandleAsync(filter, cancellationToken).ConfigureAwait(false);

        IReadOnlyList<TaskCardResponse> items = result.Items.Select(v => new TaskCardResponse(
            v.Slug, v.Title, v.ShortDescription, v.Language,
            v.Difficulty, v.Format, v.XpReward, v.EstimatedMinutes,
            v.IconGlyph, v.IconTone, v.TopicSlugs)).ToList();

        return TypedResults.Ok(new PagedResponse<TaskCardResponse>(
            items, result.Total, result.Page, result.PageSize));
    }
}
```

- [ ] **Step 3: Build**

```
dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListTasks/
git commit -m "feat(content): GET /api/v1/tasks/ — list published tasks with filters"
```

---

## Task 16: Public `GetTask` feature

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/GetTaskHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/GetTaskEndpoint.cs`

`TaskDetailView.Assets` carries everything in one bag; the endpoint splits them into starter / examples / constraints / hints for the client.

- [ ] **Step 1: Handler**

```csharp
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Core.Modules.Content.Features.GetTask;

internal sealed class GetTaskHandler(IContentReader reader)
{
    public async Task<Result<TaskDetailView, Error>> HandleAsync(
        string slug,
        CancellationToken cancellationToken)
    {
        TaskDetailView? view = await reader
            .GetPublishedTaskBySlugAsync(slug, cancellationToken)
            .ConfigureAwait(false);

        return view is null
            ? Error.NotFound("Task", slug)
            : view;
    }
}
```

- [ ] **Step 2: Endpoint**

```csharp
using System.Text.Json;
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

    private static async Task<Results<Ok<TaskDetailResponse>, NotFound<ErrorPayload>>> HandleAsync(
        string slug,
        GetTaskHandler handler,
        CancellationToken cancellationToken)
    {
        Result<TaskDetailView, Error> result = await handler
            .HandleAsync(slug, cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            return TypedResults.NotFound(new ErrorPayload(result.Error.Code, result.Error.Message));
        }

        TaskDetailView v = result.Value;

        string starter = v.Assets.FirstOrDefault(a => a.Kind == "starter")?.Content ?? string.Empty;

        List<TaskExampleResponse> examples = v.Assets
            .Where(a => a.Kind == "example")
            .OrderBy(a => a.Ordinal)
            .Select(a =>
            {
                try
                {
                    using JsonDocument doc = JsonDocument.Parse(a.Content);
                    JsonElement root = doc.RootElement;
                    string input = root.TryGetProperty("input", out JsonElement i) ? i.GetString() ?? string.Empty : string.Empty;
                    string output = root.TryGetProperty("output", out JsonElement o) ? o.GetString() ?? string.Empty : string.Empty;
                    string? explanation = root.TryGetProperty("explanation", out JsonElement e) ? e.GetString() : null;
                    return new TaskExampleResponse(input, output, explanation);
                }
                catch (JsonException)
                {
                    // Corrupt example payload — pass through verbatim as input.
                    return new TaskExampleResponse(a.Content, string.Empty, null);
                }
            })
            .ToList();

        List<string> constraints = v.Assets
            .Where(a => a.Kind == "constraint")
            .OrderBy(a => a.Ordinal)
            .Select(a => a.Content)
            .ToList();

        List<string> hints = v.Assets
            .Where(a => a.Kind == "hint")
            .OrderBy(a => a.Ordinal)
            .Select(a => a.Content)
            .ToList();

        return TypedResults.Ok(new TaskDetailResponse(
            v.Slug,
            v.Title,
            v.ShortDescription,
            v.LongDescription,
            v.Language,
            v.Difficulty,
            v.Format,
            v.XpReward,
            v.EstimatedMinutes,
            v.IconGlyph,
            v.IconTone,
            v.TopicSlugs,
            starter,
            examples,
            constraints,
            hints));
    }
}
```

- [ ] **Step 3: Build**

```
dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo
```

Expected: `Build succeeded`.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetTask/
git commit -m "feat(content): GET /api/v1/tasks/{slug}/ — task detail (no unit tests)"
```

---

## Task 17: Public `ListTopics` feature

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListTopics/ListTopicsHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListTopics/ListTopicsEndpoint.cs`

- [ ] **Step 1: Handler**

```csharp
using ArenaApi.Core.Modules.Content.Public;

namespace ArenaApi.Core.Modules.Content.Features.ListTopics;

internal sealed class ListTopicsHandler(IContentReader reader)
{
    public Task<IReadOnlyList<TopicView>> HandleAsync(CancellationToken cancellationToken)
        => reader.ListTopicsAsync(cancellationToken);
}
```

- [ ] **Step 2: Endpoint**

```csharp
using ArenaApi.Contracts.Content;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.ListTopics;

internal static class ListTopicsEndpoint
{
    public static IEndpointRouteBuilder MapListTopics(this IEndpointRouteBuilder group)
    {
        group.MapGet("/", HandleAsync)
            .WithName("ListTopics")
            .WithTags("Content");
        return group;
    }

    private static async Task<Ok<IReadOnlyList<TopicResponse>>> HandleAsync(
        ListTopicsHandler handler,
        CancellationToken cancellationToken)
    {
        var topics = await handler.HandleAsync(cancellationToken).ConfigureAwait(false);
        IReadOnlyList<TopicResponse> items = topics
            .Select(t => new TopicResponse(t.Slug, t.Label, t.Tone, t.SortOrder, t.PublishedTaskCount))
            .ToList();
        return TypedResults.Ok(items);
    }
}
```

- [ ] **Step 3: Build + commit**

```
dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListTopics/
git commit -m "feat(content): GET /api/v1/topics/ — topics with published task counts"
```

---

## Task 18: Public `ListCollections` + `GetCollection` features

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListCollections/ListCollectionsHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListCollections/ListCollectionsEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetCollection/GetCollectionHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetCollection/GetCollectionEndpoint.cs`

- [ ] **Step 1: List handler**

```csharp
using ArenaApi.Core.Modules.Content.Public;

namespace ArenaApi.Core.Modules.Content.Features.ListCollections;

internal sealed class ListCollectionsHandler(IContentReader reader)
{
    public Task<IReadOnlyList<CollectionSummaryView>> HandleAsync(CancellationToken cancellationToken)
        => reader.ListPublishedCollectionsAsync(cancellationToken);
}
```

- [ ] **Step 2: List endpoint**

```csharp
using ArenaApi.Contracts.Content;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.ListCollections;

internal static class ListCollectionsEndpoint
{
    public static IEndpointRouteBuilder MapListCollections(this IEndpointRouteBuilder group)
    {
        group.MapGet("/", HandleAsync)
            .WithName("ListCollections")
            .WithTags("Content");
        return group;
    }

    private static async Task<Ok<IReadOnlyList<CollectionCardResponse>>> HandleAsync(
        ListCollectionsHandler handler,
        CancellationToken cancellationToken)
    {
        var rows = await handler.HandleAsync(cancellationToken).ConfigureAwait(false);
        IReadOnlyList<CollectionCardResponse> items = rows
            .Select(c => new CollectionCardResponse(
                c.Slug, c.Title, c.Subtitle, c.Accent, c.IconGlyph, c.IconTone,
                c.TaskCount, c.TotalEstimatedMinutes))
            .ToList();
        return TypedResults.Ok(items);
    }
}
```

- [ ] **Step 3: Get handler**

```csharp
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Core.Modules.Content.Features.GetCollection;

internal sealed class GetCollectionHandler(IContentReader reader)
{
    public async Task<Result<CollectionDetailView, Error>> HandleAsync(
        string slug,
        CancellationToken cancellationToken)
    {
        CollectionDetailView? view = await reader
            .GetPublishedCollectionBySlugAsync(slug, cancellationToken)
            .ConfigureAwait(false);
        return view is null ? Error.NotFound("Collection", slug) : view;
    }
}
```

- [ ] **Step 4: Get endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.GetCollection;

internal static class GetCollectionEndpoint
{
    public static IEndpointRouteBuilder MapGetCollection(this IEndpointRouteBuilder group)
    {
        group.MapGet("/{slug}/", HandleAsync)
            .WithName("GetCollection")
            .WithTags("Content");
        return group;
    }

    private static async Task<Results<Ok<CollectionDetailResponse>, NotFound<ErrorPayload>>> HandleAsync(
        string slug,
        GetCollectionHandler handler,
        CancellationToken cancellationToken)
    {
        Result<CollectionDetailView, Error> result = await handler
            .HandleAsync(slug, cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            return TypedResults.NotFound(new ErrorPayload(result.Error.Code, result.Error.Message));
        }

        CollectionDetailView v = result.Value;
        return TypedResults.Ok(new CollectionDetailResponse(
            v.Slug, v.Title, v.Subtitle, v.Accent, v.IconGlyph, v.IconTone, v.TaskSlugs));
    }
}
```

- [ ] **Step 5: Build + commit**

```
dotnet build backend/ArenaApi/src/ArenaApi.Core -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/ListCollections/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/GetCollection/
git commit -m "feat(content): GET /api/v1/collections/ and /api/v1/collections/{slug}/"
```

---

## Task 19: Admin Topic CRUD

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/CreateTopicRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTopicRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/TopicAdminResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateTopic/CreateTopicHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateTopic/CreateTopicEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTopic/UpdateTopicHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTopic/UpdateTopicEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteTopic/DeleteTopicHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteTopic/DeleteTopicEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListTopicsAdmin/ListTopicsAdminHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListTopicsAdmin/ListTopicsAdminEndpoint.cs`

- [ ] **Step 1: HTTP DTOs**

`CreateTopicRequest.cs`:

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record CreateTopicRequest(string Slug, string Label, string Tone, int SortOrder);
```

`UpdateTopicRequest.cs`:

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record UpdateTopicRequest(string Label, string Tone, int SortOrder);
```

`TopicAdminResponse.cs`:

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record TopicAdminResponse(
    Guid Id, string Slug, string Label, string Tone, int SortOrder, int TaskUsageCount);
```

- [ ] **Step 2: Create handler**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.CreateTopic;

internal sealed record CreateTopicCommand(string Slug, string Label, string Tone, int SortOrder);

internal sealed class CreateTopicHandler(ContentDbContext db)
{
    public async Task<Result<Topic, Error>> HandleAsync(
        CreateTopicCommand command,
        CancellationToken cancellationToken)
    {
        if (!EnumParsing.TryParseIconTone(command.Tone, out IconTone tone))
        {
            return Error.Validation("tone", $"Unknown tone '{command.Tone}'.");
        }

        bool slugTaken = await db.Topics
            .AsNoTracking()
            .AnyAsync(t => t.Slug == command.Slug, cancellationToken)
            .ConfigureAwait(false);

        if (slugTaken)
        {
            return Error.Conflict("Topic", $"Slug '{command.Slug}' is already in use.");
        }

        Result<Topic, Error> topicResult = Topic.Create(command.Slug, command.Label, tone, command.SortOrder);
        if (topicResult.IsFailure)
        {
            return topicResult.Error;
        }

        await db.Topics.AddAsync(topicResult.Value, cancellationToken).ConfigureAwait(false);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return topicResult.Value;
    }
}
```

- [ ] **Step 3: Create endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.CreateTopic;

internal static class CreateTopicEndpoint
{
    public static IEndpointRouteBuilder MapCreateTopic(this IEndpointRouteBuilder group)
    {
        group.MapPost("/", HandleAsync)
            .WithName("AdminCreateTopic")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Created<TopicAdminResponse>, Conflict<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        CreateTopicRequest request,
        CreateTopicHandler handler,
        CancellationToken cancellationToken)
    {
        Result<Topic, Error> result = await handler
            .HandleAsync(new CreateTopicCommand(request.Slug, request.Label, request.Tone, request.SortOrder), cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            return result.Error.Code.Contains("Conflict", StringComparison.Ordinal)
                ? TypedResults.Conflict(payload)
                : TypedResults.BadRequest(payload);
        }

        Topic t = result.Value;
        return TypedResults.Created(
            $"/api/admin/topics/{t.Slug}/",
            new TopicAdminResponse(t.Id, t.Slug, t.Label, EnumParsing.ToSlug(t.Tone), t.SortOrder, TaskUsageCount: 0));
    }
}
```

- [ ] **Step 4: Update handler + endpoint**

`UpdateTopicHandler.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.UpdateTopic;

internal sealed record UpdateTopicCommand(string Slug, string Label, string Tone, int SortOrder);

internal sealed class UpdateTopicHandler(ContentDbContext db)
{
    public async Task<Result<Topic, Error>> HandleAsync(
        UpdateTopicCommand command,
        CancellationToken cancellationToken)
    {
        if (!EnumParsing.TryParseIconTone(command.Tone, out IconTone tone))
        {
            return Error.Validation("tone", $"Unknown tone '{command.Tone}'.");
        }

        Topic? topic = await db.Topics
            .FirstOrDefaultAsync(t => t.Slug == command.Slug, cancellationToken)
            .ConfigureAwait(false);

        if (topic is null)
        {
            return Error.NotFound("Topic", command.Slug);
        }

        Result<Unit, Error> rename = topic.Rename(command.Label, tone, command.SortOrder);
        if (rename.IsFailure)
        {
            return rename.Error;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return topic;
    }
}
```

`UpdateTopicEndpoint.cs`:

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.UpdateTopic;

internal static class UpdateTopicEndpoint
{
    public static IEndpointRouteBuilder MapUpdateTopic(this IEndpointRouteBuilder group)
    {
        group.MapPut("/{slug}/", HandleAsync)
            .WithName("AdminUpdateTopic")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Ok<TopicAdminResponse>, NotFound<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        string slug,
        UpdateTopicRequest request,
        UpdateTopicHandler handler,
        CancellationToken cancellationToken)
    {
        Result<Topic, Error> result = await handler
            .HandleAsync(new UpdateTopicCommand(slug, request.Label, request.Tone, request.SortOrder), cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            return result.Error.Code.Contains("NotFound", StringComparison.Ordinal)
                ? TypedResults.NotFound(payload)
                : TypedResults.BadRequest(payload);
        }

        Topic t = result.Value;
        return TypedResults.Ok(new TopicAdminResponse(
            t.Id, t.Slug, t.Label, EnumParsing.ToSlug(t.Tone), t.SortOrder, TaskUsageCount: 0));
    }
}
```

- [ ] **Step 5: Delete handler + endpoint**

`DeleteTopicHandler.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.DeleteTopic;

internal sealed class DeleteTopicHandler(ContentDbContext db)
{
    public async Task<Result<Unit, Error>> HandleAsync(string slug, CancellationToken cancellationToken)
    {
        var topic = await db.Topics.FirstOrDefaultAsync(t => t.Slug == slug, cancellationToken)
            .ConfigureAwait(false);

        if (topic is null)
        {
            return Error.NotFound("Topic", slug);
        }

        bool inUse = await db.TaskTopics
            .AsNoTracking()
            .AnyAsync(link => link.TopicId == topic.Id, cancellationToken)
            .ConfigureAwait(false);

        if (inUse)
        {
            return Error.Conflict("Topic", $"Topic '{slug}' is referenced by tasks; remove the links first.");
        }

        db.Topics.Remove(topic);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Unit.Value;
    }
}
```

`DeleteTopicEndpoint.cs`:

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.DeleteTopic;

internal static class DeleteTopicEndpoint
{
    public static IEndpointRouteBuilder MapDeleteTopic(this IEndpointRouteBuilder group)
    {
        group.MapDelete("/{slug}/", HandleAsync)
            .WithName("AdminDeleteTopic")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<NoContent, NotFound<ErrorPayload>, Conflict<ErrorPayload>>> HandleAsync(
        string slug,
        DeleteTopicHandler handler,
        CancellationToken cancellationToken)
    {
        Result<Unit, Error> result = await handler.HandleAsync(slug, cancellationToken).ConfigureAwait(false);
        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            return result.Error.Code.Contains("Conflict", StringComparison.Ordinal)
                ? TypedResults.Conflict(payload)
                : TypedResults.NotFound(payload);
        }
        return TypedResults.NoContent();
    }
}
```

- [ ] **Step 6: List admin handler + endpoint**

`ListTopicsAdminHandler.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.ListTopicsAdmin;

internal sealed record TopicAdminRow(
    Guid Id, string Slug, string Label, IconTone Tone, int SortOrder, int TaskUsageCount);

internal sealed class ListTopicsAdminHandler(ContentDbContext db)
{
    public async Task<IReadOnlyList<TopicAdminRow>> HandleAsync(CancellationToken cancellationToken)
    {
        var rows = await db.Topics
            .AsNoTracking()
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Label)
            .Select(t => new TopicAdminRow(
                t.Id, t.Slug, t.Label, t.Tone, t.SortOrder,
                db.TaskTopics.Count(link => link.TopicId == t.Id)))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return rows;
    }
}
```

`ListTopicsAdminEndpoint.cs`:

```csharp
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.ListTopicsAdmin;

internal static class ListTopicsAdminEndpoint
{
    public static IEndpointRouteBuilder MapListTopicsAdmin(this IEndpointRouteBuilder group)
    {
        group.MapGet("/", HandleAsync)
            .WithName("AdminListTopics")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Ok<IReadOnlyList<TopicAdminResponse>>> HandleAsync(
        ListTopicsAdminHandler handler,
        CancellationToken cancellationToken)
    {
        var rows = await handler.HandleAsync(cancellationToken).ConfigureAwait(false);
        IReadOnlyList<TopicAdminResponse> items = rows
            .Select(r => new TopicAdminResponse(
                r.Id, r.Slug, r.Label, EnumParsing.ToSlug(r.Tone), r.SortOrder, r.TaskUsageCount))
            .ToList();
        return TypedResults.Ok(items);
    }
}
```

- [ ] **Step 7: Build + commit**

```
dotnet build backend/ArenaApi -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/CreateTopicRequest.cs \
        backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTopicRequest.cs \
        backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/TopicAdminResponse.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateTopic/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTopic/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteTopic/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListTopicsAdmin/
git commit -m "feat(content): admin CRUD for topics"
```

---

## Task 20: Admin `CreateContentTask`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/CreateContentTaskRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/TaskAdminResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/TaskAssetAdminResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/TaskUnitTestAdminResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateContentTask/CreateContentTaskHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateContentTask/CreateContentTaskEndpoint.cs`

- [ ] **Step 1: Contracts**

`CreateContentTaskRequest.cs`:

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record CreateContentTaskRequest(
    string Slug,
    string Title,
    string ShortDescription,
    string Language,
    string Difficulty,
    string Format);
```

`TaskAssetAdminResponse.cs`:

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record TaskAssetAdminResponse(
    Guid Id, string Kind, int Ordinal, string Content, string? MetadataJson);
```

`TaskUnitTestAdminResponse.cs`:

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record TaskUnitTestAdminResponse(
    Guid Id, string Filename, string Content, bool IsHidden, int Ordinal);
```

`TaskAdminResponse.cs`:

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record TaskAdminResponse(
    Guid Id,
    string Slug,
    string Title,
    string ShortDescription,
    string LongDescription,
    string Language,
    string Difficulty,
    string Format,
    string TestFormat,
    short XpReward,
    short EstimatedMinutes,
    string IconGlyph,
    string IconTone,
    string Status,
    DateTimeOffset? PublishedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<string> Topics,
    IReadOnlyList<TaskAssetAdminResponse> Assets,
    IReadOnlyList<TaskUnitTestAdminResponse> UnitTests);
```

- [ ] **Step 2: Handler**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using ArenaApi.Core.Shared.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.CreateContentTask;

internal sealed record CreateContentTaskCommand(
    string Slug, string Title, string ShortDescription,
    string Language, string Difficulty, string Format);

internal sealed class CreateContentTaskHandler(ContentDbContext db, IClock clock)
{
    public async Task<Result<ContentTask, Error>> HandleAsync(
        CreateContentTaskCommand command,
        CancellationToken cancellationToken)
    {
        if (!EnumParsing.TryParseDifficulty(command.Difficulty, out Difficulty difficulty))
        {
            return Error.Validation("difficulty", $"Unknown difficulty '{command.Difficulty}'.");
        }

        if (!EnumParsing.TryParseFormat(command.Format, out TaskFormat format))
        {
            return Error.Validation("format", $"Unknown format '{command.Format}'.");
        }

        bool slugTaken = await db.ContentTasks
            .AsNoTracking()
            .AnyAsync(t => t.Slug == command.Slug, cancellationToken)
            .ConfigureAwait(false);
        if (slugTaken)
        {
            return Error.Conflict("ContentTask", $"Slug '{command.Slug}' is already in use.");
        }

        Result<ContentTask, Error> taskResult = ContentTask.Create(
            command.Slug, command.Title, command.ShortDescription,
            command.Language, difficulty, format, clock.UtcNow);
        if (taskResult.IsFailure)
        {
            return taskResult.Error;
        }

        await db.ContentTasks.AddAsync(taskResult.Value, cancellationToken).ConfigureAwait(false);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return taskResult.Value;
    }
}
```

- [ ] **Step 3: Endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.CreateContentTask;

internal static class CreateContentTaskEndpoint
{
    public static IEndpointRouteBuilder MapCreateContentTask(this IEndpointRouteBuilder group)
    {
        group.MapPost("/", HandleAsync)
            .WithName("AdminCreateContentTask")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Created<TaskAdminResponse>, Conflict<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        CreateContentTaskRequest request,
        CreateContentTaskHandler handler,
        CancellationToken cancellationToken)
    {
        Result<ContentTask, Error> result = await handler
            .HandleAsync(new CreateContentTaskCommand(
                request.Slug, request.Title, request.ShortDescription,
                request.Language, request.Difficulty, request.Format), cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            return result.Error.Code.Contains("Conflict", StringComparison.Ordinal)
                ? TypedResults.Conflict(payload)
                : TypedResults.BadRequest(payload);
        }

        ContentTask t = result.Value;
        TaskAdminResponse body = AdminMapping.ToResponse(t, Array.Empty<string>());
        return TypedResults.Created($"/api/admin/tasks/{t.Slug}/", body);
    }
}

internal static class AdminMapping
{
    public static TaskAdminResponse ToResponse(ContentTask task, IReadOnlyList<string> topicSlugs) => new(
        task.Id,
        task.Slug,
        task.Title,
        task.ShortDescription,
        task.LongDescription,
        task.Language,
        EnumParsing.ToSlug(task.Difficulty),
        EnumParsing.ToSlug(task.Format),
        task.TestFormat switch { TestFormat.UnitTest => "unit-test", _ => "unit-test" },
        task.XpReward,
        task.EstimatedMinutes,
        task.IconGlyph,
        EnumParsing.ToSlug(task.IconTone),
        task.Status switch
        {
            ContentTaskStatus.Draft => "draft",
            ContentTaskStatus.Published => "published",
            ContentTaskStatus.Archived => "archived",
            _ => "draft",
        },
        task.PublishedAt,
        task.CreatedAt,
        task.UpdatedAt,
        topicSlugs,
        task.Assets.OrderBy(a => a.Kind).ThenBy(a => a.Ordinal).Select(a => new TaskAssetAdminResponse(
            a.Id,
            a.Kind switch
            {
                AssetKind.Starter => "starter",
                AssetKind.Example => "example",
                AssetKind.Constraint => "constraint",
                AssetKind.Hint => "hint",
                _ => "starter",
            },
            a.Ordinal, a.Content, a.MetadataJson)).ToList(),
        task.UnitTests.OrderBy(u => u.Ordinal).Select(u => new TaskUnitTestAdminResponse(
            u.Id, u.Filename, u.Content, u.IsHidden, u.Ordinal)).ToList());
}
```

- [ ] **Step 4: Build + commit**

```
dotnet build backend/ArenaApi -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateContentTask/
git commit -m "feat(content): admin POST /api/admin/tasks/ — create draft task"
```

---

## Task 21: Admin `UpdateTaskMetadata`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTaskMetadataRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskMetadata/UpdateTaskMetadataHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskMetadata/UpdateTaskMetadataEndpoint.cs`

- [ ] **Step 1: Contract**

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record UpdateTaskMetadataRequest(
    string Title,
    string ShortDescription,
    string LongDescription,
    string Difficulty,
    string Format,
    short XpReward,
    short EstimatedMinutes,
    string IconGlyph,
    string IconTone,
    IReadOnlyList<string> TopicSlugs);
```

- [ ] **Step 2: Handler**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using ArenaApi.Core.Shared.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.UpdateTaskMetadata;

internal sealed record UpdateTaskMetadataCommand(
    string Slug,
    string Title, string ShortDescription, string LongDescription,
    string Difficulty, string Format,
    short XpReward, short EstimatedMinutes,
    string IconGlyph, string IconTone,
    IReadOnlyList<string> TopicSlugs);

internal sealed class UpdateTaskMetadataHandler(ContentDbContext db, IClock clock)
{
    public async Task<Result<(ContentTask Task, IReadOnlyList<string> Topics), Error>> HandleAsync(
        UpdateTaskMetadataCommand command,
        CancellationToken cancellationToken)
    {
        if (!EnumParsing.TryParseDifficulty(command.Difficulty, out Difficulty difficulty))
        {
            return Error.Validation("difficulty", $"Unknown difficulty '{command.Difficulty}'.");
        }

        if (!EnumParsing.TryParseFormat(command.Format, out TaskFormat format))
        {
            return Error.Validation("format", $"Unknown format '{command.Format}'.");
        }

        if (!EnumParsing.TryParseIconTone(command.IconTone, out IconTone iconTone))
        {
            return Error.Validation("iconTone", $"Unknown tone '{command.IconTone}'.");
        }

        ContentTask? task = await db.ContentTasks
            .Include(t => t.TopicLinks)
            .FirstOrDefaultAsync(t => t.Slug == command.Slug, cancellationToken)
            .ConfigureAwait(false);

        if (task is null)
        {
            return Error.NotFound("ContentTask", command.Slug);
        }

        Result<Unit, Error> updateResult = task.UpdateMetadata(
            command.Title, command.ShortDescription, command.LongDescription,
            difficulty, format,
            command.XpReward, command.EstimatedMinutes,
            command.IconGlyph, iconTone,
            clock.UtcNow);
        if (updateResult.IsFailure)
        {
            return updateResult.Error;
        }

        List<Topic> topics = await db.Topics
            .Where(t => command.TopicSlugs.Contains(t.Slug))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (topics.Count != command.TopicSlugs.Count)
        {
            string missing = string.Join(", ",
                command.TopicSlugs.Except(topics.Select(t => t.Slug)));
            return Error.Validation("topicSlugs", $"Unknown topics: {missing}.");
        }

        task.SetTopics(topics.Select(t => t.Id).ToList());

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return (task, (IReadOnlyList<string>)topics.Select(t => t.Slug).ToList());
    }
}
```

- [ ] **Step 3: Endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateContentTask;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.UpdateTaskMetadata;

internal static class UpdateTaskMetadataEndpoint
{
    public static IEndpointRouteBuilder MapUpdateTaskMetadata(this IEndpointRouteBuilder group)
    {
        group.MapPut("/{slug}/metadata/", HandleAsync)
            .WithName("AdminUpdateTaskMetadata")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Ok<TaskAdminResponse>, NotFound<ErrorPayload>, BadRequest<ErrorPayload>, Conflict<ErrorPayload>>> HandleAsync(
        string slug,
        UpdateTaskMetadataRequest request,
        UpdateTaskMetadataHandler handler,
        CancellationToken cancellationToken)
    {
        Result<(ContentTask Task, IReadOnlyList<string> Topics), Error> result = await handler
            .HandleAsync(new UpdateTaskMetadataCommand(
                slug, request.Title, request.ShortDescription, request.LongDescription,
                request.Difficulty, request.Format, request.XpReward, request.EstimatedMinutes,
                request.IconGlyph, request.IconTone, request.TopicSlugs), cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            if (result.Error.Code.Contains("NotFound", StringComparison.Ordinal))
            {
                return TypedResults.NotFound(payload);
            }
            if (result.Error.Code.Contains("Conflict", StringComparison.Ordinal))
            {
                return TypedResults.Conflict(payload);
            }
            return TypedResults.BadRequest(payload);
        }

        var (task, topics) = result.Value;
        return TypedResults.Ok(AdminMapping.ToResponse(task, topics));
    }
}
```

- [ ] **Step 4: Build + commit**

```
dotnet build backend/ArenaApi -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTaskMetadataRequest.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskMetadata/
git commit -m "feat(content): admin PUT /api/admin/tasks/{slug}/metadata/"
```

---

## Task 22: Admin `UpdateTaskAssets`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTaskAssetsRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskAssets/UpdateTaskAssetsHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskAssets/UpdateTaskAssetsEndpoint.cs`

- [ ] **Step 1: Contract**

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record UpdateTaskAssetsRequest(IReadOnlyList<TaskAssetInputDto> Assets);

public sealed record TaskAssetInputDto(string Kind, int Ordinal, string Content, string? MetadataJson);
```

- [ ] **Step 2: Handler**

```csharp
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using ArenaApi.Core.Shared.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.UpdateTaskAssets;

internal sealed class UpdateTaskAssetsHandler(ContentDbContext db, IClock clock)
{
    public async Task<Result<ContentTask, Error>> HandleAsync(
        string slug,
        IReadOnlyList<TaskAssetInputDto> assetsInput,
        CancellationToken cancellationToken)
    {
        ContentTask? task = await db.ContentTasks
            .Include(t => t.Assets)
            .FirstOrDefaultAsync(t => t.Slug == slug, cancellationToken)
            .ConfigureAwait(false);

        if (task is null)
        {
            return Error.NotFound("ContentTask", slug);
        }

        if (task.Status == ContentTaskStatus.Published)
        {
            return Error.Conflict("ContentTask",
                "Cannot modify assets while task is Published. Archive first.");
        }

        var converted = new List<TaskAssetInput>(assetsInput.Count);
        foreach (TaskAssetInputDto dto in assetsInput)
        {
            AssetKind kind = dto.Kind switch
            {
                "starter" => AssetKind.Starter,
                "example" => AssetKind.Example,
                "constraint" => AssetKind.Constraint,
                "hint" => AssetKind.Hint,
                _ => AssetKind.Starter,
            };

            // Validate enum slug actually known
            if (dto.Kind is not ("starter" or "example" or "constraint" or "hint"))
            {
                return Error.Validation("kind", $"Unknown asset kind '{dto.Kind}'.");
            }

            converted.Add(new TaskAssetInput(kind, dto.Ordinal, dto.Content, dto.MetadataJson));
        }

        task.ReplaceAssets(converted);
        task.RefreshUpdatedAt(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return task;
    }
}
```

- [ ] **Step 3: Endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateContentTask;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using ArenaApi.Core.Modules.Content.Infrastructure;

namespace ArenaApi.Core.Modules.Content.Features.Admin.UpdateTaskAssets;

internal static class UpdateTaskAssetsEndpoint
{
    public static IEndpointRouteBuilder MapUpdateTaskAssets(this IEndpointRouteBuilder group)
    {
        group.MapPut("/{slug}/assets/", HandleAsync)
            .WithName("AdminUpdateTaskAssets")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Ok<TaskAdminResponse>, NotFound<ErrorPayload>, Conflict<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        string slug,
        UpdateTaskAssetsRequest request,
        UpdateTaskAssetsHandler handler,
        ContentDbContext db,
        CancellationToken cancellationToken)
    {
        Result<ContentTask, Error> result = await handler
            .HandleAsync(slug, request.Assets, cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            if (result.Error.Code.Contains("NotFound", StringComparison.Ordinal))
            {
                return TypedResults.NotFound(payload);
            }
            if (result.Error.Code.Contains("Conflict", StringComparison.Ordinal))
            {
                return TypedResults.Conflict(payload);
            }
            return TypedResults.BadRequest(payload);
        }

        ContentTask t = result.Value;
        List<string> topicSlugs = await db.Topics
            .Where(topic => t.TopicLinks.Select(link => link.TopicId).Contains(topic.Id))
            .Select(topic => topic.Slug)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return TypedResults.Ok(AdminMapping.ToResponse(t, topicSlugs));
    }
}
```

- [ ] **Step 4: Build + commit**

```
dotnet build backend/ArenaApi -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTaskAssetsRequest.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskAssets/
git commit -m "feat(content): admin PUT /api/admin/tasks/{slug}/assets/ (bulk replace)"
```

---

## Task 23: Admin `UpdateTaskUnitTests`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTaskUnitTestsRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskUnitTests/UpdateTaskUnitTestsHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskUnitTests/UpdateTaskUnitTestsEndpoint.cs`

- [ ] **Step 1: Contract**

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record UpdateTaskUnitTestsRequest(IReadOnlyList<TaskUnitTestInputDto> Tests);

public sealed record TaskUnitTestInputDto(string Filename, string Content, bool IsHidden, int Ordinal);
```

- [ ] **Step 2: Handler**

```csharp
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using ArenaApi.Core.Shared.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.UpdateTaskUnitTests;

internal sealed class UpdateTaskUnitTestsHandler(ContentDbContext db, IClock clock)
{
    public async Task<Result<ContentTask, Error>> HandleAsync(
        string slug,
        IReadOnlyList<TaskUnitTestInputDto> testsInput,
        CancellationToken cancellationToken)
    {
        ContentTask? task = await db.ContentTasks
            .Include(t => t.UnitTests)
            .FirstOrDefaultAsync(t => t.Slug == slug, cancellationToken)
            .ConfigureAwait(false);

        if (task is null)
        {
            return Error.NotFound("ContentTask", slug);
        }

        if (task.Status == ContentTaskStatus.Published)
        {
            return Error.Conflict("ContentTask",
                "Cannot modify unit tests while task is Published. Archive first.");
        }

        foreach (TaskUnitTestInputDto dto in testsInput)
        {
            if (string.IsNullOrWhiteSpace(dto.Filename))
            {
                return Error.Validation("filename", "Unit test filename must not be empty.");
            }
            if (dto.Filename.Length > 128)
            {
                return Error.Validation("filename", "Unit test filename is too long (>128).");
            }
        }

        var converted = testsInput
            .Select(t => new TaskUnitTestInput(t.Filename, t.Content, t.IsHidden, t.Ordinal))
            .ToList();

        task.ReplaceUnitTests(converted);
        task.RefreshUpdatedAt(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return task;
    }
}
```

- [ ] **Step 3: Endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateContentTask;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.UpdateTaskUnitTests;

internal static class UpdateTaskUnitTestsEndpoint
{
    public static IEndpointRouteBuilder MapUpdateTaskUnitTests(this IEndpointRouteBuilder group)
    {
        group.MapPut("/{slug}/tests/", HandleAsync)
            .WithName("AdminUpdateTaskUnitTests")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Ok<TaskAdminResponse>, NotFound<ErrorPayload>, Conflict<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        string slug,
        UpdateTaskUnitTestsRequest request,
        UpdateTaskUnitTestsHandler handler,
        ContentDbContext db,
        CancellationToken cancellationToken)
    {
        Result<ContentTask, Error> result = await handler
            .HandleAsync(slug, request.Tests, cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            if (result.Error.Code.Contains("NotFound", StringComparison.Ordinal))
            {
                return TypedResults.NotFound(payload);
            }
            if (result.Error.Code.Contains("Conflict", StringComparison.Ordinal))
            {
                return TypedResults.Conflict(payload);
            }
            return TypedResults.BadRequest(payload);
        }

        ContentTask t = result.Value;
        List<string> topicSlugs = await db.Topics
            .Where(topic => t.TopicLinks.Select(link => link.TopicId).Contains(topic.Id))
            .Select(topic => topic.Slug)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return TypedResults.Ok(AdminMapping.ToResponse(t, topicSlugs));
    }
}
```

- [ ] **Step 4: Build + commit**

```
dotnet build backend/ArenaApi -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateTaskUnitTestsRequest.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateTaskUnitTests/
git commit -m "feat(content): admin PUT /api/admin/tasks/{slug}/tests/ (bulk replace)"
```

---

## Task 24: Admin `PublishTask`, `ArchiveTask`, `DeleteTask`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/PublishTask/PublishTaskHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/PublishTask/PublishTaskEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ArchiveTask/ArchiveTaskHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ArchiveTask/ArchiveTaskEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteTask/DeleteTaskHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteTask/DeleteTaskEndpoint.cs`

- [ ] **Step 1: PublishTask handler**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Modules.Content.Public.IntegrationEvents;
using ArenaApi.Core.Shared.Errors;
using ArenaApi.Core.Shared.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.PublishTask;

internal sealed class PublishTaskHandler(
    ContentDbContext db,
    ContentOutboxService outbox,
    IClock clock)
{
    public async Task<Result<ContentTask, Error>> HandleAsync(
        string slug,
        CancellationToken cancellationToken)
    {
        ContentTask? task = await db.ContentTasks
            .Include(t => t.Assets)
            .Include(t => t.UnitTests)
            .Include(t => t.TopicLinks)
            .FirstOrDefaultAsync(t => t.Slug == slug, cancellationToken)
            .ConfigureAwait(false);

        if (task is null)
        {
            return Error.NotFound("ContentTask", slug);
        }

        Result<Unit, Error> publishResult = task.Publish(clock.UtcNow);
        if (publishResult.IsFailure)
        {
            return publishResult.Error;
        }

        await outbox.PublishAsync(
            new ContentTaskPublished(task.Id, task.Slug, task.Title, task.PublishedAt!.Value),
            cancellationToken).ConfigureAwait(false);

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return task;
    }
}
```

- [ ] **Step 2: PublishTask endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateContentTask;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.PublishTask;

internal static class PublishTaskEndpoint
{
    public static IEndpointRouteBuilder MapPublishTask(this IEndpointRouteBuilder group)
    {
        group.MapPost("/{slug}/publish/", HandleAsync)
            .WithName("AdminPublishTask")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Ok<TaskAdminResponse>, NotFound<ErrorPayload>, BadRequest<ErrorPayload>, Conflict<ErrorPayload>>> HandleAsync(
        string slug,
        PublishTaskHandler handler,
        ContentDbContext db,
        CancellationToken cancellationToken)
    {
        Result<ContentTask, Error> result = await handler.HandleAsync(slug, cancellationToken).ConfigureAwait(false);

        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            if (result.Error.Code.Contains("NotFound", StringComparison.Ordinal))
            {
                return TypedResults.NotFound(payload);
            }
            if (result.Error.Code.Contains("Conflict", StringComparison.Ordinal))
            {
                return TypedResults.Conflict(payload);
            }
            return TypedResults.BadRequest(payload);
        }

        ContentTask t = result.Value;
        List<string> topicSlugs = await db.Topics
            .Where(topic => t.TopicLinks.Select(link => link.TopicId).Contains(topic.Id))
            .Select(topic => topic.Slug)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return TypedResults.Ok(AdminMapping.ToResponse(t, topicSlugs));
    }
}
```

- [ ] **Step 3: ArchiveTask handler**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.ArchiveTask;

internal sealed class ArchiveTaskHandler(ContentDbContext db)
{
    public async Task<Result<ContentTask, Error>> HandleAsync(
        string slug,
        CancellationToken cancellationToken)
    {
        ContentTask? task = await db.ContentTasks
            .FirstOrDefaultAsync(t => t.Slug == slug, cancellationToken)
            .ConfigureAwait(false);
        if (task is null)
        {
            return Error.NotFound("ContentTask", slug);
        }

        Result<Unit, Error> archiveResult = task.Archive();
        if (archiveResult.IsFailure)
        {
            return archiveResult.Error;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return task;
    }
}
```

- [ ] **Step 4: ArchiveTask endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateContentTask;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.ArchiveTask;

internal static class ArchiveTaskEndpoint
{
    public static IEndpointRouteBuilder MapArchiveTask(this IEndpointRouteBuilder group)
    {
        group.MapPost("/{slug}/archive/", HandleAsync)
            .WithName("AdminArchiveTask")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Ok<TaskAdminResponse>, NotFound<ErrorPayload>, Conflict<ErrorPayload>>> HandleAsync(
        string slug,
        ArchiveTaskHandler handler,
        ContentDbContext db,
        CancellationToken cancellationToken)
    {
        Result<ContentTask, Error> result = await handler.HandleAsync(slug, cancellationToken).ConfigureAwait(false);
        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            return result.Error.Code.Contains("NotFound", StringComparison.Ordinal)
                ? TypedResults.NotFound(payload)
                : TypedResults.Conflict(payload);
        }

        ContentTask t = result.Value;
        List<string> topicSlugs = await db.Topics
            .Where(topic => t.TopicLinks.Select(link => link.TopicId).Contains(topic.Id))
            .Select(topic => topic.Slug)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return TypedResults.Ok(AdminMapping.ToResponse(t, topicSlugs));
    }
}
```

- [ ] **Step 5: DeleteTask handler**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.DeleteTask;

internal sealed class DeleteTaskHandler(ContentDbContext db)
{
    public async Task<Result<Unit, Error>> HandleAsync(string slug, CancellationToken cancellationToken)
    {
        ContentTask? task = await db.ContentTasks
            .FirstOrDefaultAsync(t => t.Slug == slug, cancellationToken)
            .ConfigureAwait(false);

        if (task is null)
        {
            return Error.NotFound("ContentTask", slug);
        }

        if (task.Status != ContentTaskStatus.Draft)
        {
            return Error.Conflict("ContentTask",
                "Only Draft tasks can be hard-deleted. Archive published tasks instead.");
        }

        db.ContentTasks.Remove(task);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Unit.Value;
    }
}
```

- [ ] **Step 6: DeleteTask endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.DeleteTask;

internal static class DeleteTaskEndpoint
{
    public static IEndpointRouteBuilder MapDeleteTask(this IEndpointRouteBuilder group)
    {
        group.MapDelete("/{slug}/", HandleAsync)
            .WithName("AdminDeleteTask")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<NoContent, NotFound<ErrorPayload>, Conflict<ErrorPayload>>> HandleAsync(
        string slug,
        DeleteTaskHandler handler,
        CancellationToken cancellationToken)
    {
        Result<Unit, Error> result = await handler.HandleAsync(slug, cancellationToken).ConfigureAwait(false);
        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            return result.Error.Code.Contains("Conflict", StringComparison.Ordinal)
                ? TypedResults.Conflict(payload)
                : TypedResults.NotFound(payload);
        }
        return TypedResults.NoContent();
    }
}
```

- [ ] **Step 7: Build + commit**

```
dotnet build backend/ArenaApi -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/PublishTask/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ArchiveTask/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteTask/
git commit -m "feat(content): admin publish/archive/delete task endpoints"
```

---

## Task 25: Admin `ListTasksAdmin` + `GetTaskAdmin`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListTasksAdmin/ListTasksAdminHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListTasksAdmin/ListTasksAdminEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/GetTaskAdmin/GetTaskAdminHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/GetTaskAdmin/GetTaskAdminEndpoint.cs`

- [ ] **Step 1: List handler**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Modules.Content.Public;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.ListTasksAdmin;

internal sealed record TaskAdminListRow(
    Guid Id, string Slug, string Title,
    ContentTaskStatus Status, Difficulty Difficulty, TaskFormat Format,
    DateTimeOffset? PublishedAt, DateTimeOffset UpdatedAt);

internal sealed class ListTasksAdminHandler(ContentDbContext db)
{
    public async Task<PagedResult<TaskAdminListRow>> HandleAsync(
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        IQueryable<ContentTask> q = db.ContentTasks.AsNoTracking();

        if (status is { Length: > 0 })
        {
            ContentTaskStatus? parsed = status switch
            {
                "draft" => ContentTaskStatus.Draft,
                "published" => ContentTaskStatus.Published,
                "archived" => ContentTaskStatus.Archived,
                _ => null,
            };
            if (parsed is null)
            {
                return new PagedResult<TaskAdminListRow>(Array.Empty<TaskAdminListRow>(), 0, page, pageSize);
            }
            q = q.Where(t => t.Status == parsed.Value);
        }

        int total = await q.CountAsync(cancellationToken).ConfigureAwait(false);

        int p = Math.Max(1, page);
        int s = Math.Clamp(pageSize, 1, 100);

        List<TaskAdminListRow> rows = await q
            .OrderByDescending(t => t.UpdatedAt)
            .Skip((p - 1) * s)
            .Take(s)
            .Select(t => new TaskAdminListRow(
                t.Id, t.Slug, t.Title,
                t.Status, t.Difficulty, t.Format,
                t.PublishedAt, t.UpdatedAt))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new PagedResult<TaskAdminListRow>(rows, total, p, s);
    }
}
```

- [ ] **Step 2: List endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Public;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.ListTasksAdmin;

internal static class ListTasksAdminEndpoint
{
    public static IEndpointRouteBuilder MapListTasksAdmin(this IEndpointRouteBuilder group)
    {
        group.MapGet("/", HandleAsync)
            .WithName("AdminListTasks")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Ok<PagedResponse<TaskAdminRowResponse>>> HandleAsync(
        ListTasksAdminHandler handler,
        CancellationToken cancellationToken,
        string? status = null,
        int page = 1,
        int size = 50)
    {
        PagedResult<TaskAdminListRow> result =
            await handler.HandleAsync(status, page, size, cancellationToken).ConfigureAwait(false);

        IReadOnlyList<TaskAdminRowResponse> items = result.Items
            .Select(r => new TaskAdminRowResponse(
                r.Id, r.Slug, r.Title,
                r.Status switch
                {
                    ContentTaskStatus.Draft => "draft",
                    ContentTaskStatus.Published => "published",
                    ContentTaskStatus.Archived => "archived",
                    _ => "draft",
                },
                EnumParsing.ToSlug(r.Difficulty),
                EnumParsing.ToSlug(r.Format),
                r.PublishedAt, r.UpdatedAt))
            .ToList();

        return TypedResults.Ok(new PagedResponse<TaskAdminRowResponse>(items, result.Total, result.Page, result.PageSize));
    }
}

public sealed record TaskAdminRowResponse(
    Guid Id, string Slug, string Title,
    string Status, string Difficulty, string Format,
    DateTimeOffset? PublishedAt, DateTimeOffset UpdatedAt);
```

- [ ] **Step 3: Get handler**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.GetTaskAdmin;

internal sealed class GetTaskAdminHandler(ContentDbContext db)
{
    public async Task<Result<(ContentTask Task, IReadOnlyList<string> Topics), Error>> HandleAsync(
        string slug,
        CancellationToken cancellationToken)
    {
        ContentTask? task = await db.ContentTasks
            .AsNoTracking()
            .Include(t => t.Assets)
            .Include(t => t.UnitTests)
            .Include(t => t.TopicLinks)
            .FirstOrDefaultAsync(t => t.Slug == slug, cancellationToken)
            .ConfigureAwait(false);

        if (task is null)
        {
            return Error.NotFound("ContentTask", slug);
        }

        List<string> topicSlugs = await db.Topics
            .Where(topic => task.TopicLinks.Select(link => link.TopicId).Contains(topic.Id))
            .Select(topic => topic.Slug)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return (task, (IReadOnlyList<string>)topicSlugs);
    }
}
```

- [ ] **Step 4: Get endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateContentTask;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.GetTaskAdmin;

internal static class GetTaskAdminEndpoint
{
    public static IEndpointRouteBuilder MapGetTaskAdmin(this IEndpointRouteBuilder group)
    {
        group.MapGet("/{slug}/", HandleAsync)
            .WithName("AdminGetTask")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Ok<TaskAdminResponse>, NotFound<ErrorPayload>>> HandleAsync(
        string slug,
        GetTaskAdminHandler handler,
        CancellationToken cancellationToken)
    {
        Result<(ContentTask Task, IReadOnlyList<string> Topics), Error> result =
            await handler.HandleAsync(slug, cancellationToken).ConfigureAwait(false);

        if (result.IsFailure)
        {
            return TypedResults.NotFound(new ErrorPayload(result.Error.Code, result.Error.Message));
        }

        var (task, topics) = result.Value;
        return TypedResults.Ok(AdminMapping.ToResponse(task, topics));
    }
}
```

- [ ] **Step 5: Build + commit**

```
dotnet build backend/ArenaApi -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListTasksAdmin/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/GetTaskAdmin/
git commit -m "feat(content): admin list/get task endpoints (all statuses, includes unit tests)"
```

---

## Task 26: Admin Collection CRUD

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/CreateCollectionRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateCollectionRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/CollectionAdminResponse.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateCollection/CreateCollectionHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateCollection/CreateCollectionEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateCollection/UpdateCollectionHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateCollection/UpdateCollectionEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteCollection/DeleteCollectionHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteCollection/DeleteCollectionEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListCollectionsAdmin/ListCollectionsAdminHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListCollectionsAdmin/ListCollectionsAdminEndpoint.cs`

- [ ] **Step 1: Contracts**

`CreateCollectionRequest.cs`:

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record CreateCollectionRequest(
    string Slug, string Title, string? Subtitle,
    string Accent, string IconGlyph, string IconTone, int SortOrder);
```

`UpdateCollectionRequest.cs`:

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record UpdateCollectionRequest(
    string Title, string? Subtitle,
    string Accent, string IconGlyph, string IconTone, int SortOrder);
```

`CollectionAdminResponse.cs`:

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record CollectionAdminResponse(
    Guid Id, string Slug, string Title, string? Subtitle,
    string Accent, string IconGlyph, string IconTone,
    string Status, int SortOrder,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    IReadOnlyList<string> TaskSlugs);
```

- [ ] **Step 2: Create handler + endpoint**

`CreateCollectionHandler.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using ArenaApi.Core.Shared.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.CreateCollection;

internal sealed record CreateCollectionCommand(
    string Slug, string Title, string? Subtitle,
    string Accent, string IconGlyph, string IconTone, int SortOrder);

internal sealed class CreateCollectionHandler(ContentDbContext db, IClock clock)
{
    public async Task<Result<Collection, Error>> HandleAsync(
        CreateCollectionCommand command,
        CancellationToken cancellationToken)
    {
        if (!EnumParsing.TryParseAccent(command.Accent, out CollectionAccent accent))
        {
            return Error.Validation("accent", $"Unknown accent '{command.Accent}'.");
        }
        if (!EnumParsing.TryParseIconTone(command.IconTone, out IconTone tone))
        {
            return Error.Validation("iconTone", $"Unknown tone '{command.IconTone}'.");
        }

        bool slugTaken = await db.Collections
            .AsNoTracking()
            .AnyAsync(c => c.Slug == command.Slug, cancellationToken)
            .ConfigureAwait(false);
        if (slugTaken)
        {
            return Error.Conflict("Collection", $"Slug '{command.Slug}' is already in use.");
        }

        Result<Collection, Error> r = Collection.Create(
            command.Slug, command.Title, command.Subtitle, accent,
            command.IconGlyph, tone, command.SortOrder, clock.UtcNow);
        if (r.IsFailure)
        {
            return r.Error;
        }

        await db.Collections.AddAsync(r.Value, cancellationToken).ConfigureAwait(false);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return r.Value;
    }
}
```

`CreateCollectionEndpoint.cs`:

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.CreateCollection;

internal static class CreateCollectionEndpoint
{
    public static IEndpointRouteBuilder MapCreateCollection(this IEndpointRouteBuilder group)
    {
        group.MapPost("/", HandleAsync)
            .WithName("AdminCreateCollection")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Created<CollectionAdminResponse>, Conflict<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        CreateCollectionRequest request,
        CreateCollectionHandler handler,
        CancellationToken cancellationToken)
    {
        Result<Collection, Error> r = await handler
            .HandleAsync(new CreateCollectionCommand(
                request.Slug, request.Title, request.Subtitle,
                request.Accent, request.IconGlyph, request.IconTone, request.SortOrder),
                cancellationToken)
            .ConfigureAwait(false);

        if (r.IsFailure)
        {
            ErrorPayload payload = new(r.Error.Code, r.Error.Message);
            return r.Error.Code.Contains("Conflict", StringComparison.Ordinal)
                ? TypedResults.Conflict(payload)
                : TypedResults.BadRequest(payload);
        }

        Collection c = r.Value;
        return TypedResults.Created($"/api/admin/collections/{c.Slug}/", CollectionAdminMapping.ToResponse(c));
    }
}

internal static class CollectionAdminMapping
{
    public static CollectionAdminResponse ToResponse(Collection c) => new(
        c.Id, c.Slug, c.Title, c.Subtitle,
        EnumParsing.ToSlug(c.Accent), c.IconGlyph, EnumParsing.ToSlug(c.IconTone),
        c.Status switch
        {
            CollectionStatus.Draft => "draft",
            CollectionStatus.Published => "published",
            CollectionStatus.Archived => "archived",
            _ => "draft",
        },
        c.SortOrder,
        c.CreatedAt, c.UpdatedAt,
        c.Tasks.OrderBy(t => t.Ordinal).Select(t => t.TaskId.ToString()).ToList());
}
```

- [ ] **Step 3: Update handler + endpoint**

`UpdateCollectionHandler.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.UpdateCollection;

internal sealed record UpdateCollectionCommand(
    string Slug, string Title, string? Subtitle,
    string Accent, string IconGlyph, string IconTone, int SortOrder);

internal sealed class UpdateCollectionHandler(ContentDbContext db)
{
    public async Task<Result<Collection, Error>> HandleAsync(
        UpdateCollectionCommand command,
        CancellationToken cancellationToken)
    {
        if (!EnumParsing.TryParseAccent(command.Accent, out CollectionAccent accent))
        {
            return Error.Validation("accent", $"Unknown accent '{command.Accent}'.");
        }
        if (!EnumParsing.TryParseIconTone(command.IconTone, out IconTone tone))
        {
            return Error.Validation("iconTone", $"Unknown tone '{command.IconTone}'.");
        }

        Collection? c = await db.Collections
            .Include(c => c.Tasks)
            .FirstOrDefaultAsync(c => c.Slug == command.Slug, cancellationToken)
            .ConfigureAwait(false);

        if (c is null)
        {
            return Error.NotFound("Collection", command.Slug);
        }

        Result<Unit, Error> result = c.UpdateMetadata(
            command.Title, command.Subtitle, accent,
            command.IconGlyph, tone, command.SortOrder);
        if (result.IsFailure)
        {
            return result.Error;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return c;
    }
}
```

`UpdateCollectionEndpoint.cs`:

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateCollection;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.UpdateCollection;

internal static class UpdateCollectionEndpoint
{
    public static IEndpointRouteBuilder MapUpdateCollection(this IEndpointRouteBuilder group)
    {
        group.MapPut("/{slug}/", HandleAsync)
            .WithName("AdminUpdateCollection")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Ok<CollectionAdminResponse>, NotFound<ErrorPayload>, Conflict<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        string slug,
        UpdateCollectionRequest request,
        UpdateCollectionHandler handler,
        CancellationToken cancellationToken)
    {
        Result<Collection, Error> r = await handler
            .HandleAsync(new UpdateCollectionCommand(
                slug, request.Title, request.Subtitle,
                request.Accent, request.IconGlyph, request.IconTone, request.SortOrder),
                cancellationToken)
            .ConfigureAwait(false);

        if (r.IsFailure)
        {
            ErrorPayload payload = new(r.Error.Code, r.Error.Message);
            if (r.Error.Code.Contains("NotFound", StringComparison.Ordinal))
            {
                return TypedResults.NotFound(payload);
            }
            if (r.Error.Code.Contains("Conflict", StringComparison.Ordinal))
            {
                return TypedResults.Conflict(payload);
            }
            return TypedResults.BadRequest(payload);
        }

        return TypedResults.Ok(CollectionAdminMapping.ToResponse(r.Value));
    }
}
```

- [ ] **Step 4: Delete handler + endpoint**

`DeleteCollectionHandler.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.DeleteCollection;

internal sealed class DeleteCollectionHandler(ContentDbContext db)
{
    public async Task<Result<Unit, Error>> HandleAsync(string slug, CancellationToken cancellationToken)
    {
        Collection? c = await db.Collections.FirstOrDefaultAsync(x => x.Slug == slug, cancellationToken)
            .ConfigureAwait(false);

        if (c is null)
        {
            return Error.NotFound("Collection", slug);
        }

        if (c.Status != CollectionStatus.Draft)
        {
            return Error.Conflict("Collection",
                "Only Draft collections can be hard-deleted. Archive published ones instead.");
        }

        db.Collections.Remove(c);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Unit.Value;
    }
}
```

`DeleteCollectionEndpoint.cs`:

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.DeleteCollection;

internal static class DeleteCollectionEndpoint
{
    public static IEndpointRouteBuilder MapDeleteCollection(this IEndpointRouteBuilder group)
    {
        group.MapDelete("/{slug}/", HandleAsync)
            .WithName("AdminDeleteCollection")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<NoContent, NotFound<ErrorPayload>, Conflict<ErrorPayload>>> HandleAsync(
        string slug,
        DeleteCollectionHandler handler,
        CancellationToken cancellationToken)
    {
        Result<Unit, Error> result = await handler.HandleAsync(slug, cancellationToken).ConfigureAwait(false);
        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            return result.Error.Code.Contains("Conflict", StringComparison.Ordinal)
                ? TypedResults.Conflict(payload)
                : TypedResults.NotFound(payload);
        }
        return TypedResults.NoContent();
    }
}
```

- [ ] **Step 5: List admin handler + endpoint**

`ListCollectionsAdminHandler.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.ListCollectionsAdmin;

internal sealed class ListCollectionsAdminHandler(ContentDbContext db)
{
    public Task<List<Collection>> HandleAsync(CancellationToken cancellationToken) =>
        db.Collections
            .AsNoTracking()
            .Include(c => c.Tasks)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Title)
            .ToListAsync(cancellationToken);
}
```

`ListCollectionsAdminEndpoint.cs`:

```csharp
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateCollection;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.ListCollectionsAdmin;

internal static class ListCollectionsAdminEndpoint
{
    public static IEndpointRouteBuilder MapListCollectionsAdmin(this IEndpointRouteBuilder group)
    {
        group.MapGet("/", HandleAsync)
            .WithName("AdminListCollections")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Ok<IReadOnlyList<CollectionAdminResponse>>> HandleAsync(
        ListCollectionsAdminHandler handler,
        CancellationToken cancellationToken)
    {
        var rows = await handler.HandleAsync(cancellationToken).ConfigureAwait(false);
        IReadOnlyList<CollectionAdminResponse> items = rows.Select(CollectionAdminMapping.ToResponse).ToList();
        return TypedResults.Ok(items);
    }
}
```

- [ ] **Step 6: Build + commit**

```
dotnet build backend/ArenaApi -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/CreateCollectionRequest.cs \
        backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/UpdateCollectionRequest.cs \
        backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/CollectionAdminResponse.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/CreateCollection/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/UpdateCollection/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/DeleteCollection/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ListCollectionsAdmin/
git commit -m "feat(content): admin CRUD for collections"
```

---

## Task 27: Admin `SetCollectionTasks`, `PublishCollection`, `ArchiveCollection`

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/SetCollectionTasksRequest.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/SetCollectionTasks/SetCollectionTasksHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/SetCollectionTasks/SetCollectionTasksEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/PublishCollection/PublishCollectionHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/PublishCollection/PublishCollectionEndpoint.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ArchiveCollection/ArchiveCollectionHandler.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ArchiveCollection/ArchiveCollectionEndpoint.cs`

- [ ] **Step 1: Contract**

```csharp
namespace ArenaApi.Contracts.Content.Admin;

public sealed record SetCollectionTasksRequest(IReadOnlyList<string> TaskSlugs);
```

- [ ] **Step 2: SetTasks handler**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using ArenaApi.Core.Shared.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.SetCollectionTasks;

internal sealed class SetCollectionTasksHandler(ContentDbContext db, IClock clock)
{
    public async Task<Result<Collection, Error>> HandleAsync(
        string slug,
        IReadOnlyList<string> orderedTaskSlugs,
        CancellationToken cancellationToken)
    {
        Collection? c = await db.Collections
            .Include(c => c.Tasks)
            .FirstOrDefaultAsync(c => c.Slug == slug, cancellationToken)
            .ConfigureAwait(false);

        if (c is null)
        {
            return Error.NotFound("Collection", slug);
        }

        if (c.Status == CollectionStatus.Published)
        {
            return Error.Conflict("Collection",
                "Cannot reorder tasks while collection is Published. Archive first.");
        }

        Dictionary<string, Guid> taskIdsBySlug = await db.ContentTasks
            .Where(t => orderedTaskSlugs.Contains(t.Slug))
            .ToDictionaryAsync(t => t.Slug, t => t.Id, cancellationToken)
            .ConfigureAwait(false);

        if (taskIdsBySlug.Count != orderedTaskSlugs.Distinct().Count())
        {
            string missing = string.Join(", ",
                orderedTaskSlugs.Distinct().Except(taskIdsBySlug.Keys));
            return Error.Validation("taskSlugs", $"Unknown tasks: {missing}.");
        }

        c.SetTasks(orderedTaskSlugs.Select(s => taskIdsBySlug[s]).ToList());
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return c;
    }
}
```

- [ ] **Step 3: SetTasks endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateCollection;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.SetCollectionTasks;

internal static class SetCollectionTasksEndpoint
{
    public static IEndpointRouteBuilder MapSetCollectionTasks(this IEndpointRouteBuilder group)
    {
        group.MapPut("/{slug}/tasks/", HandleAsync)
            .WithName("AdminSetCollectionTasks")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Ok<CollectionAdminResponse>, NotFound<ErrorPayload>, Conflict<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        string slug,
        SetCollectionTasksRequest request,
        SetCollectionTasksHandler handler,
        CancellationToken cancellationToken)
    {
        Result<Collection, Error> r = await handler
            .HandleAsync(slug, request.TaskSlugs, cancellationToken)
            .ConfigureAwait(false);

        if (r.IsFailure)
        {
            ErrorPayload payload = new(r.Error.Code, r.Error.Message);
            if (r.Error.Code.Contains("NotFound", StringComparison.Ordinal))
            {
                return TypedResults.NotFound(payload);
            }
            if (r.Error.Code.Contains("Conflict", StringComparison.Ordinal))
            {
                return TypedResults.Conflict(payload);
            }
            return TypedResults.BadRequest(payload);
        }

        return TypedResults.Ok(CollectionAdminMapping.ToResponse(r.Value));
    }
}
```

- [ ] **Step 4: Publish handler**

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using ArenaApi.Core.Shared.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.PublishCollection;

internal sealed class PublishCollectionHandler(ContentDbContext db, IClock clock)
{
    public async Task<Result<Collection, Error>> HandleAsync(string slug, CancellationToken cancellationToken)
    {
        Collection? c = await db.Collections
            .Include(c => c.Tasks)
            .FirstOrDefaultAsync(c => c.Slug == slug, cancellationToken)
            .ConfigureAwait(false);
        if (c is null)
        {
            return Error.NotFound("Collection", slug);
        }

        Result<Unit, Error> r = c.Publish(clock.UtcNow);
        if (r.IsFailure)
        {
            return r.Error;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return c;
    }
}
```

- [ ] **Step 5: Publish endpoint**

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateCollection;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.PublishCollection;

internal static class PublishCollectionEndpoint
{
    public static IEndpointRouteBuilder MapPublishCollection(this IEndpointRouteBuilder group)
    {
        group.MapPost("/{slug}/publish/", HandleAsync)
            .WithName("AdminPublishCollection")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Ok<CollectionAdminResponse>, NotFound<ErrorPayload>, Conflict<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        string slug,
        PublishCollectionHandler handler,
        CancellationToken cancellationToken)
    {
        Result<Collection, Error> r = await handler.HandleAsync(slug, cancellationToken).ConfigureAwait(false);
        if (r.IsFailure)
        {
            ErrorPayload payload = new(r.Error.Code, r.Error.Message);
            if (r.Error.Code.Contains("NotFound", StringComparison.Ordinal))
            {
                return TypedResults.NotFound(payload);
            }
            if (r.Error.Code.Contains("Conflict", StringComparison.Ordinal))
            {
                return TypedResults.Conflict(payload);
            }
            return TypedResults.BadRequest(payload);
        }
        return TypedResults.Ok(CollectionAdminMapping.ToResponse(r.Value));
    }
}
```

- [ ] **Step 6: Archive handler + endpoint**

`ArchiveCollectionHandler.cs`:

```csharp
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Features.Admin.ArchiveCollection;

internal sealed class ArchiveCollectionHandler(ContentDbContext db)
{
    public async Task<Result<Collection, Error>> HandleAsync(string slug, CancellationToken cancellationToken)
    {
        Collection? c = await db.Collections
            .Include(c => c.Tasks)
            .FirstOrDefaultAsync(c => c.Slug == slug, cancellationToken)
            .ConfigureAwait(false);
        if (c is null)
        {
            return Error.NotFound("Collection", slug);
        }

        Result<Unit, Error> r = c.Archive();
        if (r.IsFailure)
        {
            return r.Error;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return c;
    }
}
```

`ArchiveCollectionEndpoint.cs`:

```csharp
using ArenaApi.Contracts.Content;
using ArenaApi.Contracts.Content.Admin;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateCollection;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Core.Modules.Content.Features.Admin.ArchiveCollection;

internal static class ArchiveCollectionEndpoint
{
    public static IEndpointRouteBuilder MapArchiveCollection(this IEndpointRouteBuilder group)
    {
        group.MapPost("/{slug}/archive/", HandleAsync)
            .WithName("AdminArchiveCollection")
            .WithTags("Content.Admin");
        return group;
    }

    private static async Task<Results<Ok<CollectionAdminResponse>, NotFound<ErrorPayload>, Conflict<ErrorPayload>>> HandleAsync(
        string slug,
        ArchiveCollectionHandler handler,
        CancellationToken cancellationToken)
    {
        Result<Collection, Error> r = await handler.HandleAsync(slug, cancellationToken).ConfigureAwait(false);
        if (r.IsFailure)
        {
            ErrorPayload payload = new(r.Error.Code, r.Error.Message);
            return r.Error.Code.Contains("NotFound", StringComparison.Ordinal)
                ? TypedResults.NotFound(payload)
                : TypedResults.Conflict(payload);
        }
        return TypedResults.Ok(CollectionAdminMapping.ToResponse(r.Value));
    }
}
```

- [ ] **Step 7: Build + commit**

```
dotnet build backend/ArenaApi -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Contracts/Content/Admin/SetCollectionTasksRequest.cs \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/SetCollectionTasks/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/PublishCollection/ \
        backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Features/Admin/ArchiveCollection/
git commit -m "feat(content): admin set-tasks, publish, archive for collections"
```

---

## Task 28: `CatalogSeeder` with the full Phase 0 dataset

**Files:**
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Seed/SeedData.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Seed/CatalogSeeder.cs`
- Create: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Seed/CatalogSeederHostedService.cs`
- Test: `backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/CatalogSeederTests.cs`

The seeder runs once at process startup, inserts 5 topics → 12 tasks → 4 collections, all in `Published` state. The dataset mirrors `frontend/src/entities/{task,collection}/mock-data.ts` exactly so the upcoming frontend swap renders the same cards. Each task gets a minimal "Solution stub" starter, one auto-generated example, one canned constraint/hint, and one placeholder unit test (`Solution.cs` containing `// TODO`) — enough to clear the `Publish()` invariants. The frontend mocks have richer detail only for `two-sum`; that exact detail is preserved.

- [ ] **Step 1: `SeedData.cs` — all 5 topics + 12 tasks + 4 collections**

```csharp
using ArenaApi.Core.Modules.Content.Domain;

namespace ArenaApi.Core.Modules.Content.Seed;

internal static class SeedData
{
    public sealed record TopicSeed(string Slug, string Label, IconTone Tone, int SortOrder);

    public sealed record TaskSeed(
        string Slug, string Title, string ShortDescription, string LongDescription,
        Difficulty Difficulty, TaskFormat Format,
        short XpReward, short EstimatedMinutes,
        string IconGlyph, IconTone IconTone,
        IReadOnlyList<string> TopicSlugs,
        string StarterCode,
        IReadOnlyList<(string Input, string Output, string? Explanation)> Examples,
        IReadOnlyList<string> Constraints,
        IReadOnlyList<string> Hints,
        IReadOnlyList<(string Filename, string Body, bool IsHidden)> UnitTests);

    public sealed record CollectionSeed(
        string Slug, string Title, string Subtitle,
        CollectionAccent Accent, string IconGlyph, IconTone IconTone,
        int SortOrder, IReadOnlyList<string> TaskSlugs);

    public static readonly IReadOnlyList<TopicSeed> Topics =
    [
        new("csharp-basics", "C# Basics", IconTone.Purple, 0),
        new("oop", "OOP", IconTone.Cyan, 1),
        new("algorithms", "Algorithms", IconTone.Gold, 2),
        new("aspnet-core", "ASP.NET Core", IconTone.Green, 3),
        new("concurrency", "Concurrency", IconTone.Red, 4),
    ];

    private const string GenericStarter = """
        using System;
        using System.Collections.Generic;

        public static class Solution
        {
            // TODO: implement.
        }
        """;

    private const string TwoSumStarter = """
        using System;
        using System.Collections.Generic;

        public class Solution
        {
            public int[] TwoSum(int[] nums, int target)
            {
                var map = new Dictionary<int, int>();

                for (int i = 0; i < nums.Length; i++)
                {
                    int complement = target - nums[i];
                    if (map.ContainsKey(complement))
                        return new int[] { map[complement], i };
                    map[nums[i]] = i;
                }

                return new int[0];
            }
        }
        """;

    private const string PlaceholderUnitTest = """
        // Placeholder unit test — replaced by real xUnit content in Phase 1.2.
        // The runner harness rewrites this for actual execution.
        public static class Stub
        {
            public static void Marker() { }
        }
        """;

    public static readonly IReadOnlyList<TaskSeed> Tasks =
    [
        new(
            Slug: "variables-and-types",
            Title: "Variables and Types",
            ShortDescription: "Изучи переменные, value/reference типы и базовые операции.",
            LongDescription: "Стартовая задача: создай несколько переменных разных типов и выведи их.",
            Difficulty: Difficulty.Easy, Format: TaskFormat.Single,
            XpReward: 10, EstimatedMinutes: 15,
            IconGlyph: "C#", IconTone: IconTone.Purple,
            TopicSlugs: ["csharp-basics"],
            StarterCode: GenericStarter,
            Examples: [("input: none", "output: hello, world", null)],
            Constraints: ["Don't use external libraries."],
            Hints: ["Reach for `int`, `string`, `bool`."],
            UnitTests: [("StubTests.cs", PlaceholderUnitTest, true)]),
        new(
            Slug: "loops-arena",
            Title: "Loops Arena",
            ShortDescription: "Освой for, while и do-while на практических заданиях.",
            LongDescription: "Реализуй несколько коротких функций, тренирующих циклы.",
            Difficulty: Difficulty.Easy, Format: TaskFormat.Single,
            XpReward: 10, EstimatedMinutes: 20,
            IconGlyph: "∞", IconTone: IconTone.Cyan,
            TopicSlugs: ["csharp-basics"],
            StarterCode: GenericStarter,
            Examples: [("n = 5", "1 2 3 4 5", null)],
            Constraints: ["1 ≤ n ≤ 1000"],
            Hints: ["Решение через `for` — самый прямой путь."],
            UnitTests: [("StubTests.cs", PlaceholderUnitTest, true)]),
        new(
            Slug: "linq-basics",
            Title: "LINQ Basics",
            ShortDescription: "Фильтруй, проецируй и сортируй коллекции с помощью LINQ.",
            LongDescription: "Используй `.Where`, `.Select`, `.OrderBy` чтобы преобразовать список.",
            Difficulty: Difficulty.Medium, Format: TaskFormat.Single,
            XpReward: 20, EstimatedMinutes: 25,
            IconGlyph: "λ", IconTone: IconTone.Pink,
            TopicSlugs: ["csharp-basics"],
            StarterCode: GenericStarter,
            Examples: [("[3,1,2]", "[1,2,3]", null)],
            Constraints: ["Не используй `List.Sort` напрямую."],
            Hints: ["LINQ extension methods живут в `System.Linq`."],
            UnitTests: [("StubTests.cs", PlaceholderUnitTest, true)]),
        new(
            Slug: "two-sum",
            Title: "Two Sum",
            ShortDescription: "Найди два индекса, сумма значений которых равна заданной цели.",
            LongDescription: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input has exactly one solution, and you may not use the same element twice.",
            Difficulty: Difficulty.Medium, Format: TaskFormat.Single,
            XpReward: 25, EstimatedMinutes: 30,
            IconGlyph: "Σ", IconTone: IconTone.Blue,
            TopicSlugs: ["algorithms"],
            StarterCode: TwoSumStarter,
            Examples:
            [
                ("nums = [2, 7, 11, 15], target = 9", "[0, 1]", "Because nums[0] + nums[1] == 9, we return [0, 1]."),
                ("nums = [3, 2, 4], target = 6", "[1, 2]", null),
                ("nums = [3, 3], target = 6", "[0, 1]", null),
            ],
            Constraints:
            [
                "2 <= nums.length <= 10^4",
                "-10^9 <= nums[i] <= 10^9",
                "-10^9 <= target <= 10^9",
                "Only one valid answer exists.",
            ],
            Hints:
            [
                "A naive O(n²) approach checks every pair — fine for n ≤ 1000.",
                "Use a hash map to store the complement of each value in one pass.",
            ],
            UnitTests: [("TwoSumTests.cs", PlaceholderUnitTest, true)]),
        new(
            Slug: "stack-and-queue-basics",
            Title: "Stack and Queue Basics",
            ShortDescription: "Реализуй стек и очередь, реши задачи на их основе.",
            LongDescription: "Используй `Stack<T>` и `Queue<T>` из стандартной библиотеки.",
            Difficulty: Difficulty.Medium, Format: TaskFormat.Single,
            XpReward: 20, EstimatedMinutes: 25,
            IconGlyph: "≡", IconTone: IconTone.Purple,
            TopicSlugs: ["algorithms"],
            StarterCode: GenericStarter,
            Examples: [("push 1, push 2, pop", "2", null)],
            Constraints: ["1 ≤ operations ≤ 10^5"],
            Hints: ["`Push`/`Pop` для стека, `Enqueue`/`Dequeue` для очереди."],
            UnitTests: [("StubTests.cs", PlaceholderUnitTest, true)]),
        new(
            Slug: "build-your-first-web-api",
            Title: "Build Your First Web API",
            ShortDescription: "Создай простой REST API на ASP.NET Core с одним ресурсом.",
            LongDescription: "Поднимай ASP.NET Core Minimal API, добавь маршруты `GET`/`POST`.",
            Difficulty: Difficulty.Medium, Format: TaskFormat.MiniQuest,
            XpReward: 30, EstimatedMinutes: 40,
            IconGlyph: "API", IconTone: IconTone.Cyan,
            TopicSlugs: ["aspnet-core"],
            StarterCode: GenericStarter,
            Examples: [("GET /items", "[]", null)],
            Constraints: ["In-memory storage достаточно."],
            Hints: ["`WebApplication.CreateBuilder` — старт точка."],
            UnitTests: [("StubTests.cs", PlaceholderUnitTest, true)]),
        new(
            Slug: "crud-with-aspnet-core",
            Title: "CRUD with ASP.NET Core",
            ShortDescription: "Собери полноценный CRUD с валидацией и маршрутизацией.",
            LongDescription: "Добавь `PUT`/`DELETE`, валидацию через `Results.Problem`.",
            Difficulty: Difficulty.Hard, Format: TaskFormat.MiniQuest,
            XpReward: 40, EstimatedMinutes: 60,
            IconGlyph: "⌘", IconTone: IconTone.Green,
            TopicSlugs: ["aspnet-core"],
            StarterCode: GenericStarter,
            Examples: [("PUT /items/1 { ... }", "204 No Content", null)],
            Constraints: ["Не используй `MapControllers`."],
            Hints: ["TypedResults — твой друг."],
            UnitTests: [("StubTests.cs", PlaceholderUnitTest, true)]),
        new(
            Slug: "websocket-chat-echo",
            Title: "WebSocket Chat Echo",
            ShortDescription: "Подними real-time эхо-чат на WebSockets / SignalR.",
            LongDescription: "Получай сообщение и возвращай его с префиксом `echo:`.",
            Difficulty: Difficulty.Hard, Format: TaskFormat.MiniQuest,
            XpReward: 40, EstimatedMinutes: 45,
            IconGlyph: "⇆", IconTone: IconTone.Pink,
            TopicSlugs: ["aspnet-core"],
            StarterCode: GenericStarter,
            Examples: [("client: hi", "server: echo: hi", null)],
            Constraints: ["Один клиент — одна сессия."],
            Hints: ["`app.UseWebSockets()` + `WebSocketManager`."],
            UnitTests: [("StubTests.cs", PlaceholderUnitTest, true)]),
        new(
            Slug: "async-await-mission",
            Title: "Async Await Mission",
            ShortDescription: "Разберись с async/await и неблокирующим кодом.",
            LongDescription: "Реализуй несколько асинхронных операций и параллельно их выполни.",
            Difficulty: Difficulty.Medium, Format: TaskFormat.Single,
            XpReward: 25, EstimatedMinutes: 30,
            IconGlyph: "⚡", IconTone: IconTone.Gold,
            TopicSlugs: ["concurrency"],
            StarterCode: GenericStarter,
            Examples: [("await op1, await op2", "result1, result2", null)],
            Constraints: ["Не блокируй поток через `.Result`."],
            Hints: ["`Task.WhenAll` для параллельного ожидания."],
            UnitTests: [("StubTests.cs", PlaceholderUnitTest, true)]),
        new(
            Slug: "ef-core-filtering-quest",
            Title: "EF Core Filtering Quest",
            ShortDescription: "Делай выборки с EF Core: eager loading, фильтры, проекции.",
            LongDescription: "Используй `.Include` / `.Where` / `.Select` чтобы вернуть нужные строки.",
            Difficulty: Difficulty.Hard, Format: TaskFormat.MiniQuest,
            XpReward: 40, EstimatedMinutes: 50,
            IconGlyph: "DB", IconTone: IconTone.Blue,
            TopicSlugs: ["aspnet-core"],
            StarterCode: GenericStarter,
            Examples: [("Find author with > 1 book", "[Author { ... }]", null)],
            Constraints: ["Не загружай все строки в память."],
            Hints: ["`AsNoTracking()` для read-only."],
            UnitTests: [("StubTests.cs", PlaceholderUnitTest, true)]),
        new(
            Slug: "gc-probe",
            Title: "Garbage Collection Probe",
            ShortDescription: "Замерь поколения GC и спровоцируй сборку без LoH-fragmentation.",
            LongDescription: "Используй `GC.GetGeneration` и измерь, как переживают объекты Gen0 → Gen2.",
            Difficulty: Difficulty.Hard, Format: TaskFormat.Boss,
            XpReward: 50, EstimatedMinutes: 55,
            IconGlyph: "♻", IconTone: IconTone.Green,
            TopicSlugs: ["oop"],
            StarterCode: GenericStarter,
            Examples: [("alloc 100 small objects", "Gen0 collection triggered", null)],
            Constraints: ["Без `unsafe`."],
            Hints: ["`GC.Collect()` — последний resort; не злоупотребляй."],
            UnitTests: [("StubTests.cs", PlaceholderUnitTest, true)]),
        new(
            Slug: "parallel-pipeline",
            Title: "Parallel Pipeline",
            ShortDescription: "Построй конвейер на TPL Dataflow: backpressure, отмена, ошибки.",
            LongDescription: "Соедини три блока: `TransformBlock` → `BatchBlock` → `ActionBlock`.",
            Difficulty: Difficulty.Hard, Format: TaskFormat.Boss,
            XpReward: 60, EstimatedMinutes: 70,
            IconGlyph: "∥", IconTone: IconTone.Red,
            TopicSlugs: ["concurrency"],
            StarterCode: GenericStarter,
            Examples: [("100 events", "20 batches of 5", null)],
            Constraints: ["BoundedCapacity = 16 для backpressure."],
            Hints: ["`DataflowLinkOptions.PropagateCompletion = true`."],
            UnitTests: [("StubTests.cs", PlaceholderUnitTest, true)]),
    ];

    public static readonly IReadOnlyList<CollectionSeed> Collections =
    [
        new(
            Slug: "csharp-fundamentals",
            Title: "C# Fundamentals Pack",
            Subtitle: "Стартовый путь: синтаксис, типы, базовые конструкции.",
            Accent: CollectionAccent.Purple, IconGlyph: "C#", IconTone: IconTone.Purple,
            SortOrder: 0,
            TaskSlugs: ["variables-and-types", "loops-arena", "linq-basics"]),
        new(
            Slug: "algorithm-starter",
            Title: "Algorithm Starter Pack",
            Subtitle: "Алгоритмы и структуры, которые спросят на собесе.",
            Accent: CollectionAccent.Gold, IconGlyph: "Σ", IconTone: IconTone.Gold,
            SortOrder: 1,
            TaskSlugs: ["two-sum", "stack-and-queue-basics"]),
        new(
            Slug: "web-api-journey",
            Title: "Web API Journey",
            Subtitle: "Собери production REST на ASP.NET Core пошагово.",
            Accent: CollectionAccent.Cyan, IconGlyph: "API", IconTone: IconTone.Cyan,
            SortOrder: 2,
            TaskSlugs: ["build-your-first-web-api", "crud-with-aspnet-core", "ef-core-filtering-quest"]),
        new(
            Slug: "realtime-websockets",
            Title: "Real-time Apps: WebSockets",
            Subtitle: "Real-time с WebSockets и SignalR, от echo до presence.",
            Accent: CollectionAccent.Green, IconGlyph: "⇆", IconTone: IconTone.Green,
            SortOrder: 3,
            TaskSlugs: ["websocket-chat-echo", "async-await-mission", "parallel-pipeline"]),
    ];
}
```

- [ ] **Step 2: `CatalogSeeder.cs`**

```csharp
using System.Text.Json;
using ArenaApi.Core.Modules.Content.Domain;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Shared.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ArenaApi.Core.Modules.Content.Seed;

internal sealed partial class CatalogSeeder(
    ContentDbContext db,
    IClock clock,
    ILogger<CatalogSeeder> logger)
{
    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        bool alreadySeeded = await db.Topics
            .AsNoTracking()
            .AnyAsync(cancellationToken)
            .ConfigureAwait(false);

        if (alreadySeeded)
        {
            LogSkipped(logger);
            return;
        }

        // 1) Topics
        var topicBySlug = new Dictionary<string, Topic>(StringComparer.Ordinal);
        foreach (SeedData.TopicSeed t in SeedData.Topics)
        {
            Topic topic = Topic.Create(t.Slug, t.Label, t.Tone, t.SortOrder).Value;
            await db.Topics.AddAsync(topic, cancellationToken).ConfigureAwait(false);
            topicBySlug[t.Slug] = topic;
        }

        // 2) Tasks
        var taskBySlug = new Dictionary<string, ContentTask>(StringComparer.Ordinal);
        foreach (SeedData.TaskSeed s in SeedData.Tasks)
        {
            ContentTask task = ContentTask.Create(
                s.Slug, s.Title, s.ShortDescription,
                "csharp", s.Difficulty, s.Format,
                clock.UtcNow).Value;

            task.UpdateMetadata(
                s.Title, s.ShortDescription, s.LongDescription,
                s.Difficulty, s.Format,
                s.XpReward, s.EstimatedMinutes,
                s.IconGlyph, s.IconTone, clock.UtcNow);

            var assets = new List<TaskAssetInput>
            {
                new(AssetKind.Starter, 0, s.StarterCode, null),
            };
            int exampleIdx = 0;
            foreach (var (input, output, explanation) in s.Examples)
            {
                string json = JsonSerializer.Serialize(new { input, output, explanation });
                assets.Add(new TaskAssetInput(AssetKind.Example, exampleIdx++, json, null));
            }
            int constraintIdx = 0;
            foreach (string ctxt in s.Constraints)
            {
                assets.Add(new TaskAssetInput(AssetKind.Constraint, constraintIdx++, ctxt, null));
            }
            int hintIdx = 0;
            foreach (string hint in s.Hints)
            {
                assets.Add(new TaskAssetInput(AssetKind.Hint, hintIdx++, hint, null));
            }
            task.ReplaceAssets(assets);

            int testIdx = 0;
            task.ReplaceUnitTests(s.UnitTests
                .Select(u => new TaskUnitTestInput(u.Filename, u.Body, u.IsHidden, testIdx++))
                .ToList());

            task.SetTopics(s.TopicSlugs.Select(slug => topicBySlug[slug].Id).ToList());

            var publishResult = task.Publish(clock.UtcNow);
            if (publishResult.IsFailure)
            {
                throw new InvalidOperationException(
                    $"Seed task '{s.Slug}' failed to publish: {publishResult.Error.Code} — {publishResult.Error.Message}");
            }

            await db.ContentTasks.AddAsync(task, cancellationToken).ConfigureAwait(false);
            taskBySlug[s.Slug] = task;
        }

        // 3) Collections
        foreach (SeedData.CollectionSeed col in SeedData.Collections)
        {
            Collection collection = Collection.Create(
                col.Slug, col.Title, col.Subtitle, col.Accent,
                col.IconGlyph, col.IconTone, col.SortOrder, clock.UtcNow).Value;

            collection.SetTasks(col.TaskSlugs.Select(slug => taskBySlug[slug].Id).ToList());

            var publishResult = collection.Publish(clock.UtcNow);
            if (publishResult.IsFailure)
            {
                throw new InvalidOperationException(
                    $"Seed collection '{col.Slug}' failed: {publishResult.Error.Code}");
            }

            await db.Collections.AddAsync(collection, cancellationToken).ConfigureAwait(false);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        LogSeeded(logger, SeedData.Topics.Count, SeedData.Tasks.Count, SeedData.Collections.Count);
    }

    [LoggerMessage(EventId = 200, Level = LogLevel.Information,
        Message = "CatalogSeeder: catalog already populated; skipping.")]
    private static partial void LogSkipped(ILogger logger);

    [LoggerMessage(EventId = 201, Level = LogLevel.Information,
        Message = "CatalogSeeder: inserted {TopicCount} topics, {TaskCount} tasks, {CollectionCount} collections.")]
    private static partial void LogSeeded(ILogger logger, int topicCount, int taskCount, int collectionCount);
}
```

- [ ] **Step 3: `CatalogSeederHostedService.cs`**

```csharp
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace ArenaApi.Core.Modules.Content.Seed;

internal sealed class CatalogSeederHostedService(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        // Tests set Content:DisableCatalogSeeder=true so they own their fixtures.
        if (configuration.GetValue("Content:DisableCatalogSeeder", false))
        {
            return;
        }

        using IServiceScope scope = scopeFactory.CreateScope();
        CatalogSeeder seeder = scope.ServiceProvider.GetRequiredService<CatalogSeeder>();
        await seeder.SeedAsync(cancellationToken).ConfigureAwait(false);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
```

- [ ] **Step 4: Integration test**

```csharp
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Modules.Content.Seed;
using ArenaApi.IntegrationTests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ArenaApi.IntegrationTests.Modules.Content;

[Collection(nameof(IntegrationTestsCollection))]
public sealed class CatalogSeederTests
{
    private readonly IntegrationTestsWebFactory _factory;

    public CatalogSeederTests(IntegrationTestsWebFactory factory) => _factory = factory;

    [Fact]
    public async Task Seeder_inserts_all_5_topics_12_tasks_4_collections_on_empty_db()
    {
        await _factory.ResetContentSchemaAsync();
        using var scope = _factory.Services.CreateScope();
        var seeder = scope.ServiceProvider.GetRequiredService<CatalogSeeder>();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();

        await seeder.SeedAsync(CancellationToken.None);

        Assert.Equal(5, db.Topics.Count());
        Assert.Equal(12, db.ContentTasks.Count());
        Assert.Equal(4, db.Collections.Count());
    }

    [Fact]
    public async Task Seeder_is_idempotent_on_second_run()
    {
        await _factory.ResetContentSchemaAsync();
        using var scope = _factory.Services.CreateScope();
        var seeder = scope.ServiceProvider.GetRequiredService<CatalogSeeder>();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();

        await seeder.SeedAsync(CancellationToken.None);
        await seeder.SeedAsync(CancellationToken.None); // second call short-circuits

        Assert.Equal(5, db.Topics.Count());
        Assert.Equal(12, db.ContentTasks.Count());
    }
}
```

- [ ] **Step 5: Build + run the seeder tests**

```
dotnet build backend/ArenaApi -nologo
dotnet test backend/ArenaApi/tests/ArenaApi.IntegrationTests --filter "FullyQualifiedName~CatalogSeederTests" -nologo
```

Expected: `Passed: 2`. (Integration tests are slow on first run because of the Postgres container.)

- [ ] **Step 6: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Seed/ \
        backend/ArenaApi/tests/ArenaApi.IntegrationTests/Modules/Content/CatalogSeederTests.cs
git commit -m "feat(content): CatalogSeeder with 5 topics, 12 tasks, 4 collections"
```

---

## Task 29: Wire endpoints in `ContentModule`

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/ContentModule.cs`
- Modify: `backend/ArenaApi/src/ArenaApi.Web/Program.cs`

The Content module exposes a `MapContentEndpoints(this IEndpointRouteBuilder, Action<RouteGroupBuilder>? configureAdminGroup)` overload so the Web project can attach `RequireAdminFilter` to the admin group without the Core project referencing `Microsoft.AspNetCore.Http`-side filter types.

- [ ] **Step 1: Replace `ContentModule.cs`**

```csharp
using ArenaApi.Core.Modules.Content.Features.Admin.ArchiveCollection;
using ArenaApi.Core.Modules.Content.Features.Admin.ArchiveTask;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateCollection;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateContentTask;
using ArenaApi.Core.Modules.Content.Features.Admin.CreateTopic;
using ArenaApi.Core.Modules.Content.Features.Admin.DeleteCollection;
using ArenaApi.Core.Modules.Content.Features.Admin.DeleteTask;
using ArenaApi.Core.Modules.Content.Features.Admin.DeleteTopic;
using ArenaApi.Core.Modules.Content.Features.Admin.GetTaskAdmin;
using ArenaApi.Core.Modules.Content.Features.Admin.ListCollectionsAdmin;
using ArenaApi.Core.Modules.Content.Features.Admin.ListTasksAdmin;
using ArenaApi.Core.Modules.Content.Features.Admin.ListTopicsAdmin;
using ArenaApi.Core.Modules.Content.Features.Admin.PublishCollection;
using ArenaApi.Core.Modules.Content.Features.Admin.PublishTask;
using ArenaApi.Core.Modules.Content.Features.Admin.SetCollectionTasks;
using ArenaApi.Core.Modules.Content.Features.Admin.UpdateCollection;
using ArenaApi.Core.Modules.Content.Features.Admin.UpdateTaskAssets;
using ArenaApi.Core.Modules.Content.Features.Admin.UpdateTaskMetadata;
using ArenaApi.Core.Modules.Content.Features.Admin.UpdateTaskUnitTests;
using ArenaApi.Core.Modules.Content.Features.Admin.UpdateTopic;
using ArenaApi.Core.Modules.Content.Features.CreatePackage;
using ArenaApi.Core.Modules.Content.Features.GetCollection;
using ArenaApi.Core.Modules.Content.Features.GetTask;
using ArenaApi.Core.Modules.Content.Features.ListCollections;
using ArenaApi.Core.Modules.Content.Features.ListTasks;
using ArenaApi.Core.Modules.Content.Features.ListTopics;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Modules.Content.Seed;
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

        // Public handlers
        services.AddScoped<CreatePackageHandler>();
        services.AddScoped<ListTasksHandler>();
        services.AddScoped<GetTaskHandler>();
        services.AddScoped<ListTopicsHandler>();
        services.AddScoped<ListCollectionsHandler>();
        services.AddScoped<GetCollectionHandler>();

        // Admin — topics
        services.AddScoped<CreateTopicHandler>();
        services.AddScoped<UpdateTopicHandler>();
        services.AddScoped<DeleteTopicHandler>();
        services.AddScoped<ListTopicsAdminHandler>();

        // Admin — tasks
        services.AddScoped<CreateContentTaskHandler>();
        services.AddScoped<UpdateTaskMetadataHandler>();
        services.AddScoped<UpdateTaskAssetsHandler>();
        services.AddScoped<UpdateTaskUnitTestsHandler>();
        services.AddScoped<PublishTaskHandler>();
        services.AddScoped<ArchiveTaskHandler>();
        services.AddScoped<DeleteTaskHandler>();
        services.AddScoped<ListTasksAdminHandler>();
        services.AddScoped<GetTaskAdminHandler>();

        // Admin — collections
        services.AddScoped<CreateCollectionHandler>();
        services.AddScoped<UpdateCollectionHandler>();
        services.AddScoped<DeleteCollectionHandler>();
        services.AddScoped<ListCollectionsAdminHandler>();
        services.AddScoped<SetCollectionTasksHandler>();
        services.AddScoped<PublishCollectionHandler>();
        services.AddScoped<ArchiveCollectionHandler>();

        // Seeding
        services.AddScoped<CatalogSeeder>();
        services.AddHostedService<CatalogSeederHostedService>();

        services.AddSingleton<IClock, SystemClock>();

        return services;
    }

    public static IEndpointRouteBuilder MapContentEndpoints(
        this IEndpointRouteBuilder app,
        Action<RouteGroupBuilder>? configureAdminGroup = null)
    {
        // Legacy package endpoint stays for now — kept under /api/packages/.
        RouteGroupBuilder packages = app.MapGroup("/api/packages");
        packages.MapCreatePackage();

        // Public v1 — anonymous, only Published.
        RouteGroupBuilder v1Tasks = app.MapGroup("/api/v1/tasks");
        v1Tasks.MapListTasks();
        v1Tasks.MapGetTask();

        RouteGroupBuilder v1Topics = app.MapGroup("/api/v1/topics");
        v1Topics.MapListTopics();

        RouteGroupBuilder v1Collections = app.MapGroup("/api/v1/collections");
        v1Collections.MapListCollections();
        v1Collections.MapGetCollection();

        // Admin — RequireAdmin filter attached by caller (Program.cs).
        RouteGroupBuilder adminTopics = app.MapGroup("/api/admin/topics");
        configureAdminGroup?.Invoke(adminTopics);
        adminTopics.MapListTopicsAdmin();
        adminTopics.MapCreateTopic();
        adminTopics.MapUpdateTopic();
        adminTopics.MapDeleteTopic();

        RouteGroupBuilder adminTasks = app.MapGroup("/api/admin/tasks");
        configureAdminGroup?.Invoke(adminTasks);
        adminTasks.MapListTasksAdmin();
        adminTasks.MapGetTaskAdmin();
        adminTasks.MapCreateContentTask();
        adminTasks.MapUpdateTaskMetadata();
        adminTasks.MapUpdateTaskAssets();
        adminTasks.MapUpdateTaskUnitTests();
        adminTasks.MapPublishTask();
        adminTasks.MapArchiveTask();
        adminTasks.MapDeleteTask();

        RouteGroupBuilder adminCollections = app.MapGroup("/api/admin/collections");
        configureAdminGroup?.Invoke(adminCollections);
        adminCollections.MapListCollectionsAdmin();
        adminCollections.MapCreateCollection();
        adminCollections.MapUpdateCollection();
        adminCollections.MapDeleteCollection();
        adminCollections.MapSetCollectionTasks();
        adminCollections.MapPublishCollection();
        adminCollections.MapArchiveCollection();

        return app;
    }
}
```

- [ ] **Step 2: Update `Program.cs` to attach the filter**

```csharp
using ArenaApi.Core;
using ArenaApi.Core.Features.Health;
using ArenaApi.Core.Modules.Content;
using ArenaApi.Core.Modules.Execution;
using ArenaApi.Core.Modules.IdentityStub;
using ArenaApi.Core.Modules.Progress;
using ArenaApi.Web.Authorization;
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
app.MapContentEndpoints(adminGroup => adminGroup.AddEndpointFilter<RequireAdminFilter>());

await app.RunAsync();

namespace ArenaApi.Web
{
    public sealed class Program;
}
```

- [ ] **Step 3: Build + run the architecture and authorization tests**

```
dotnet build backend/ArenaApi -nologo
dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests --filter "FullyQualifiedName~ModuleBoundariesTests" -nologo
dotnet test backend/ArenaApi/tests/ArenaApi.IntegrationTests --filter "FullyQualifiedName~AdminAuthorizationTests" -nologo
```

Expected: all pass. AdminAuthorizationTests now compile and run because admin endpoints exist.

- [ ] **Step 4: Commit**

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/ContentModule.cs \
        backend/ArenaApi/src/ArenaApi.Web/Program.cs
git commit -m "feat(content): wire v1 + admin route groups; attach RequireAdmin filter"
```

---

## Task 30: Mark `Package` obsolete; refresh ArenaApi/CLAUDE.md

**Files:**
- Modify: `backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Package.cs`
- Modify: `backend/ArenaApi/CLAUDE.md`

The `packages` table and `POST /api/packages/` stay live (other modules still emit/consume the `PackageCreated` event for the Wolverine smoke check). The aggregate gets `[Obsolete]` so new code stops calling it.

- [ ] **Step 1: Annotate `Package`**

Replace the file:

```csharp
using ArenaApi.Core.Modules.Content.Domain.DomainEvents;
using ArenaApi.Core.Shared.DomainEvents;
using ArenaApi.Core.Shared.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Core.Modules.Content.Domain;

/// <summary>
/// Legacy Phase 0 smoke aggregate kept alive so the Wolverine outbox + RabbitMQ
/// integration test still has something to publish. Superseded by
/// <see cref="ContentTask"/> + <see cref="Collection"/> in Phase 1.1. Don't
/// add new callers; a follow-up migration will drop the <c>packages</c> table.
/// </summary>
[Obsolete("Use ContentTask / Collection. Kept for Wolverine smoke wiring only.")]
internal sealed class Package : IHasDomainEvents
{
    private readonly List<IDomainEvent> _domainEvents = [];

    public Guid Id { get; private init; }
    public string Slug { get; private init; } = null!;
    public string Title { get; private init; } = null!;
    public DateTimeOffset CreatedAt { get; private init; }

    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents;

    public void ClearDomainEvents() => _domainEvents.Clear();

    private Package() { }

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

Existing callers (`CreatePackageHandler`, `PackageConfiguration`, the `ContentInitial` migration) compile cleanly because `[Obsolete]` is a warning, not an error. Suppress the warning at those specific call sites with `#pragma warning disable CS0618 // Type or member is obsolete` … `#pragma warning restore CS0618` around the `Package.Create` / `db.Packages` lines if your build is set to treat warnings as errors. (Verify `dotnet build` output before committing.)

- [ ] **Step 2: Update `backend/ArenaApi/CLAUDE.md`**

Replace the entire "## Phase 0 status" section with:

```markdown
## Phase 1.1 status

- **Content** owns the full programming-task catalog:
  - Aggregates: `ContentTask` (owns `TaskAsset` + `TaskUnitTest` + `TaskTopic` links),
    `Topic`, `Collection` (owns ordered `CollectionTask`). All in `arena_content`.
  - Public read API (anonymous): `GET /api/v1/tasks/`, `GET /api/v1/tasks/{slug}/`,
    `GET /api/v1/topics/`, `GET /api/v1/collections/`, `GET /api/v1/collections/{slug}/`.
    Returns only `Status = Published`; never returns `task_unit_tests`.
  - Admin write API (`ICurrentUser.IsAdmin == true`, enforced by
    `ArenaApi.Web.Authorization.RequireAdminFilter` on `/api/admin/*`):
    full CRUD for topics, tasks, collections + transition endpoints
    (`/publish/`, `/archive/`).
  - Lifecycle invariants: `Publish()` requires ≥1 starter + ≥1 example +
    ≥1 unit test + ≥1 topic. Published tasks are read-only (admin gets 409 on
    metadata/assets/tests edits) — archive first, edit, publish again.
  - Startup seeder (`CatalogSeeder`) inserts 5 topics + 12 tasks + 4 collections
    from `Modules/Content/Seed/SeedData.cs` on an empty DB. Disabled when
    `Content:DisableCatalogSeeder=true` (the integration test factory sets this).
- **Execution** and **Progress** remain skeletons (DbContext + outbox only).
  Phase 1 MVP loop in `docs/superpowers/plans/2026-05-24-phase-1-mvp-loop.md`
  fills them in.
- **IdentityStub** now exposes `IsAdmin` from
  `appsettings:IdentityStub:IsAdmin` (boolean; local dev = `true`).
- **Legacy:** `Package` aggregate + `POST /api/packages/` + `packages` table
  stay live to keep the Wolverine smoke check. `Package` is `[Obsolete]`.
```

Leave the rest of the file untouched.

- [ ] **Step 3: Build + commit**

```
dotnet build backend/ArenaApi -nologo
```

```bash
git add backend/ArenaApi/src/ArenaApi.Core/Modules/Content/Domain/Package.cs \
        backend/ArenaApi/CLAUDE.md
git commit -m "chore(content): mark Package obsolete; refresh ArenaApi/CLAUDE.md"
```

---

## Task 31: End-to-end verification script

**Files:**
- Create: `scripts/verify-content-catalog.sh`
- Test: full integration test sweep + curl smoke

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# scripts/verify-content-catalog.sh
#
# Smoke-test the Content catalog end-to-end against a running backend.
# Assumes: backend is up at http://localhost:5000, IdentityStub:IsAdmin=true,
# and the DB has been freshly truncated (or seeded; see notes per step).
#
# Run from repo root: ./scripts/verify-content-catalog.sh

set -euo pipefail

BASE="${ARENA_API_BASE:-http://localhost:5000}"
echo "Using base URL: $BASE"

curl() { command curl --fail --show-error --silent "$@"; }

echo "==> 1) GET /api/v1/topics/ (expect 200, JSON array)"
curl "$BASE/api/v1/topics/" | head -c 2000 && echo

echo "==> 2) Create a draft topic via admin"
curl -X POST "$BASE/api/admin/topics/" \
  -H 'content-type: application/json' \
  -d '{"slug":"verify-smoke","label":"Smoke Topic","tone":"purple","sortOrder":99}' | head -c 500 && echo

echo "==> 3) Create a draft task"
curl -X POST "$BASE/api/admin/tasks/" \
  -H 'content-type: application/json' \
  -d '{
    "slug": "verify-task",
    "title": "Verify Task",
    "shortDescription": "Smoke test task",
    "language": "csharp",
    "difficulty": "easy",
    "format": "single"
  }' | head -c 500 && echo

echo "==> 4) Update metadata + attach topic"
curl -X PUT "$BASE/api/admin/tasks/verify-task/metadata/" \
  -H 'content-type: application/json' \
  -d '{
    "title": "Verify Task v2",
    "shortDescription": "smoke",
    "longDescription": "## Hi",
    "difficulty": "easy",
    "format": "single",
    "xpReward": 10,
    "estimatedMinutes": 15,
    "iconGlyph": "?",
    "iconTone": "purple",
    "topicSlugs": ["verify-smoke"]
  }' | head -c 500 && echo

echo "==> 5) Set assets (starter + example)"
curl -X PUT "$BASE/api/admin/tasks/verify-task/assets/" \
  -H 'content-type: application/json' \
  -d '{
    "assets": [
      { "kind": "starter", "ordinal": 0, "content": "public class Solution {}", "metadataJson": null },
      { "kind": "example", "ordinal": 0, "content": "{\"input\":\"x\",\"output\":\"y\"}", "metadataJson": null }
    ]
  }' | head -c 500 && echo

echo "==> 6) Set unit tests"
curl -X PUT "$BASE/api/admin/tasks/verify-task/tests/" \
  -H 'content-type: application/json' \
  -d '{ "tests": [ { "filename": "T.cs", "content": "// xunit", "isHidden": true, "ordinal": 0 } ] }' | head -c 500 && echo

echo "==> 7) Publish task"
curl -X POST "$BASE/api/admin/tasks/verify-task/publish/" | head -c 500 && echo

echo "==> 8) GET /api/v1/tasks/ (expect Verify Task v2 in items)"
curl "$BASE/api/v1/tasks/?q=verify" | head -c 1000 && echo

echo "==> 9) GET /api/v1/tasks/verify-task/ (expect 200, no unitTests field)"
curl "$BASE/api/v1/tasks/verify-task/" | head -c 1500 && echo

echo "==> 10) Create + set + publish a collection"
curl -X POST "$BASE/api/admin/collections/" \
  -H 'content-type: application/json' \
  -d '{
    "slug": "verify-pack",
    "title": "Verify Pack",
    "subtitle": "smoke",
    "accent": "purple",
    "iconGlyph": "?",
    "iconTone": "purple",
    "sortOrder": 99
  }' | head -c 400 && echo

curl -X PUT "$BASE/api/admin/collections/verify-pack/tasks/" \
  -H 'content-type: application/json' \
  -d '{ "taskSlugs": ["verify-task"] }' | head -c 400 && echo

curl -X POST "$BASE/api/admin/collections/verify-pack/publish/" | head -c 400 && echo

echo "==> 11) GET /api/v1/collections/verify-pack/"
curl "$BASE/api/v1/collections/verify-pack/" | head -c 600 && echo

echo
echo "All steps returned 2xx. Verification complete."
```

Make it executable:

```bash
chmod +x scripts/verify-content-catalog.sh
```

- [ ] **Step 2: Run the full backend test sweep**

```
dotnet test backend/ArenaApi -nologo
```

Expected: every test class added in this plan passes plus the pre-existing `HealthEndpointTests`, `CreatePackageEndpointTests`, `ModuleBoundariesTests`, `SmokeTests`.

- [ ] **Step 3: Run end-to-end against a live backend**

```bash
./scripts/dev.sh up-infra        # postgres only
cd backend/ArenaApi/src/ArenaApi.Web
ASPNETCORE_ENVIRONMENT=Development dotnet run &
BACKEND_PID=$!
cd -

# Wait for /health/ to return 200, then run the script.
until curl -sf http://localhost:5000/health/ >/dev/null; do sleep 1; done

./scripts/verify-content-catalog.sh

kill $BACKEND_PID
```

Expected: the script prints "All steps returned 2xx. Verification complete."

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-content-catalog.sh
git commit -m "test(content): end-to-end verification script for catalog API"
```

---

## Final Verification

After every task is complete:

1. **Static build**
   ```
   dotnet build backend/ArenaApi -nologo
   ```
   Expect zero warnings (warnings-as-errors is on; `[Obsolete]` usages at legacy `Package*` sites are wrapped in `#pragma`).

2. **Unit test sweep**
   ```
   dotnet test backend/ArenaApi/tests/ArenaApi.UnitTests -nologo
   ```
   All `EnumsTests`, `TopicTests`, `ContentTaskTests`, `CollectionTests`,
   `StubCurrentUserTests`, `ModuleBoundariesTests` pass.

3. **Integration test sweep**
   ```
   dotnet test backend/ArenaApi/tests/ArenaApi.IntegrationTests -nologo
   ```
   Postgres + RabbitMQ containers spin up; `AdminAuthorizationTests`, `TopicsAdminEndpointsTests`, `TaskAdminEndpointsTests`, `CollectionAdminEndpointsTests`, `PublicCatalogEndpointsTests`, `CatalogSeederTests`, and pre-existing tests all pass.

   (The four `*AdminEndpointsTests` / `PublicCatalogEndpointsTests` classes are listed in *File Structure* but not detailed step-by-step here: each one should exercise its respective endpoint group with at least one happy-path + one failure-path assertion, using `_factory.CreateAdminClient()` / `CreateAnonymousClient()` and `_factory.ResetContentSchemaAsync()` between fixtures. Mirror the existing `CreatePackageEndpointTests` style.)

4. **Live curl smoke**
   ```
   ./scripts/dev.sh up-infra
   cd backend/ArenaApi/src/ArenaApi.Web && ASPNETCORE_ENVIRONMENT=Development dotnet run &
   until curl -sf http://localhost:5000/health/ >/dev/null; do sleep 1; done
   ./scripts/verify-content-catalog.sh
   ```

5. **Seeded catalog visible**
   With a fresh DB and the seeder enabled (`Content:DisableCatalogSeeder` unset or `false`):
   ```
   curl http://localhost:5000/api/v1/tasks/?size=20 | jq '.items | length'   # expect 12
   curl http://localhost:5000/api/v1/topics/ | jq 'length'                    # expect 5
   curl http://localhost:5000/api/v1/collections/ | jq 'length'               # expect 4
   ```

6. **Admin requires admin**
   ```
   curl -i http://localhost:5000/api/admin/topics/                            # expect 200 (dev = admin)
   ASPNETCORE_ENVIRONMENT=Production dotnet run …                              # admin=false in appsettings.json
   curl -i http://localhost:5000/api/admin/topics/                            # expect 403
   ```

---

## Self-Review

Coverage of the requested spec:

- [x] **Postgres only** — no markdown/git source. All data in `arena_content` tables.
- [x] **Admin = single flag** — `ICurrentUser.IsAdmin`, fed by `IdentityStubOptions.IsAdmin`; dev = true, prod default = false. Enforced by `RequireAdminFilter` on the `/api/admin` route groups.
- [x] **Only unit-test format** — `TestFormat` enum exists with a single value `UnitTest`; the column is reserved but admin and seed only ever set it to `UnitTest`. Unit tests stored as filename + content + isHidden; never returned by public API.
- [x] **Examples in public API; tests hidden** — `GET /api/v1/tasks/{slug}/` returns `examples`, `constraints`, `hints`, `starterCode`. Never returns `unitTests`. Admin's `GET /api/admin/tasks/{slug}/` returns the full bundle including unit tests.
- [x] **Backend first; frontend untouched** — no file under `frontend/` changed. The next plan will switch the mock-based UI to the real API.
- [x] **Schema matches spec** — `topics`, `content_tasks`, `task_assets`, `task_unit_tests`, `task_topics`, `collections`, `collection_tasks`. Enums stored as `smallint`. Migration name `ContentCatalogInitial`.
- [x] **All public URLs** — `GET /api/v1/tasks/`, `GET /api/v1/tasks/{slug}/`, `GET /api/v1/topics/`, `GET /api/v1/collections/`, `GET /api/v1/collections/{slug}/`.
- [x] **All admin URLs** — Topics: list/create/update/delete. Tasks: list/get/create/metadata/assets/tests/publish/archive/delete. Collections: list/create/update/delete/set-tasks/publish/archive. All under `/api/admin/`, all trailing slash.
- [x] **`Result<T, Error>`** — every handler returns `Result<T, Error>`. Endpoints translate via `result.Error.Code.Contains("…")` to choose status code.
- [x] **`Guid.CreateVersion7()`** — used in every factory (Topic, ContentTask, TaskAsset, TaskUnitTest, Collection).
- [x] **Domain invariants** — `Publish()` validates starter/example/test/topic presence. Published tasks reject metadata/assets/tests edits.
- [x] **Domain events** — `ContentTaskCreated`, `ContentTaskPublished`. The publish handler dispatches a Wolverine `ContentTaskPublished` integration event via the outbox.
- [x] **Seed = 5 + 12 + 4** — `CatalogSeeder` mirrors `frontend/src/entities/{task,collection}/mock-data.ts`. Idempotent via `Topics.AnyAsync()`.
- [x] **Tests** — unit tests for every aggregate + enum + `StubCurrentUser`; integration test stubs for admin authz, seeder, and a `Modules/Content` test scaffold for each endpoint family. Architecture test forbids `Core → Web.Authorization`.
- [x] **Verification script** — `scripts/verify-content-catalog.sh` exercises the full create → publish → read loop.

Decisions taken without explicit instruction (flag for review):

1. **Admin clients in the integration test factory.** Added `CreateAdminClient()` / `CreateAnonymousClient()` helpers (not in the spec) because tests for `/api/admin/*` need to vary `IsAdmin` per test.
2. **`ResetContentSchemaAsync()` helper** uses raw `TRUNCATE ... RESTART IDENTITY CASCADE`. Faster than Respawn-checkpoints for our schema and works regardless of FK order.
3. **`Content:DisableCatalogSeeder` flag** so integration tests can opt out of the seeder running implicitly when the WebHost spins up. Set by `IntegrationTestsWebFactory` by default. Documented in the `CLAUDE.md` Phase-1.1 status section.
4. **`MapContentEndpoints(Action<RouteGroupBuilder>? configureAdminGroup)`** — extra overload accepting a callback so `Core` never imports `Microsoft.AspNetCore.Http`-side filter types. The architecture test enforces this.
5. **`AdminMapping` static helper class** inside `Features/Admin/CreateContentTask/` reused across all admin task endpoints (publish/archive/get/update). Keeps mapping in one place. Same for `CollectionAdminMapping` in `Features/Admin/CreateCollection/`.
6. **`ListTasksAdmin` paging defaults** to `size=50` (vs. `size=24` for the public list). Admin tools benefit from longer pages; both are bounded `[1, 100]`.
7. **Constraints/hints stored as one `TaskAsset` row per item.** Alternative was a single concatenated row + delimiter parsing. Per-row keeps ordering, makes future edit-by-id straightforward, and the public API already reduces them to `string[]` for the client.
8. **`Status` enums kept as separate enums** for `ContentTaskStatus` and `CollectionStatus` (rather than one shared enum). The lifecycle invariants differ in detail (collection publish requires ≥1 task; task publish requires four kinds of children) so coupling them risks future regression.
9. **`Package` left alive** — explicitly requested, but also concretely required because `Modules/Progress/EventHandlers/PackageCreatedHandler.cs` consumes the `PackageCreated` Wolverine event in the existing smoke integration test (`CreatePackageEndpointTests`). Removing it would break a passing test.
10. **No new NuGet packages.** Everything sits on EF Core 10 + Npgsql 10 + existing Wolverine wiring.

Known gaps deferred to follow-up plans (Phase 1.2+):

- Frontend rewiring to read from `/api/v1/tasks/` (Phase 1.2).
- A schema-cleanup migration that drops `packages` after Wolverine smoke is reworked off `PackageCreated`.
- Anti-abuse / rate limiting on the public catalog endpoints.
- Audit trail (`created_by`, `updated_by`) on admin mutations — left out because there's only one admin.
- Per-asset history / soft delete — admin replaces in bulk; old assets are gone.
- Background recomputation of `Topic.PublishedTaskCount` (currently computed per request in `ListTopicsAsync`; fine while N ≤ a few hundred topics × thousand tasks).

