---
name: feature
description: Use when implementing a new feature in this project — orchestrates the full chain brainstorm → architect/plan → implement → test → review → verify → docs. Triggers on phrases like "implement feature", "add feature", "build feature", "новая фича", "сделай фичу", or the /feature slash command.
---

# Feature Development Chain

End-to-end orchestration for adding a new feature (.NET microservices + Next.js FSD). Each phase has explicit gates. Do not skip a gate without a written reason in the TodoWrite list.

**Core principle:** consistency over novelty. Follow existing patterns from CLAUDE.md and `.claude/rules/*.md`. Only deviate with a stated rationale.

## Mandatory background reads

If you have not already read them in this session:

- `CLAUDE.md` at the repo root — full project context, especially Inter-Service Communication, Post-Change Checklist, Known Gotchas
- `.claude/rules/frontend-fsd.md` if frontend is touched
- `.claude/rules/wolverine-tests.md` if a Wolverine publisher/handler is added
- `.claude/rules/integration-tests.md` if any integration test is written
- `.claude/rules/backend-migrations.md` if EF migration is added
- `.claude/rules/doc-maintenance.md` always at the end
- The relevant `backend/{Service}/CLAUDE.md` for the affected service

## TodoWrite scaffold

Open the chain by writing this todo list (skip phases only with explicit user permission, mark them as `cancelled` not `completed`):

1. Phase 0 — Issue/ticket (find or create, link to PR)
2. Phase 0.5 — Success criterion (one verifiable line — see below)
3. Phase 1 — Brainstorm requirements
4. Phase 2 — Architect / write plan
5. Phase 3 — Implement backend (if applicable)
6. Phase 4 — Implement frontend (if applicable)
7. Phase 5 — Write integration tests
8. Phase 6 — Code review (code-reviewer)
9. Phase 7 — Security review (if auth / new endpoint / SQL)
10. Phase 8 — Verify (build + test + browser) — gate against Phase 0.5 criterion
11. Phase 9 — Update docs
12. Phase 10 — Close issue / link PR

## Phase 0 — Issue/ticket

Search the project's issue tracker for an existing ticket that captures this work. Reuse it; don't dedupe by creating a new one. If none — create it before starting work so the implementation has audit trail.

Note the issue id — it goes into commit messages `feat(svc): foo (#N)` and the PR description `Closes #N`.

Skip Phase 0 only if user said "do it without an issue" or the change is one-line (typo / copy / style). In both cases mark Phase 0 cancelled with reason.

## Phase 0.5 — Success criterion (verifiable, one line)

Before any brainstorm / architect / code, write **one observable check** that proves the feature works. Drop it into the issue description (under `## Success criterion`) and quote it verbatim in the TodoWrite todo. Karpathy:

> "Execution is only as good as the goal and the verification you give it. Ambition without verification is just a wish."

Format: a single sentence with an explicit assertion — endpoint + expected response, UI action + visible result, SQL row count, log line, file existence. Always testable in <30 seconds at Phase 8.

| ❌ Weak (re-states the task) | ✅ Strong (verifiable check) |
|---|---|
| "implement item reuse" | `POST /items/{id}/reuse → 200, response includes new itemId, GET /items/{newId} shows source_item_id == original.` |
| "add roadmap export" | `GET /roadmaps/{id}/export.svg → valid SVG; opens in Chrome; every node label from the canvas is visible in the rendered output.` |
| "fix DnD between groups" | `Drag item from Group A to Group B in /admin/x/builder → toast 'moved', refresh page, item appears in Group B only, sort_key correctly placed between siblings.` |

Hard rules:
- **One criterion, not a list.** If the feature is genuinely multi-faceted, split it into separate issues with one criterion each. A feature with 4 success criteria = 4 features.
- **Observable from outside the code.** "Method X returns Result.Success" is not observable — that's an internal detail. "Endpoint returns 200" is.
- **Specific values, not properties.** Not "returns an enrollment" — "response.enrollment.status == 'Active' and ProgressService.enrollments has row with same id".
- **Use real test data.** Reference IDs / DTOs that exist in seed-data — so Phase 8 can actually run the curl.

If the criterion cannot be written in one sentence, the feature is under-specified — go back to the user and clarify scope before Phase 1. Do NOT proceed with a vague goal; you will land in Phase 8 unable to claim it works.

In Phase 8 the verification gate explicitly re-quotes this line and confirms it passes. If it does not pass — return to Phase 3/4, do not weaken the criterion to fit the implementation.

Skip Phase 0.5 only for: one-line copy / typo / styling fixes (same exemption as Phase 0). For everything else, no skip.

