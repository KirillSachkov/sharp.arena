# Story Backend Architecture — Design Brief

Status: **not started.** Trigger when ready (Phase 1 MVP done — or earlier if
priorities pivot).

This is a **pre-planning doc**, not an implementation plan. It captures the
open architectural questions for the Story backend so the next session starts
from "what do we need to decide" instead of "where did we leave off." When
ready, this turns into a real implementation plan at
`docs/superpowers/plans/YYYY-MM-DD-story-backend.md`.

## Already decided (don't re-debate)

From [story-mode.md](../../story-mode.md) and Phase 2A (merged 2026-05-24):

- New module `Modules/Story/` with own Postgres schema `arena_story`. Not under Content.
- Public surface for other modules: `IStoryReader` in `Modules/Story/Public/`.
- Authoring is **admin-UI primary** + hardcoded seed for bootstrap. No YAML-from-disk loader.
- Cross-module:
  - Story reads tasks via `IContentReader` (sync).
  - Progress writes chapter status; Story listens to `TaskPassed` via Wolverine + RabbitMQ.
- Frontend rendering (already shipped in mock): HTML overlay on pixel-art map + SVG paths.

## Open architecture questions to work through

### 1. Storage shape & invariants

- Chapters → tasks: **cross-schema FK** (Postgres allows but unusual), or **uuid only** + read-time lookup via `IContentReader`? Trade-offs: integrity vs module independence. Current spec leans uuid-only — confirm.
- **Prerequisite cycles**: prevent at DB write (CHECK constraint, recursive CTE), enforce in domain on save, or trust the admin UI not to create them? What's the failure mode if a cycle slips in?
- **`map_paths` vs derived from `prerequisite_chapter_ids`**: keep both (spec does) — paths allow custom geometry (`geometry jsonb`), prereqs encode gating logic. Or collapse one into the other?
- **Chapter goals**: are they derived from passing tasks (no separate `chapter_goals` table) or explicit checkboxes stored per-user? Spec keeps both `chapter_goals` (definition) and `user_chapter_goal_progress` (state). Worth challenging — adds tables.

### 2. Module boundaries & event flow

- `arena_progress.user_chapter_progress` — owned by **Progress** module (current spec) or **Story**? Progress owns user_task_progress already; symmetric to keep chapter progress there too.
- Wolverine event contract `TaskPassed → Story`: minimum payload?
  - Option A: `{ userId, taskId }` — Story looks up which chapter(s) include the task.
  - Option B: `{ userId, taskId, chapterId? }` — publisher provides the chapter context.
  - Option A is purer (decouples publisher from Story); Option B avoids a join.
- **Idempotency**: if `TaskPassed` is delivered twice (Wolverine has at-least-once durable outbox), does the chapter-progress upsert stay correct? Need a uniqueness key, not just "increment counter".

### 3. Read API performance

- `GET /api/story/campaigns/{slug}/` returns campaign + acts + chapters + paths. ~50 rows for a 10-chapter campaign. Single joined query, or N+1-style with batched reads, or projected from a denormalized view?
- `GET /api/story/chapters/{id}/` is read-heavy: chapter + goals + tasks (cross-module via `IContentReader`) + inserts + rewards + per-user progress (cross-module via `IProgressReader`). Latency budget? When do we cache via HybridCache (already wired but unused)?
- Catalog endpoints are publicly cacheable (anonymous users see the same thing); user-personalized fields (status, percent, goal completion) must NOT be cached at the same layer. Two-tier projection?

### 4. Migrations & content lifecycle

- Initial migration creates all `arena_story.*` tables in one shot — confirm vs splitting per-table (CLAUDE.md says "Never modify existing EF migrations; add corrective"). Single initial migration is fine.
- **Seeding**: separate seeder service (runs on startup if empty), or part of the initial migration? Spec leans separate seeder.
- **Schema evolution under runtime authoring**: if admin UI inserts a campaign, then we add a new chapter column later — does authored content survive (default value or backfill)? Test plan needs to cover this.

### 5. Admin UI surface (Phase 2C scope)

- Role gating: `IdentityStub` for now (manual `appsettings:Admin:UserIds`?), real role-based when SSO arrives. Don't over-engineer the gate.
- Rich-text for `story_inserts.body_md`: WYSIWYG (TipTap, Lexical) or plain markdown textarea? Markdown is cheaper and ships sooner.
- Map editor: drag-and-drop of chapter nodes (`PUT /api/admin/story/chapters/{id}/position/`) is in scope; drawing custom curved paths is **probably out** — keep paths auto-derived from prereqs unless we discover we need curves.
- Image assets: where do `node_asset`, `art_asset`, `map_background_asset` files live? S3-compatible bucket? Filesystem on the VPS? Phase 2C decision, but worth thinking now.

### 6. Testing strategy

- Integration tests against a real Postgres (no mocks) — convention per `.claude/rules/integration-tests.md`.
- Architecture tests: `NetArchTest` rule that pins Story's public surface (only `Modules/Story/Public/*` visible to other modules).
- Message contract tests: `TaskPassed` envelope roundtrip via Wolverine inbox/outbox (see `.claude/rules/messaging-tests.md`).
- Read endpoints: snapshot tests against the seeded demo campaign.

## References

- [docs/story-mode.md](../../story-mode.md) — full spec (data model, API, FSD)
- [docs/ARCHITECTURE.md](../../ARCHITECTURE.md) — module conventions, communication paths
- [docs/ROADMAP.md](../../ROADMAP.md) — Phase 2B / 2C / 2D scope
- [docs/superpowers/plans/2026-05-24-story-mode-foundation.md](./2026-05-24-story-mode-foundation.md) — executed Phase 2A plan
- `.claude/rules/db-migrations.md`, `db-transactions.md`, `messaging-tests.md`, `integration-tests.md` — conventions to respect

## When to spawn the real plan

Trigger conditions:
- Phase 1 (Arena MVP) is demoable end-to-end, **or**
- Priorities pivot to Story-first.

Process when triggered:
1. Read this brief + `story-mode.md`.
2. Walk through the questions above with the user; record decisions in
   `story-mode.md` (update the "Open questions" section there).
3. Run `writing-plans` skill → `docs/superpowers/plans/YYYY-MM-DD-story-backend.md`.
4. Execute via `subagent-driven-development` in a fresh worktree.
