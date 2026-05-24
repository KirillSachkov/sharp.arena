# Story Mode Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock Story-mode architecture (docs + data model) and ship an interactive visual mock of `/story` page that matches the reference mockup — no backend code in this plan; backend lands after Phase 1 (Arena MVP).

**Architecture:** New `Story` module with its own `arena_story` Postgres schema (designed but not built). Frontend mock uses hardcoded fixtures in `entities/` layer and renders four widgets (campaign sidebar, pixel map, chapter panel, acts bar) composed by `app/story/page.tsx`. State (selected campaign, selected chapter) is local React state; no API client yet.

**Tech Stack:** Markdown (docs), TypeScript, React 19, Next.js 16 App Router, Tailwind 4, `lucide-react` icons. Backend spec uses C# 12 / .NET 9 / EF Core / Wolverine conventions already established in the repo.

---

## Scope boundaries

**In scope (this plan):**
- Revise `docs/ARCHITECTURE.md` to introduce the Story module + arena_story schema (planned, not implemented).
- Revise `docs/ROADMAP.md` to split Phase 2 into substages.
- Write `docs/story-mode.md` — full Story spec (data model, API contracts, FSD plan, admin-UI scope, authoring model).
- Frontend: expand `entities/chapter`, add `entities/campaign`, `entities/act`, `entities/story-insert` with hardcoded fixtures.
- Frontend: build 4 widgets (`story-campaign-list`, `story-map`, `story-chapter-panel`, `story-acts-bar`).
- Frontend: replace `app/story/page.tsx` with the new composed layout matching the reference.

**Out of scope (deferred):**
- Backend Story module code (entities, DbContext, migrations, handlers, endpoints).
- Admin UI for content authoring.
- Cutscene player overlay (designed but not built).
- Real pixel-art map background (placeholder CSS pattern is used).
- Chapter detail / play routes (`/story/[campaignSlug]/chapter/[chapterSlug]`).
- Connecting frontend to real API.

---

## File map

**Docs (modified):**
- `docs/ARCHITECTURE.md` — add Story module row, `arena_story` schema, planned tables.
- `docs/ROADMAP.md` — split Phase 2.

**Docs (created):**
- `docs/story-mode.md` — full Story spec.

**Frontend entities (modified):**
- `frontend/src/entities/chapter/types.ts` — expand with `ChapterDetail`, `ChapterGoal`, `ChapterReward`, `MapPosition`.
- `frontend/src/entities/chapter/index.ts` — export new types + mock.

**Frontend entities (created):**
- `frontend/src/entities/campaign/types.ts`
- `frontend/src/entities/campaign/index.ts`
- `frontend/src/entities/act/types.ts`
- `frontend/src/entities/act/index.ts`
- `frontend/src/entities/story-insert/types.ts`
- `frontend/src/entities/story-insert/index.ts`
- `frontend/src/entities/campaign/mock.ts` — the single fixture (1 campaign × 4 acts × 10 chapters + 2 inserts) re-exported from `index.ts`.

**Frontend widgets (created):**
- `frontend/src/widgets/story-campaign-list/index.tsx`
- `frontend/src/widgets/story-map/index.tsx`
- `frontend/src/widgets/story-map/chapter-node.tsx` (helper)
- `frontend/src/widgets/story-map/map-paths.tsx` (helper, SVG overlay)
- `frontend/src/widgets/story-chapter-panel/index.tsx`
- `frontend/src/widgets/story-acts-bar/index.tsx`

**Frontend pages (modified):**
- `frontend/src/app/story/page.tsx` — full rewrite, composes the 4 widgets.

**Frontend shared (modified, if needed):**
- `frontend/src/shared/types/status.ts` — add `CampaignStatus` if missing.

---

## Task 1: Revise `docs/ARCHITECTURE.md` — introduce Story module

**Files:**
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Add `Story` row to the module table (lines ~66-71)**

In the modular-monolith table, after `Content`, add:

```markdown
| Story         | `arena_story`      | Campaigns, acts, chapters, story inserts, map layouts |
```

Update the line directly below the table that reads "Phase 0 implements **Content** fully and ships **Execution** and **Progress** as skeletons" to mention Story is **designed only** (no DbContext yet):

```markdown
Phase 0 implements **Content** fully and ships **Execution** and **Progress**
as skeletons (DbContext + outbox service only). **IdentityStub** is fully
wired but currently unused by callers. **Story** is specified in
[story-mode.md](./story-mode.md) but no code lands until Phase 2.
```

- [ ] **Step 2: Replace "## 1. One engine, two shells" section**

Replace the existing section (lines 5-10) with:

```markdown
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
```

- [ ] **Step 3: Add `arena_story` row to the schemas table (lines ~157-163)**

In the per-module schemas table, after `arena_content`, add:

```markdown
| `arena_story`       | Story         | _none yet — designed only, lands in Phase 2_          |
```

- [ ] **Step 4: Replace the Phase 1 data-model block's chapter tables**

In the "### Phase 1 data model (planned)" block (lines ~165-198), **remove** these two lines:

```
arena_content.chapters
  id, slug, title, ordering, story_md, prerequisite_chapter_id,
  map_position_x, map_position_y, preview_asset, is_published

arena_content.chapter_tasks
  chapter_id, task_id, ordering
```

…and **remove** the `user_chapter_progress` row from `arena_progress`. These move into the Story spec.

Add a one-line pointer right after the Content block:

```
# Story tables: see story-mode.md (Phase 2 data model in arena_story schema)
```

- [ ] **Step 5: Add `/api/story/*` endpoints to the planned API table**

In the "Planned (Phase 1+)" table (lines ~216-227), **remove** the two chapter rows (`GET /api/chapters/` and `GET /api/chapters/{id}/`).

Replace them with:

```markdown
| GET    | `/api/story/campaigns/`               | List campaigns (filterable)                         |
| GET    | `/api/story/campaigns/{slug}/`        | Campaign detail: acts + chapters + map paths        |
| GET    | `/api/story/chapters/{id}/`           | Chapter detail: tasks + goals + inserts + rewards   |
```

Add a sub-table header below for admin endpoints:

```markdown
Admin (Phase 2, role-gated):

| Method | Path                                          | Purpose                                  |
| ------ | --------------------------------------------- | ---------------------------------------- |
| POST   | `/api/admin/story/campaigns/`                 | Create campaign                          |
| PUT    | `/api/admin/story/campaigns/{id}/`            | Update campaign                          |
| POST   | `/api/admin/story/chapters/`                  | Create chapter                           |
| PUT    | `/api/admin/story/chapters/{id}/`             | Update chapter                           |
| PUT    | `/api/admin/story/chapters/{id}/position/`    | Drag-to-update map position              |
| POST   | `/api/admin/story/inserts/`                   | Create story insert (cutscene)           |
```

- [ ] **Step 6: Verify Markdown parses cleanly**

Run: `npx --yes markdownlint-cli2 docs/ARCHITECTURE.md` (if installed) or just open in the editor and skim. Expected: no broken table syntax.

- [ ] **Step 7: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs(arch): introduce Story module + arena_story schema, point to story-mode.md"
```

---

## Task 2: Revise `docs/ROADMAP.md` — split Phase 2

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Replace the existing "## Phase 2 — Story mode" block**

Replace lines 39-49 with:

```markdown
## Phase 2 — Story mode