## Phase 1 — Brainstorm

Triggers `superpowers:brainstorming` if the task is non-trivial (more than one file, new endpoint, new entity, new event, schema change, or any cross-service touch).

Skip rules:
- If user wrote "пропусти brainstorm" / "skip brainstorm" / "go straight to code" — skip and mark Phase 1 cancelled.
- For one-line bug-fix-shaped features (single field rename, copy change), skip brainstorm.

Output of brainstorm: short bullet list of requirements + open questions answered.

## Phase 2 — Architect / Plan

Use the `architect` subagent for design, OR `superpowers:writing-plans` for an executable plan. For multi-service or migration-touching features, do BOTH (architect first, then plan).

The plan MUST address:

**a) Authorization tiers** (only if feature touches endpoints with access control):
- Tier 1 — Endpoint permission: `.RequirePermissions(...)` or explicit `.AllowAnonymousEndpoint()`
- Tier 2 — Ownership: explicit ownership check for mutations on user-owned resources
- Tier 3 — Entitlement: gating for paid/private content

**b) Three-spot rule for messaging** (only if a new RabbitMQ exchange / routing key / consumer is introduced):
- Service's `CLAUDE.md` Messaging section
- Root `CLAUDE.md` messaging table
- `backend/Shared/Messaging/RabbitMqMessaging/MESSAGING_CONVENTIONS.md`
- New consumer? Verify `AddRabbitMqCheck` is in the service's `Web/Registration.cs`

**c) Migration plan** (only if domain entities / schema change):
- New migration only — never edit existing ones (`.claude/rules/backend-migrations.md`)
- No `CREATE INDEX CONCURRENTLY` (EF runs migrations in transaction)
- Cross-schema FK references need `IF EXISTS` guards
- If renaming/dropping a column → add a TODO that prod deploy needs `docker compose build`, not just `restart`

**d) Cross-service contracts** — list which `{Service}.Contracts` projects need updates and which HTTP clients in other services need updates.

**e) Frontend data flow** (only if frontend is touched):
- FSD layer for each new file (app / pages / widgets / features / entities / shared)
- Entity layer: `api.ts` (queryOptions factories), `types.ts`, `index.ts`
- Feature layer: `model/use-{action}-{entity}.ts` mutation hooks
- Status types live in `shared/types/status.ts` — never in entities (would break the lint gate)
- No upward / cross-slice imports

## Phase 3 — Backend implementation

Vertical-slice pattern: command/query + validator + endpoint + handler in one file under `Features/{Feature}/UseCases/`.

Hard rules:
- `Result<T, Error>` for every operation. NEVER `throw` for business errors.
- `Guid.CreateVersion7()` in production code (not `Guid.NewGuid()`).
- Aggregates extend `AggregateRoot`, entities extend `Entity`.
- Value objects: sealed record, private constructor, static `Create()` returning `Result<T, Error>`.
- Fractional ordering via `SortKey` (`backend/Shared/Ordering/`).
- Wolverine outbox: every `_outbox.PublishAsync(...)` must be followed by `_transactions.SaveChangesAsync(ct)` or a transaction commit. See `.claude/rules/wolverine-tests.md` — a publish without flush silently drops the event.
- EF Core: `snake_case` tables, JSONB for complex value objects.
- All three authorization tiers (if applicable) must be wired into the endpoint.

If any HTTP route is added, register it via the existing `MapEndpoint` pattern, with trailing slash on collection routes.

## Phase 4 — Frontend implementation

FSD enforced by `eslint-plugin-boundaries`. Run `npm run lint` to catch violations.

Hard rules:
- React Compiler 19 — no `useCallback` / `useMemo` / `React.memo`. Do not mutate objects/arrays — return new references.
- All API URLs end with trailing slash (nginx returns 301 otherwise — breaks CORS preflight).
- Icons only from `shared/ui/icons` central registry. Do NOT import directly from `lucide-react`.
- Use `cn()` for conditional classes, Tailwind + shadcn/ui from `shared/ui/kit/`.
- Forms: Zod v4 schemas, no `coerce`/`transform`.
- TanStack Query for server state. Mutation hooks under `features/{slice}/model/`.
- Composite React keys when list comes from multiple data sources.
- Beware: a `[param]/page.tsx` in one route group silently breaks sibling static routes in other groups.

## Phase 5 — Tests

Invoke the `integration-test-coverage` skill for any new endpoint or handler.

