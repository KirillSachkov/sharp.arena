# Roadmap

Phased rollout. Each phase is shippable on its own — no dead-end stubs.

## Phase 0 — bootstrap (this commit)

Scaffold only. Anyone clones the repo, runs `./scripts/dev.sh up`, and gets
a Postgres + backend + frontend up. Nothing visible to a user yet beyond a
landing page and a `/health` endpoint.

- [x] `backend/ArenaApi/` — projects compile with `TreatWarningsAsErrors`.
- [x] `GET /health` returns `{ "status": "ok" }`.
- [x] `frontend/` — Next.js 16 builds, lints clean, FSD layers enforced.
- [x] Landing page in Sharp Arena palette.
- [x] `docker compose up` brings up postgres + backend + frontend.
- [x] `docs/` — ARCHITECTURE, VISUAL, ROADMAP, art-style, ops.
- [x] `.claude/rules/` — conventions auto-loaded.
- [x] Modular monolith — 3 modules (Content/Execution/Progress) + IdentityStub.
- [x] Wolverine + RabbitMQ + Postgres durable outbox wired end-to-end.
- [x] Redis registered (not actively used yet).
- [ ] `runners/csharp/Dockerfile` — stub only (Phase 1 makes it real).

## Phase 1 — Arena MVP

End-to-end "user opens a task, writes code, hits Run, sees verdict" loop.

- [ ] Domain: `Package`, `Task`, `User` aggregates with `Guid.CreateVersion7()`.
- [ ] EF migrations for `arena.packages`, `arena.tasks`, `arena.users`,
      `arena.user_task_attempts`, `arena.user_task_progress`.
- [ ] Vertical slices: `Packages/ListPackages`, `Packages/GetPackageBySlug`,
      `Tasks/GetTask`, `Runs/SubmitRun`, `Runs/GetRunStatus`, `Me/GetMe`.
- [ ] Anonymous-cookie auth middleware (sets/reads `arena_uid`).
- [ ] `IRunner` + `CSharpRunner` (Docker spawn, output parsing).
- [ ] `runners/csharp/` — real Dockerfile + entrypoint that compiles & runs.
- [ ] Frontend: `/arena` package catalog, `/arena/tasks/[id]` Monaco editor,
      `VictoryOverlay` after pass, `use-run-code` hook with polling.
- [ ] Seed 1 package × 5 tasks to demo the loop.

## Phase 2 — Story mode

Split into four substages. Stage A ships now (this is the foundation).
Stages B and C land after Phase 1 is demoable.

### Phase 2A — Story design & frontend mock (this commit)

Specification + visual scaffold so we can iterate on UX before writing
production backend code. No new server endpoints, no DB tables.

- [ ] `docs/story-mode.md` — full Story spec (data model, API contracts,
      FSD frontend plan, content authoring, admin-UI scope).
- [ ] `ARCHITECTURE.md` updated: Story module row, `arena_story` schema,
      `/api/story/*` endpoint table.
- [ ] Frontend `entities/campaign`, `entities/act`, `entities/story-insert`
      with hardcoded fixtures. `entities/chapter` expanded.
- [ ] Frontend widgets: `story-campaign-list`, `story-map`,
      `story-chapter-panel`, `story-acts-bar`.
- [ ] `/story` page composes the four widgets in a 3-column + bottom-bar
      layout matching the reference mockup. Local React state for
      selected campaign / chapter.

### Phase 2B — Story backend (after Phase 1)

Pre-planning notes / open architecture questions:
[docs/superpowers/plans/2026-05-24-story-backend-design-brief.md](./superpowers/plans/2026-05-24-story-backend-design-brief.md).
Walk through those before spawning the implementation plan.

- [ ] `Modules/Story/` skeleton: `Domain/`, `Features/`, `Infrastructure/`,
      `Public/IStoryReader`. NetArchTest rule pins the boundary.
- [ ] `StoryDbContext` + initial EF migration creating all `arena_story.*`
      tables described in `story-mode.md`.
- [ ] Read endpoints: `GET /api/story/campaigns/`,
      `GET /api/story/campaigns/{slug}/`, `GET /api/story/chapters/{id}/`.
- [ ] Progress integration: `Modules/Progress/` adds
      `user_chapter_progress`, listens for `TaskPassed` integration event
      to advance chapter status.
- [ ] Hardcoded seed: 1 campaign (Основы C#) loaded on startup.

### Phase 2C — Admin UI for authoring (after 2B)

- [ ] Admin-only CRUD endpoints under `/api/admin/story/*` (campaigns,
      chapters, inserts, position drag, task linkage).
- [ ] Frontend `/admin/story/` route (gated by role) with map editor
      (drag chapter nodes to update positions) and rich-text editor for
      story inserts.

### Phase 2D — Cutscene player (after 2C)

- [ ] `widgets/cutscene-overlay` — fullscreen story-insert player with
      art + body markdown.
- [ ] Triggers: before chapter starts / after chapter completes / on
      manual "Смотреть вставку" click in chapter panel.

## Phase 3 — Multi-language

Prove the abstractions hold.

- [ ] `runners/typescript/` — Node-based runner, Jest harness.
- [ ] `ITestFormat` per language (xUnit vs Jest output shapes).
- [ ] Per-task `language` field already exists; UI selector now matters.
- [ ] Add 1 TypeScript package to validate the loop.

## Beyond Phase 3 (parking lot, not committed)

- Real auth (email / OAuth), migrating anonymous progress.
- Leaderboards with weekly resets, friends.
- Tutor LLM that hints based on failing tests.
- More languages: Python, Go, Rust.
- Code review mode — see other users' passing solutions after you pass.

## Working agreements during phases

- One phase = one PR series merged into `dev`, then a release-PR into `main`.
- Don't start Phase N+1 until Phase N is demoable end-to-end on a clean clone.
- Migrations are immutable once committed. New change → new migration.