Split into three substages. Stage A ships now (this is the foundation).
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): split Phase 2 into Story design/backend/admin/cutscene substages"
```

---

## Task 3: Write `docs/story-mode.md` — the full Story spec

**Files:**
- Create: `docs/story-mode.md`

- [ ] **Step 1: Create the spec document**

Create `docs/story-mode.md` with the following exact content:

````markdown
# Story mode — spec

Status: **designed, not yet built.** Phase 2 ships the implementation in
substages (see [ROADMAP.md](./ROADMAP.md)).

## What Story mode is

Story mode is a narrative shell around the same task engine that Arena
uses. A user picks a **campaign** ("Основы C#", "Основы TypeScript",
"Мастер HTTP", …), opens its interactive map, and progresses through
**chapters** — each chapter is a small group of tasks plus optional
**story inserts** (cutscenes with art and prose). Chapters are grouped
into **acts** for pacing. Chapter gating creates the narrative path: a
chapter unlocks once its prerequisites are completed.

The look-and-feel target is a pixel-RPG world map à la Heroes of Might
and Magic — see the reference mockup in `docs/art-style.md` (Story
section) for the visual direction.

## Module placement

Story is a **new module**: `Modules/Story/` with its own
`StoryDbContext` and `arena_story` Postgres schema. It does **not** live
under `Content` — Story owns campaign/act/chapter narrative structure
and gating, while Content keeps owning packages, tasks, and hints.
Story reads tasks through `IContentReader` (the existing public surface
of Content).

Cross-module communication:

| Direction              | Mechanism                          | Why                                            |
| ---------------------- | ---------------------------------- | ---------------------------------------------- |
| Story → Content        | sync read via `IContentReader`     | Chapter needs task titles/difficulty for view  |
| Story → Progress       | sync read via `IProgressReader`    | Chapter needs per-user completion status       |
| Progress → Story       | integration event `TaskPassed`     | Update `user_chapter_progress` on task success |
| Story → frontend       | `GET /api/story/*` endpoints       | Read-only catalog/projection                   |
| Admin frontend → Story | `POST/PUT /api/admin/story/*`      | Role-gated CRUD (Phase 2C)                     |

## Data model (`arena_story` schema)

All PKs use `Guid.CreateVersion7()`. All `slug` columns are URL-safe
ASCII. All `*_md` columns are CommonMark.

```text
arena_story.campaigns
  id                   uuid v7   PK
  slug                 text      UNIQUE
  title                text
  subtitle             text      NULLABLE
  description_md       text
  icon_asset           text      NULLABLE   -- pixel-art slot e.g. "icon/campaign-csharp"
  banner_asset         text      NULLABLE
  map_background_asset text      NULLABLE   -- pixel-art map background
  language             text                 -- "csharp", "typescript", "http", …
  ordering             int
  is_published         bool
  unlock_after_campaign_id  uuid NULLABLE FK self  -- chain campaigns
  created_at, updated_at

arena_story.acts
  id           uuid v7   PK
  campaign_id  uuid      FK campaigns.id
  slug         text
  title        text
  ordering     int
  UNIQUE (campaign_id, slug)

arena_story.chapters
  id                   uuid v7   PK
  act_id               uuid      FK acts.id
  slug                 text
  title                text
  summary              text                     -- 1–2 sentences for the panel
  ordering             int
  difficulty           text                     -- easy | medium | hard | boss
  estimated_minutes    int
  recommended_xp       int                      -- "+30 XP" label on panel
  xp_reward            int                      -- XP granted on completion
  node_type            text                     -- regular | boss | gate
  node_asset           text      NULLABLE       -- pixel-art slot for map node
  node_tone            text      NULLABLE       -- primary | gold | cyan | green | red
  map_x                int                      -- 0..mapBackgroundWidth
  map_y                int                      -- 0..mapBackgroundHeight
  skills               text[]                   -- skill chip tags: ["ООП","Классы"]
  is_published         bool
  UNIQUE (act_id, slug)

arena_story.chapter_prerequisites
  chapter_id              uuid FK chapters.id
  prerequisite_chapter_id uuid FK chapters.id
  PRIMARY KEY (chapter_id, prerequisite_chapter_id)

arena_story.chapter_goals
  id          uuid v7  PK
  chapter_id  uuid     FK chapters.id
  label       text
  ordering    int

arena_story.chapter_tasks
  chapter_id  uuid    FK chapters.id
  task_id     uuid                            -- cross-schema; no FK
  ordering    int
  PRIMARY KEY (chapter_id, task_id)

arena_story.chapter_rewards
  id           uuid v7  PK
  chapter_id   uuid     FK chapters.id
  reward_type  text                            -- xp | gem | trophy | chest | title
  amount       int      NULLABLE
  asset        text     NULLABLE
  ordering     int

arena_story.story_inserts
  id          uuid v7  PK
  chapter_id  uuid     FK chapters.id
  position    text                             -- before | after
  title       text
  body_md     text
  art_asset   text     NULLABLE
  ordering    int

arena_story.map_paths
  id               uuid v7  PK
  campaign_id      uuid     FK campaigns.id
  from_chapter_id  uuid     FK chapters.id
  to_chapter_id    uuid     FK chapters.id
  style            text                       -- solid | dashed
  geometry         jsonb    NULLABLE          -- optional control points {points:[{x,y}…]}
```

### Progress tables (live in `arena_progress`)

```text
arena_progress.user_campaign_progress
  user_id, campaign_id, unlocked_at, completed_at

arena_progress.user_chapter_progress
  user_id, chapter_id, status, unlocked_at, started_at, completed_at
    status: locked | available | in_progress | completed

arena_progress.user_chapter_goal_progress
  user_id, chapter_id, goal_id, completed_at
```

Status derivation: `locked` until prerequisites met → `available` when
prerequisites done but no task attempted → `in_progress` on first task
attempt → `completed` when all `chapter_tasks` passed AND all
`chapter_goals` checked (or only when all tasks pass, if goals are
auto-derived from task completion; decide during Phase 2B
implementation).

## API contracts

### User-facing reads (Phase 2B)

`GET /api/story/campaigns/`

```jsonc
{
  "campaigns": [
    {
      "id": "uuid", "slug": "csharp-basics",
      "title": "Основы C#", "iconAsset": "icon/campaign-csharp",
      "language": "csharp", "ordering": 1,
      "isLocked": false,
      "progress": { "chaptersCompleted": 6, "chaptersTotal": 10, "percent": 60 }
    },
    …
  ]
}
```

`GET /api/story/campaigns/{slug}/`

```jsonc
{
  "campaign": { "id": "uuid", "slug": "…", "title": "…",
                "subtitle": "…", "descriptionMd": "…",
                "mapBackgroundAsset": "banner/map-csharp" },
  "acts":     [ { "id": "uuid", "slug": "act-i", "title": "Основы языка",
                  "ordering": 1, "percent": 100 }, … ],
  "chapters": [ { "id": "uuid", "actId": "uuid", "slug": "variables",
                  "index": 1, "title": "Переменные и типы",
                  "difficulty": "easy", "xpReward": 10,
                  "nodeType": "regular", "nodeTone": "green",
                  "mapPosition": { "x": 240, "y": 360 },
                  "status": "completed",
                  "prerequisiteChapterIds": [] }, … ],
  "mapPaths": [ { "fromChapterId": "uuid", "toChapterId": "uuid",
                  "style": "solid" }, … ]
}
```

`GET /api/story/chapters/{id}/`

```jsonc
{
  "chapter": {
    "id": "uuid", "slug": "…", "title": "ООП",
    "summary": "Пора разобраться, как создавать свои типы…",
    "difficulty": "medium", "estimatedMinutes": 50,
    "recommendedXp": 30, "xpReward": 30,
    "skills": ["Основы", "ООП", "Классы", "Объекты"],
    "nodeType": "regular", "nodeTone": "primary",
    "mapPosition": { "x": 620, "y": 380 },
    "status": "in_progress",
    "progressPercent": 60
  },
  "goals":   [ { "id": "uuid", "label": "Создать класс…",
                 "completed": true }, … ],
  "tasks":   [ { "id": "uuid", "slug": "…", "title": "…",
                 "difficulty": "easy", "status": "passed" }, … ],
  "rewards": [ { "rewardType": "xp",    "amount": 30 },
               { "rewardType": "gem",   "amount": 150 },
               { "rewardType": "trophy" },
               { "rewardType": "chest" } ],
  "inserts": [ { "id": "uuid", "position": "before", "title": "…",
                 "artAsset": "banner/insert-7" } ]
}
```

### Admin CRUD (Phase 2C)

Role gated to `admin` users. All endpoints under `/api/admin/story/*`:

| Method | Path                                          | Body / Notes                                     |
| ------ | --------------------------------------------- | ------------------------------------------------ |
| POST   | `/api/admin/story/campaigns/`                 | Create campaign                                  |
| PUT    | `/api/admin/story/campaigns/{id}/`            | Update campaign                                  |
| POST   | `/api/admin/story/campaigns/{id}/acts/`       | Create act                                       |
| POST   | `/api/admin/story/acts/{id}/chapters/`        | Create chapter inside act                        |
| PUT    | `/api/admin/story/chapters/{id}/`             | Update chapter                                   |
| PUT    | `/api/admin/story/chapters/{id}/position/`    | `{ x, y }` — drag-to-update on map editor        |
| POST   | `/api/admin/story/chapters/{id}/goals/`       | Add goal                                         |
| POST   | `/api/admin/story/chapters/{id}/tasks/`       | Link existing task: `{ taskId, ordering }`       |
| POST   | `/api/admin/story/chapters/{id}/inserts/`     | Add story insert (cutscene)                      |
| POST   | `/api/admin/story/map-paths/`                 | Create path between two chapters                 |

## Content authoring model

**Hybrid: admin-UI primary, file seed as bootstrap.**

- Phase 2B ships a hardcoded seed in `Modules/Story/Infrastructure/Seeding/`
  that creates 1 demo campaign on startup if `arena_story.campaigns` is
  empty. This unblocks Phase 2A frontend integration before the admin UI
  is built.
- Phase 2C is the primary authoring path: admins create / edit
  campaigns, acts, chapters, inserts, drag map nodes, link tasks.
- No YAML-from-disk loader. (Considered and rejected to keep one source
  of truth — the database.)

## Frontend FSD plan

```text
src/
  app/
    story/
      page.tsx                            # /story — campaign chooser + active campaign view
      [campaignSlug]/
        page.tsx                          # deep link to a single campaign (Phase 2B+)
        chapter/[chapterSlug]/page.tsx    # chapter detail/play (Phase 2B+)
  widgets/
    story-campaign-list/                  # left sidebar
    story-map/                            # center — pixel map + nodes + paths
    story-chapter-panel/                  # right sidebar
    story-acts-bar/                       # bottom — 4 act cards
    cutscene-overlay/                     # Phase 2D — full-screen insert player
  features/
    select-campaign/                      # use-select-campaign.ts (state only)
    select-chapter/                       # use-select-chapter.ts
    start-chapter/                        # use-start-chapter.ts (Phase 2B+)
  entities/
    campaign/                             # CampaignSummary + mock
    act/                                  # ActSummary
    chapter/                              # ChapterSummary (exists) + ChapterDetail
    story-insert/                         # StoryInsert
```

Page composition (no business state in widgets — page owns it):

```tsx
// app/story/page.tsx — sketch
const [selectedCampaignSlug, setSelectedCampaignSlug] = useState(…);
const [selectedChapterId,    setSelectedChapterId]    = useState(…);
…
<div className="grid grid-cols-[280px_1fr_320px] gap-4">
  <StoryCampaignList
    campaigns={…}
    selectedSlug={selectedCampaignSlug}
    onSelect={setSelectedCampaignSlug} />
  <StoryMap
    campaign={…}
    chapters={…}
    paths={…}
    selectedChapterId={selectedChapterId}
    onSelectChapter={setSelectedChapterId} />
  <StoryChapterPanel
    chapter={…}
    goals={…}
    rewards={…}
    insert={…} />
</div>
<StoryActsBar acts={…} />
```

## Map rendering choice

**HTML overlay on pre-rendered pixel-art background.**

- The map background is a single PNG (e.g. `public/art/banner/map-csharp.png`,
  ~1280×720 source, scaled with `image-rendering: pixelated`).
- Chapter nodes are React components absolutely positioned via inline
  `style={{ left: mapX, top: mapY }}` percentages.
- Paths between nodes are drawn in a single SVG overlay sitting between
  the background image and the node layer. Default geometry is a
  straight line; chapters can override with `geometry.points` for curves.
- Zoom controls and centering shown on the reference are deferred to a
  later iteration (just static map in 2A).

**Rejected alternatives:**
- `@xyflow/react` — too generic, doesn't fit pixel-art aesthetic.
- PixiJS / Phaser canvas — overkill for static positioning; defer until
  we add a moving character pawn (post Phase 2D).

## Admin UI sketch (Phase 2C reference)

- `/admin/story/` — campaigns table (CRUD).
- `/admin/story/[campaignSlug]/` — act/chapter tree + map editor.
- Map editor: same `StoryMap` component but with `editable` prop;
  dragging a node calls `PUT /api/admin/story/chapters/{id}/position/`.
- Chapter form: title/summary/difficulty/skills/goals/rewards/tasks.
  Tasks picker queries existing Content tasks via existing endpoint.
- Insert editor: title + markdown body + art asset picker.

## Open questions (decide before Phase 2B)

- **Goal completion**: auto-derived from passing tasks, or explicit
  user-checked? (Spec assumes explicit checkboxes for now.)
- **Replay rule**: once a chapter is `completed`, can the user re-enter
  and re-attempt tasks for higher XP? (Spec assumes yes — "Повторить
  главу" button on right panel.)
- **Cross-campaign gating**: campaigns can chain
  (`unlock_after_campaign_id`) but how does the dependency surface in
  the campaign list? (TS basics is locked until C# basics 50% done?)
````

- [ ] **Step 2: Commit**

```bash
git add docs/story-mode.md
git commit -m "docs: add Story mode spec (data model, API, FSD plan, admin scope)"
```

---

## Task 4: Expand `entities/chapter` with detail types

**Files:**
- Modify: `frontend/src/entities/chapter/types.ts`
- Modify: `frontend/src/entities/chapter/index.ts`

- [ ] **Step 1: Replace `frontend/src/entities/chapter/types.ts` with the expanded model**

```ts
import type { ChapterStatus } from "@/shared/types";

export type ChapterDifficulty = "easy" | "medium" | "hard" | "boss";

export type ChapterNodeType = "regular" | "boss" | "gate";

export type ChapterNodeTone =
  | "primary"
  | "gold"
  | "cyan"
  | "green"
  | "red";

export type MapPosition = {
  /** Percent of map width (0..100) — keeps positioning resolution-agnostic. */
  x: number;
  /** Percent of map height (0..100). */
  y: number;
};

