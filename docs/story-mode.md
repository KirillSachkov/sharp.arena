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
