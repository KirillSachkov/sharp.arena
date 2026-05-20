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

Same engine, chapter-shaped shell.

- [ ] Domain: `Chapter`, `ChapterTask` entities, `UserChapterProgress`.
- [ ] EF migrations.
- [ ] Vertical slices: `Chapters/ListChapters`, `Chapters/GetChapter`.
- [ ] Gating: complete prerequisite chapter → unlock next.
- [ ] Frontend: `/story` map page (`@xyflow/react` or hand-rolled SVG),
      chapter detail page, transition animation between chapters.
- [ ] Seed 1 chapter with 3 tasks to demo gating.

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