export type ChapterGoal = {
  id: string;
  label: string;
  completed: boolean;
};

export type ChapterRewardType = "xp" | "gem" | "trophy" | "chest" | "title";

export type ChapterReward = {
  type: ChapterRewardType;
  /** Numeric value for xp/gem rewards; undefined for trophy/chest/title. */
  amount?: number;
  /** Optional pixel-art slot. */
  asset?: string;
  label?: string;
};

export type ChapterSummary = {
  id: string;
  actId: string;
  slug: string;
  /** 1-based index used in node label and panel title. */
  index: number;
  title: string;
  status: ChapterStatus;
  xpReward: number;
  nodeType: ChapterNodeType;
  nodeTone?: ChapterNodeTone;
  /** Pixel-art slot for the map node (resolves to public/art/<slot>.png). */
  nodeAsset?: string;
  mapPosition: MapPosition;
  prerequisiteChapterIds: string[];
};

export type ChapterDetail = ChapterSummary & {
  summary: string;
  difficulty: ChapterDifficulty;
  estimatedMinutes: number;
  recommendedXp: number;
  skills: string[];
  goals: ChapterGoal[];
  rewards: ChapterReward[];
  /** 0..100 — progress within an in-progress chapter. */
  progressPercent: number;
};
```

- [ ] **Step 2: Update `frontend/src/entities/chapter/index.ts`**

Replace its content with:

```ts
export type {
  ChapterSummary,
  ChapterDetail,
  ChapterGoal,
  ChapterReward,
  ChapterRewardType,
  ChapterDifficulty,
  ChapterNodeType,
  ChapterNodeTone,
  MapPosition,
} from "./types";
```

(The `MOCK_CHAPTERS` re-export is **removed** — the new single fixture in `entities/campaign/mock.ts` replaces it.)

- [ ] **Step 3: Verify nothing else depended on `MOCK_CHAPTERS`**

Run: `grep -rn "MOCK_CHAPTERS" frontend/src`
Expected: only matches in the path we're about to rewrite (`app/story/page.tsx`).

- [ ] **Step 4: Type-check**

Run: `cd frontend && npm run lint`
Expected: `app/story/page.tsx` errors (it still imports `MOCK_CHAPTERS`). This is fine — Task 13 rewrites it. Other files: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/entities/chapter/types.ts frontend/src/entities/chapter/index.ts
git commit -m "feat(entities/chapter): split into ChapterSummary + ChapterDetail with goals/rewards"
```