Required test levels (from `.claude/rules/wolverine-tests.md`):
- **L1** — handler logic via `Host.InvokeMessageAndWaitAsync(evt)` for any new event handler
- **L2** — endpoint publish via `OutboxCollector.OfType<T>().Single()` (Pattern A) for any endpoint that publishes an event. This is the test that catches a missing `SaveChangesAsync` flush.
- L3 (broker round-trip) — do NOT write; `DisableAllExternalWolverineTransports()` makes it impossible.

Test infra rules from `.claude/rules/integration-tests.md`:
- `Guid.NewGuid()` is fine in tests.
- If your new endpoint uses a new `RequireRateLimiting("policy-name")`, add `"policy-name"` to the `policies` array in the service's `IntegrationTestsWebFactory` — otherwise endpoint returns 500 in tests.
- Use `Fake*` checkers (e.g. `GrantAll()` / `DenyAll()`) to simulate permission state.

Frontend tests: Vitest under `frontend/`. Skip unless explicitly requested or feature has non-trivial UI logic.

## Phase 6 — Code review

Invoke the `code-reviewer` subagent against the changed files. Pass it the file list. The reviewer checks against CLAUDE.md / rules conventions: Result/Error usage, trailing slashes, FSD violations, missing entitlement checks, missing outbox flush, missing migration guards.

Address every blocker the reviewer raises. Document any "wontfix" with rationale in the todo item.

## Phase 7 — Security review

Invoke `security-reviewer` if ANY of:
- New endpoint added (any HTTP verb, any service)
- Auth / OIDC / Identity touched
- Permission constants added or changed
- Raw SQL or Dapper query introduced
- File upload, signed URL, or external integration touched
- Anonymous endpoint added or `AllowAnonymousEndpoint()` widened

## Phase 8 — Verification

Invoke `superpowers:verification-before-completion`. The chain is NOT done until every box below is green. Use the `full-dev-verification` skill to run the full battery, or run them piecewise.

**First box — Phase 0.5 success criterion.** Re-read the success criterion verbatim from the issue / TodoWrite. Run the exact check described in it (curl, SQL, browser action) and observe the result. Paste the actual result into the final report. If the criterion does not pass — return to Phase 3/4, do NOT mark the chain complete or weaken the criterion.

- [ ] **Success criterion from Phase 0.5 — observed and passing.** Quote the criterion. Paste the actual check output.

Backend:
- [ ] `cd backend && dotnet build backend.slnx` → 0 errors, 0 warnings (warnings allowed only if pre-existing)
- [ ] `dotnet test backend/{Service}/tests/{Service}.IntegrationTests` for every touched service → all green
- [ ] If migration added: dev migrate runs cleanly
- [ ] If event added: assert via `OutboxCollector` in the L2 test

Frontend (if touched):
- [ ] `cd frontend && npm run lint` → 0 warnings, 0 errors
- [ ] `npm run build` succeeds
- [ ] If unit tests touched: `npm test`

Browser smoke (golden path):
- [ ] Frontend running via Docker
- [ ] Use Playwright MCP (`mcp__playwright__*`) to walk the new feature's golden path: navigate to the feature URL, perform the primary action, assert the visible result. Capture a snapshot.
- [ ] If feature is gated, also test the lock state (anonymous / unenrolled user sees the lock copy).

If anything is red, return to the relevant phase. Do NOT mark the chain complete with red boxes.

## Phase 9 — Documentation

Apply `.claude/rules/doc-maintenance.md` three-spot rule for messaging changes. Independently:

- [ ] Service's `backend/{Service}/CLAUDE.md` updated if domain model / messaging / gotchas changed
- [ ] Root `CLAUDE.md` updated if service boundaries / authorization model / cross-service patterns changed
- [ ] If three-spot triggered: confirm all three files updated in the same change set
- [ ] If a new gotcha was discovered during implementation, add it to the relevant CLAUDE.md "Known Gotchas" section

Do NOT create freestanding `.md` design / summary / changelog files in the repo. Update existing CLAUDE.md only.

## Phase 10 — Close issue / link PR

- If PR was opened: ensure description has `Closes #N` so merge auto-closes the issue.
- If commit went straight to `dev`/`main`: close the issue manually and link the commit SHA.
- If feature was scoped down or split — leave the parent issue open with a comment listing follow-up issues, close only what's actually done.

## Final report

Report to the user (terse, no emoji, Russian if user is using Russian):
- Files added / modified (absolute paths)
- Endpoints added (route + verb + auth)
- New events / migrations / cross-service contract bumps
- Test counts: L1 / L2 / unit
- Verification results (which boxes green / red)
- Any deferred work (gotchas, follow-ups) — but do NOT silently fix unrelated code; mention only.