(The lint failure in `app/story/page.tsx` is intentional — fixed in Task 13. We commit anyway because each task should be a small step.)

---

## Task 5: Add `entities/act`

**Files:**
- Create: `frontend/src/entities/act/types.ts`
- Create: `frontend/src/entities/act/index.ts`

- [ ] **Step 1: Create `frontend/src/entities/act/types.ts`**

```ts
export type ActStatus = "locked" | "available" | "in-progress" | "completed";

export type ActSummary = {
  id: string;
  campaignId: string;
  slug: string;
  /** 1-based index. */
  index: number;
  title: string;
  subtitle?: string;
  status: ActStatus;
  /** 0..100 — derived from chapter completion within the act. */
  percent: number;
};
```

- [ ] **Step 2: Create `frontend/src/entities/act/index.ts`**

```ts
export type { ActSummary, ActStatus } from "./types";
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/entities/act
git commit -m "feat(entities/act): add ActSummary type for campaign acts"
```

---

## Task 6: Add `entities/campaign`

**Files:**
- Create: `frontend/src/entities/campaign/types.ts`
- Create: `frontend/src/entities/campaign/index.ts`

- [ ] **Step 1: Create `frontend/src/entities/campaign/types.ts`**

```ts
import type { ChapterDetail, ChapterSummary } from "@/entities/chapter";
import type { ActSummary } from "@/entities/act";
import type { StoryInsert } from "@/entities/story-insert";

export type CampaignStatus = "locked" | "available" | "in-progress" | "completed";

export type CampaignSummary = {
  id: string;
  slug: string;
  /** Short language tag rendered in the campaign card chip (e.g. "C#", "TS"). */
  languageTag: string;
  title: string;
  status: CampaignStatus;
  chaptersCompleted: number;
  chaptersTotal: number;
  /** 0..100 derived from chapters. */
  percent: number;
  iconAsset?: string;
};

export type MapPath = {
  id: string;
  fromChapterId: string;
  toChapterId: string;
  style: "solid" | "dashed";
};

export type CampaignDetail = CampaignSummary & {
  subtitle?: string;
  descriptionMd: string;
  mapBackgroundAsset?: string;
  acts: ActSummary[];
  chapters: ChapterSummary[];
  /** Used by the right panel when a single chapter is selected. */
  chapterDetailsById: Record<string, ChapterDetail>;
  /** Insert previews keyed by chapter id. */
  insertsByChapterId: Record<string, StoryInsert[]>;
  mapPaths: MapPath[];
};
```

- [ ] **Step 2: Create `frontend/src/entities/campaign/index.ts`**

```ts
export type {
  CampaignSummary,
  CampaignDetail,
  CampaignStatus,
  MapPath,
} from "./types";
export { MOCK_CAMPAIGNS, MOCK_CAMPAIGN_DETAILS } from "./mock";
```

(The mock module is created in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/entities/campaign/types.ts frontend/src/entities/campaign/index.ts
git commit -m "feat(entities/campaign): add CampaignSummary, CampaignDetail, MapPath types"
```

---

## Task 7: Add `entities/story-insert`

**Files:**
- Create: `frontend/src/entities/story-insert/types.ts`
- Create: `frontend/src/entities/story-insert/index.ts`

- [ ] **Step 1: Create `frontend/src/entities/story-insert/types.ts`**

```ts
export type StoryInsertPosition = "before" | "after";

export type StoryInsert = {
  id: string;
  chapterId: string;
  position: StoryInsertPosition;
  title: string;
  /** Plain-text preview shown in the right panel. */
  preview: string;
  artAsset?: string;
};
```

- [ ] **Step 2: Create `frontend/src/entities/story-insert/index.ts`**

```ts
export type { StoryInsert, StoryInsertPosition } from "./types";
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/entities/story-insert
git commit -m "feat(entities/story-insert): add StoryInsert type"
```

---

## Task 8: Build the single Story fixture

**Files:**
- Create: `frontend/src/entities/campaign/mock.ts`

This task owns the entire visual reference. Numbers and labels come from the
reference mockup (`docs/superpowers/plans/2026-05-24-story-mode-foundation.md`
context: Основы C# campaign with 10 chapters and 4 acts).

- [ ] **Step 1: Create `frontend/src/entities/campaign/mock.ts`**

```ts
import type { ChapterDetail, ChapterSummary } from "@/entities/chapter";
import type { ActSummary } from "@/entities/act";
import type { StoryInsert } from "@/entities/story-insert";
import type {
  CampaignDetail,
  CampaignSummary,
  MapPath,
} from "./types";

const CSHARP_ACTS: ActSummary[] = [
  {
    id: "act-1",
    campaignId: "campaign-csharp",
    slug: "act-1",
    index: 1,
    title: "Акт I",
    subtitle: "Основы языка",
    status: "completed",
    percent: 100,
  },
  {
    id: "act-2",
    campaignId: "campaign-csharp",
    slug: "act-2",
    index: 2,
    title: "Акт II",
    subtitle: "Структуры и логика",
    status: "completed",
    percent: 83,
  },
  {
    id: "act-3",
    campaignId: "campaign-csharp",
    slug: "act-3",
    index: 3,
    title: "Акт III",
    subtitle: "Объектная модель",
    status: "in-progress",
    percent: 33,
  },
  {
    id: "act-4",
    campaignId: "campaign-csharp",
    slug: "act-4",
    index: 4,
    title: "Акт IV",
    subtitle: "Веб и API",
    status: "locked",
    percent: 0,
  },
];

const CSHARP_CHAPTERS: ChapterSummary[] = [
  {
    id: "ch-1", actId: "act-1", slug: "variables", index: 1,
    title: "Переменные и типы", status: "completed", xpReward: 10,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 18, y: 36 }, prerequisiteChapterIds: [],
  },
  {
    id: "ch-2", actId: "act-1", slug: "conditions", index: 2,
    title: "Условия", status: "completed", xpReward: 10,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 34, y: 30 }, prerequisiteChapterIds: ["ch-1"],
  },
  {
    id: "ch-3", actId: "act-1", slug: "loops", index: 3,
    title: "Циклы", status: "completed", xpReward: 20,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 52, y: 34 }, prerequisiteChapterIds: ["ch-2"],
  },
  {
    id: "ch-4", actId: "act-2", slug: "methods", index: 4,
    title: "Методы", status: "completed", xpReward: 20,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 56, y: 50 }, prerequisiteChapterIds: ["ch-3"],
  },
  {
    id: "ch-5", actId: "act-2", slug: "collections", index: 5,
    title: "Коллекции", status: "completed", xpReward: 20,
    nodeType: "regular", nodeTone: "green",
    mapPosition: { x: 48, y: 60 }, prerequisiteChapterIds: ["ch-4"],
  },
  {
    id: "ch-6", actId: "act-2", slug: "linq", index: 6,
    title: "LINQ", status: "in-progress", xpReward: 25,
    nodeType: "regular", nodeTone: "cyan",
    mapPosition: { x: 36, y: 64 }, prerequisiteChapterIds: ["ch-5"],
  },
  {
    id: "ch-7", actId: "act-3", slug: "oop", index: 7,
    title: "ООП", status: "in-progress", xpReward: 30,
    nodeType: "regular", nodeTone: "primary",
    mapPosition: { x: 26, y: 70 }, prerequisiteChapterIds: ["ch-6"],
  },
  {
    id: "ch-8", actId: "act-3", slug: "async", index: 8,
    title: "Async/await", status: "locked", xpReward: 35,
    nodeType: "regular",
    mapPosition: { x: 18, y: 76 }, prerequisiteChapterIds: ["ch-7"],
  },
  {
    id: "ch-9", actId: "act-4", slug: "aspnet", index: 9,
    title: "ASP.NET Core", status: "locked", xpReward: 40,
    nodeType: "regular",
    mapPosition: { x: 42, y: 84 }, prerequisiteChapterIds: ["ch-8"],
  },
  {
    id: "ch-10", actId: "act-4", slug: "boss", index: 10,
    title: "Финальный босс", status: "locked", xpReward: 100,
    nodeType: "boss", nodeTone: "red",
    mapPosition: { x: 80, y: 80 }, prerequisiteChapterIds: ["ch-9"],
  },
];

const CSHARP_PATHS: MapPath[] = [
  { id: "p-1-2", fromChapterId: "ch-1", toChapterId: "ch-2", style: "solid" },
  { id: "p-2-3", fromChapterId: "ch-2", toChapterId: "ch-3", style: "solid" },
  { id: "p-3-4", fromChapterId: "ch-3", toChapterId: "ch-4", style: "solid" },
  { id: "p-4-5", fromChapterId: "ch-4", toChapterId: "ch-5", style: "solid" },
  { id: "p-5-6", fromChapterId: "ch-5", toChapterId: "ch-6", style: "solid" },
  { id: "p-6-7", fromChapterId: "ch-6", toChapterId: "ch-7", style: "solid" },
  { id: "p-7-8", fromChapterId: "ch-7", toChapterId: "ch-8", style: "dashed" },
  { id: "p-8-9", fromChapterId: "ch-8", toChapterId: "ch-9", style: "dashed" },
  { id: "p-9-10", fromChapterId: "ch-9", toChapterId: "ch-10", style: "dashed" },
];

const CSHARP_CHAPTER_DETAIL_OOP: ChapterDetail = {
  ...CSHARP_CHAPTERS[6]!,
  summary:
    "Пора разобраться, как создавать свои типы и строить гибкие, переиспользуемые системы с помощью принципов ООП.",
  difficulty: "medium",
  estimatedMinutes: 50,
  recommendedXp: 30,
  skills: ["Основы", "ООП", "Классы", "Объекты", "Инкапсуляция", "Наследование", "Полиморфизм"],
  progressPercent: 60,
  goals: [
    { id: "g-1", label: "Создать класс и объекты", completed: true },
    { id: "g-2", label: "Понять инкапсуляцию и модификаторы", completed: true },
    { id: "g-3", label: "Наследование и переопределение методов", completed: true },
    { id: "g-4", label: "Полиморфизм на практике", completed: false },
    { id: "g-5", label: "Применить ООП в мини-проекте", completed: false },
  ],
  rewards: [
    { type: "xp", amount: 30 },
    { type: "gem", amount: 150 },
    { type: "trophy", amount: 1 },
    { type: "chest", amount: 1 },
  ],
};

const CSHARP_INSERTS: StoryInsert[] = [
  {
    id: "insert-7",
    chapterId: "ch-7",
    position: "before",
    title: "Хранители кода",
    preview:
      "Хранители кода открыли тебе тайну шаблонов. Но без понимания форм ты не сможешь пройти дальше.",
    artAsset: "banner/insert-oop",
  },
];

export const MOCK_CAMPAIGNS: CampaignSummary[] = [
  {
    id: "campaign-csharp",
    slug: "csharp-basics",
    languageTag: "C#",
    title: "Основы C#",
    status: "in-progress",
    chaptersCompleted: 6,
    chaptersTotal: 10,
    percent: 60,
    iconAsset: "icon/campaign-csharp",
  },
  {
    id: "campaign-typescript",
    slug: "typescript-basics",
    languageTag: "TS",
    title: "Основы TypeScript",
    status: "locked",
    chaptersCompleted: 2,
    chaptersTotal: 10,
    percent: 20,
  },
  {
    id: "campaign-http",
    slug: "http-master",
    languageTag: "HTTP",
    title: "Мастер HTTP",
    status: "locked",
    chaptersCompleted: 1,
    chaptersTotal: 9,
    percent: 11,
  },
];

export const MOCK_CAMPAIGN_DETAILS: Record<string, CampaignDetail> = {
  "csharp-basics": {
    ...MOCK_CAMPAIGNS[0]!,
    subtitle: "Кампания: Основы C#",
    descriptionMd:
      "Освой синтаксис, типы и базовые конструкции языка, прежде чем погружаться в архитектурные паттерны.",
    mapBackgroundAsset: "banner/map-csharp",
    acts: CSHARP_ACTS,
    chapters: CSHARP_CHAPTERS,
    chapterDetailsById: {
      [CSHARP_CHAPTER_DETAIL_OOP.id]: CSHARP_CHAPTER_DETAIL_OOP,
    },
    insertsByChapterId: { "ch-7": CSHARP_INSERTS },
    mapPaths: CSHARP_PATHS,
  },
};
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run lint`
Expected: no errors in any new entity file. (`app/story/page.tsx` still broken — fixed in Task 13.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/entities/campaign/mock.ts
git commit -m "feat(entities/campaign): mock fixture for Основы C# campaign"
```

---

## Task 9: Widget `story-campaign-list` (left sidebar)

**Files:**
- Create: `frontend/src/widgets/story-campaign-list/index.tsx`

- [ ] **Step 1: Create the widget**

```tsx
import { Lock, Plus } from "lucide-react";
import type { CampaignSummary } from "@/entities/campaign";
import { Panel, PanelHeader, PanelBody, ProgressBar } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type Props = {
  campaigns: CampaignSummary[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
};

export function StoryCampaignList({ campaigns, selectedSlug, onSelect }: Props) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Кампании"
        right={
          <button
            type="button"
            className="grid size-7 place-items-center rounded-md border border-border-subtle text-text-dim hover:border-primary/60 hover:text-primary"
            aria-label="Добавить кампанию"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        }
      />
      <PanelBody className="space-y-2">
        {campaigns.map((c) => {
          const isLocked = c.status === "locked";
          const isSelected = c.slug === selectedSlug;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => !isLocked && onSelect(c.slug)}
              disabled={isLocked}
              className={cn(
                "flex w-full items-start gap-3 rounded-md border bg-bg-elevated/60 px-3 py-3 text-left transition-colors",
                isLocked
                  ? "cursor-not-allowed border-border-subtle/60 opacity-60"
                  : isSelected
                    ? "border-primary/70 bg-primary/5"
                    : "border-border-subtle hover:border-primary/40",
              )}
              aria-current={isSelected ? "true" : undefined}
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-md border font-display text-[10px] uppercase tracking-[0.08em]",
                  isSelected
                    ? "border-primary/70 bg-primary/20 text-primary-soft"
                    : "border-border-subtle bg-bg-deep text-text-dim",
                )}
              >
                {c.languageTag}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text">
                  {c.title}
                </span>
                <span className="mt-0.5 flex items-center justify-between font-mono text-[11px] text-text-muted">
                  <span>
                    Прогресс: {c.chaptersCompleted} / {c.chaptersTotal} глав
                  </span>
                  <span className="tabular-nums">{c.percent}%</span>
                </span>
                <ProgressBar
                  value={c.percent}
                  tone={isSelected ? "primary" : "primary"}
                  className="mt-2"
                />
              </span>
              {isLocked ? (
                <Lock
                  className="size-4 shrink-0 text-text-muted"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </PanelBody>
    </Panel>
  );
}
```

- [ ] **Step 2: Verify `Panel`, `PanelHeader`, `PanelBody`, `ProgressBar` exports exist**

Run: `grep -n "Panel\\|PanelHeader\\|PanelBody\\|ProgressBar" frontend/src/shared/ui/index.ts`
Expected: all four are exported.

If `PanelHeader` doesn't accept a `right` prop, fall back to children-only and inline the "+" button via `className` next to the title — adjust the JSX above before committing.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/widgets/story-campaign-list
git commit -m "feat(widgets/story-campaign-list): left sidebar with campaign cards"
```

---

## Task 10: Widget `story-map` (center)

**Files:**
- Create: `frontend/src/widgets/story-map/index.tsx`
- Create: `frontend/src/widgets/story-map/chapter-node.tsx`
- Create: `frontend/src/widgets/story-map/map-paths.tsx`

- [ ] **Step 1: Create `chapter-node.tsx`**

```tsx
import { Lock, Sword } from "lucide-react";
import type { ChapterSummary } from "@/entities/chapter";
import { cn } from "@/shared/lib/cn";

type Props = {
  chapter: ChapterSummary;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

const TONE_RING: Record<NonNullable<ChapterSummary["nodeTone"]>, string> = {
  primary: "border-primary/70 bg-primary/15 text-primary-soft",
  gold:    "border-accent-gold/70 bg-accent-gold/10 text-accent-gold",
  cyan:    "border-accent-cyan/70 bg-accent-cyan/10 text-accent-cyan",
  green:   "border-accent-green/70 bg-accent-green/10 text-accent-green",
  red:     "border-accent-red/70 bg-accent-red/10 text-accent-red",
};

export function ChapterNode({ chapter, isSelected, onSelect }: Props) {
  const isLocked = chapter.status === "locked";
  const isBoss = chapter.nodeType === "boss";
  const toneClass = chapter.nodeTone
    ? TONE_RING[chapter.nodeTone]
    : "border-border-subtle bg-bg-elevated text-text-dim";

  return (
    <button
      type="button"
      onClick={() => onSelect(chapter.id)}
      disabled={isLocked}
      style={{ left: `${chapter.mapPosition.x}%`, top: `${chapter.mapPosition.y}%` }}
      className={cn(
        "group absolute -translate-x-1/2 -translate-y-1/2 transition-transform",
        !isLocked && "hover:scale-105",
        isSelected && "scale-110",
      )}
      aria-label={`Глава ${chapter.index}: ${chapter.title}`}
    >
      <span
        className={cn(
          "grid place-items-center rounded-lg border-2 font-display text-base shadow-lg backdrop-blur-sm",
          isBoss ? "size-16" : "size-12",
          toneClass,
          isSelected && "ring-2 ring-offset-2 ring-offset-bg-deep ring-primary",
          isLocked && "border-border-subtle/60 bg-bg-deep/80 text-text-muted",
        )}
      >
        {isLocked ? (
          <Lock className="size-4" aria-hidden />
        ) : isBoss ? (
          <Sword className="size-6" aria-hidden />
        ) : (
          chapter.index
        )}
      </span>
      <span className="absolute top-full left-1/2 mt-1 flex -translate-x-1/2 flex-col items-center gap-0.5 whitespace-nowrap rounded-md border border-border-subtle bg-bg-deep/90 px-2 py-1 text-[11px] font-semibold text-text shadow-md backdrop-blur">
        <span>{chapter.title}</span>
        <span className="font-mono text-[10px] text-text-dim tabular-nums">
          +{chapter.xpReward} XP
        </span>
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Create `map-paths.tsx`**

```tsx
import type { ChapterSummary } from "@/entities/chapter";
import type { MapPath } from "@/entities/campaign";

type Props = {
  paths: MapPath[];
  chapters: ChapterSummary[];
};

export function MapPaths({ paths, chapters }: Props) {
  const byId = new Map(chapters.map((c) => [c.id, c]));
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {paths.map((p) => {
        const from = byId.get(p.fromChapterId);
        const to = byId.get(p.toChapterId);
        if (!from || !to) return null;
        const stroke =
          p.style === "dashed" ? "var(--color-text-muted)" : "var(--color-primary)";
        return (
          <line
            key={p.id}
            x1={from.mapPosition.x}
            y1={from.mapPosition.y}
            x2={to.mapPosition.x}
            y2={to.mapPosition.y}
            stroke={stroke}
            strokeOpacity={p.style === "dashed" ? 0.5 : 0.7}
            strokeWidth={0.45}
            strokeDasharray={p.style === "dashed" ? "1.2 0.8" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 3: Create `index.tsx`**

```tsx
import { Crosshair, Maximize, Minus, Plus } from "lucide-react";
import type { ChapterSummary } from "@/entities/chapter";
import type { CampaignDetail, MapPath } from "@/entities/campaign";
import { Panel, PanelHeader, PanelBody } from "@/shared/ui";
import { ChapterNode } from "./chapter-node";
import { MapPaths } from "./map-paths";

type Props = {
  campaign: CampaignDetail;
  chapters: ChapterSummary[];
  paths: MapPath[];
  selectedChapterId: string | null;
  onSelectChapter: (id: string) => void;
};

export function StoryMap({
  campaign,
  chapters,
  paths,
  selectedChapterId,
  onSelectChapter,
}: Props) {
  return (
    <Panel className="flex flex-col overflow-hidden">
      <PanelHeader
        title={`Карта кампании: ${campaign.title.toUpperCase()}`}
        right={
          <div className="flex items-center gap-1.5">
            {[Plus, Minus, Maximize, Crosshair].map((Icon, i) => (
              <button
                key={i}
                type="button"
                className="grid size-7 place-items-center rounded-md border border-border-subtle text-text-dim hover:border-primary/60 hover:text-primary"
                aria-label="Контроль карты"
              >
                <Icon className="size-3.5" aria-hidden />
              </button>
            ))}
          </div>
        }
      />
      <PanelBody className="flex-1 p-0">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-bg-deep">
          {/* placeholder pixel-art background — swap for real banner asset when ready */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(168,85,247,0.18),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(6,182,212,0.12),transparent_60%)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(45deg,var(--color-bg-elevated)_25%,transparent_25%),linear-gradient(-45deg,var(--color-bg-elevated)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--color-bg-elevated)_75%),linear-gradient(-45deg,transparent_75%,var(--color-bg-elevated)_75%)] bg-[length:24px_24px] opacity-30"
          />
          <MapPaths paths={paths} chapters={chapters} />
          {chapters.map((c) => (
            <ChapterNode
              key={c.id}
              chapter={c}
              isSelected={c.id === selectedChapterId}
              onSelect={onSelectChapter}
            />
          ))}
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-subtle bg-bg-elevated/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-accent-green" /> Завершено
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-accent-cyan" /> Доступно
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-primary" /> В процессе
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-border-subtle" /> Заблокировано
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-accent-red" /> Босс
          </li>
        </ul>
      </PanelBody>
    </Panel>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/widgets/story-map
git commit -m "feat(widgets/story-map): pixel map placeholder with chapter nodes + SVG paths"
```

---

## Task 11: Widget `story-chapter-panel` (right sidebar)

**Files:**
- Create: `frontend/src/widgets/story-chapter-panel/index.tsx`

- [ ] **Step 1: Create the widget**

```tsx
import {
  ArrowRight,
  Check,
  Gauge,
  Gem,
  Gift,
  RotateCcw,
  Sparkles,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import type { ChapterDetail, ChapterRewardType } from "@/entities/chapter";
import type { StoryInsert } from "@/entities/story-insert";
import { Panel, PanelHeader, PanelBody, ProgressBar, Chip } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type Props = {
  chapter: ChapterDetail;
  insert?: StoryInsert;
};

const REWARD_ICON: Record<ChapterRewardType, typeof Zap> = {
  xp: Zap,
  gem: Gem,
  trophy: Trophy,
  chest: Gift,
  title: Sparkles,
};

const DIFFICULTY_LABEL: Record<ChapterDetail["difficulty"], string> = {
  easy: "Лёгкая",
  medium: "Средняя",
  hard: "Сложная",
  boss: "Босс",
};

export function StoryChapterPanel({ chapter, insert }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <Panel className="overflow-hidden">
        <PanelHeader title="Текущая глава" />
        <PanelBody className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg border-2 border-primary/70 bg-primary/15 font-display text-base text-primary-soft">
              {chapter.index}
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-text">
                {chapter.title}
              </p>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-primary-soft">
                В процессе
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-text-dim">
            {chapter.summary}
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
              <span>Прогресс главы</span>
              <span className="tabular-nums text-text-dim">
                {chapter.progressPercent}%
              </span>
            </div>
            <ProgressBar value={chapter.progressPercent} tone="primary" />
          </div>

          <dl className="grid grid-cols-1 gap-2 text-xs">
            <PanelStat
              icon={Gauge}
              label="Сложность"
              value={DIFFICULTY_LABEL[chapter.difficulty]}
            />
            <PanelStat
              icon={Timer}
              label="Время на главу"
              value={`${chapter.estimatedMinutes}–${chapter.estimatedMinutes + 10} мин`}
            />
            <PanelStat
              icon={Zap}
              label="Рекомендуемый XP"
              value={`+${chapter.recommendedXp} XP`}
              valueClassName="text-accent-gold"
            />
          </dl>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Награды
            </p>
            <div className="flex flex-wrap gap-2">
              {chapter.rewards.map((r) => {
                const Icon = REWARD_ICON[r.type];
                return (
                  <span
                    key={r.type}
                    className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1.5 font-mono text-[11px] text-text-dim"
                  >
                    <Icon className="size-3.5 text-accent-gold" aria-hidden />
                    {r.amount ?? 1}
                  </span>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Навыки и темы
            </p>
            <div className="flex flex-wrap gap-1.5">
              {chapter.skills.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              Цели главы
            </p>
            <ul className="space-y-1.5">
              {chapter.goals.map((g) => (
                <li
                  key={g.id}
                  className={cn(
                    "flex items-start gap-2 text-xs",
                    g.completed ? "text-text-dim" : "text-text",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                      g.completed
                        ? "border-accent-green/60 bg-accent-green/15 text-accent-green"
                        : "border-border-subtle bg-bg-deep text-text-muted",
                    )}
                  >
                    {g.completed ? <Check className="size-2.5" aria-hidden /> : null}
                  </span>
                  <span>{g.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-primary-soft"
            >
              Продолжить главу
              <ArrowRight className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="flex h-9 items-center justify-center gap-2 rounded-md border border-border-subtle bg-bg-elevated/60 text-xs font-semibold uppercase tracking-[0.16em] text-text-dim hover:border-primary/40 hover:text-text"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Повторить главу
            </button>
          </div>
        </PanelBody>
      </Panel>

      {insert ? (
        <Panel className="overflow-hidden">
          <PanelHeader title="Сюжетная вставка" />
          <PanelBody className="space-y-2">
            <p className="text-xs leading-relaxed text-text-dim">{insert.preview}</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-soft hover:text-primary"
            >
              Смотреть вставку
              <ArrowRight className="size-3.5" aria-hidden />
            </button>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}

function PanelStat({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle/60 bg-bg-elevated/40 px-3 py-2">
      <span className="flex items-center gap-2 text-text-dim">
        <Icon className="size-3.5 text-text-muted" aria-hidden />
        {label}
      </span>
      <span className={cn("font-mono tabular-nums text-text", valueClassName)}>
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify `Chip` is exported from `shared/ui`**

Run: `grep -n "Chip" frontend/src/shared/ui/index.ts`
Expected: `Chip` is exported (the file `chip.tsx` exists; if not exported, add `export { Chip } from "./chip";`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/widgets/story-chapter-panel
git commit -m "feat(widgets/story-chapter-panel): right sidebar with chapter detail + insert preview"
```

---

## Task 12: Widget `story-acts-bar` (bottom)

**Files:**
- Create: `frontend/src/widgets/story-acts-bar/index.tsx`

- [ ] **Step 1: Create the widget**

```tsx
import { Check, Lock } from "lucide-react";
import type { ActSummary } from "@/entities/act";
import { Panel, PanelBody, ProgressBar } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

type Props = {
  acts: ActSummary[];
};

const STATUS_BORDER: Record<ActSummary["status"], string> = {
  completed: "border-accent-green/40",
  "in-progress": "border-primary/40",
  available: "border-accent-cyan/40",
  locked: "border-border-subtle/60",
};

const STATUS_TONE: Record<
  ActSummary["status"],
  "primary" | "gold" | "green" | "red"
> = {
  completed: "green",
  "in-progress": "primary",
  available: "primary",
  locked: "primary",
};

export function StoryActsBar({ acts }: Props) {
  return (
    <Panel className="overflow-hidden">
      <PanelBody>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Акты кампании
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {acts.map((a) => {
            const isLocked = a.status === "locked";
            return (
              <li
                key={a.id}
                className={cn(
                  "rounded-md border bg-bg-elevated/60 px-4 py-3",
                  STATUS_BORDER[a.status],
                  isLocked && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs uppercase tracking-[0.18em] text-primary-soft">
                    {a.title}
                  </span>
                  {a.status === "completed" ? (
                    <Check className="size-4 text-accent-green" aria-hidden />
                  ) : isLocked ? (
                    <Lock className="size-4 text-text-muted" aria-hidden />
                  ) : null}
                </div>
                {a.subtitle ? (
                  <p className="mt-1 text-sm font-semibold text-text">
                    {a.subtitle}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-text-muted">
                  <ProgressBar
                    value={a.percent}
                    tone={STATUS_TONE[a.status]}
                    className="flex-1"
                  />
                  <span className="ml-3 tabular-nums">{a.percent}%</span>
                </div>
              </li>
            );
          })}
        </ul>
      </PanelBody>
    </Panel>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/widgets/story-acts-bar
git commit -m "feat(widgets/story-acts-bar): bottom bar with 4 act cards"
```

---

## Task 13: Rewrite `app/story/page.tsx`

**Files:**
- Modify: `frontend/src/app/story/page.tsx`

- [ ] **Step 1: Replace the file with the composed layout**

```tsx
"use client";

import { useState } from "react";
import type { Metadata } from "next";
import {
  MOCK_CAMPAIGNS,
  MOCK_CAMPAIGN_DETAILS,
} from "@/entities/campaign";
import { StoryCampaignList } from "@/widgets/story-campaign-list";
import { StoryMap } from "@/widgets/story-map";
import { StoryChapterPanel } from "@/widgets/story-chapter-panel";
import { StoryActsBar } from "@/widgets/story-acts-bar";

export default function StoryPage() {
  const [selectedCampaignSlug, setSelectedCampaignSlug] = useState(
    MOCK_CAMPAIGNS[0]!.slug,
  );
  const campaign = MOCK_CAMPAIGN_DETAILS[selectedCampaignSlug]!;
  const defaultSelectedChapterId =
    campaign.chapters.find((c) => c.status === "in-progress")?.id ??
    campaign.chapters[0]!.id;
  const [selectedChapterId, setSelectedChapterId] = useState(
    defaultSelectedChapterId,
  );
  const detail =
    campaign.chapterDetailsById[selectedChapterId] ??
    Object.values(campaign.chapterDetailsById)[0]!;
  const insert = campaign.insertsByChapterId[detail.id]?.[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr_340px]">
        <StoryCampaignList
          campaigns={MOCK_CAMPAIGNS}
          selectedSlug={selectedCampaignSlug}
          onSelect={(slug) => {
            setSelectedCampaignSlug(slug);
            const next = MOCK_CAMPAIGN_DETAILS[slug];
            if (next) {
              const inProgress = next.chapters.find(
                (c) => c.status === "in-progress",
              );
              setSelectedChapterId(inProgress?.id ?? next.chapters[0]!.id);
            }
          }}
        />
        <StoryMap
          campaign={campaign}
          chapters={campaign.chapters}
          paths={campaign.mapPaths}
          selectedChapterId={selectedChapterId}
          onSelectChapter={setSelectedChapterId}
        />
        <StoryChapterPanel chapter={detail} insert={insert} />
      </div>
      <StoryActsBar acts={campaign.acts} />
    </div>
  );
}
```

- [ ] **Step 2: Move `metadata` export to a separate file**

`metadata` cannot be exported from a client component. Create
`frontend/src/app/story/layout.tsx`:

```tsx
import type { Metadata, ReactNode } from "react";

export const metadata: Metadata = {
  title: "История",
};

export default function StoryLayout({ children }: { children: ReactNode }) {
  return children;
}
```

(If a layout already exists for `/story`, merge the `metadata` export into it instead.)

- [ ] **Step 3: Add widget barrels**

For each widget created in Tasks 9-12, add an `index.ts` barrel if it doesn't exist:

`frontend/src/widgets/story-campaign-list/index.ts`:
```ts
export { StoryCampaignList } from "./index.tsx";
```

(Repeat for `story-map`, `story-chapter-panel`, `story-acts-bar`.)

Actually — since the file is already named `index.tsx`, the import path `@/widgets/story-map` works without a separate `index.ts`. Skip this step unless lint complains.

- [ ] **Step 4: Lint + build**

Run: `cd frontend && npm run lint && npm run build`
Expected: both pass with zero errors.

If lint complains about unused `Metadata` import in `page.tsx`, remove it.

- [ ] **Step 5: Smoke-test in the browser**

Run: `cd frontend && npm run dev` (background)
Open: http://localhost:3000/story

Expected:
- Left sidebar shows three campaign cards; "Основы C#" is selected and shows a primary outline.
- Center shows a placeholder map (gradient + dot pattern) with 10 hex chapter nodes connected by SVG lines. Green nodes 1-5, cyan 6, primary 7, locked 8-9, red boss 10.
- Right sidebar shows "Текущая глава" panel for chapter 7 (ООП) with progress 60%, 5 goals (3 checked), reward icons, skill chips, and the story-insert preview below.
- Bottom shows four act cards with progress bars (100% / 83% / 33% / 0%).
- Clicking another chapter on the map updates the right panel (where detail data exists; otherwise stays on ООП).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/story/page.tsx frontend/src/app/story/layout.tsx
git commit -m "feat(app/story): compose 3-column + bottom-bar layout matching reference mockup"
```

---

## Self-review

- [x] **Spec coverage:** Architecture revision (Task 1), Roadmap split (Task 2), full spec (Task 3), entity expansion (Tasks 4-8), four widgets (Tasks 9-12), page composition (Task 13). All scoped deliverables covered.
- [x] **Placeholder scan:** No "TBD" / "implement later". Every code block is complete.
- [x] **Type consistency:** `ChapterSummary.mapPosition` (Task 4) → consumed verbatim in `ChapterNode` (Task 10) and `MapPaths` (Task 10). `CampaignDetail.chapterDetailsById` (Task 6) → consumed in `StoryChapterPanel` flow in Task 13. `ActSummary.percent` (Task 5) → consumed in `StoryActsBar` (Task 12).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-24-story-mode-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
