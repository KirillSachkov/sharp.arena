---
name: fix-bug
description: Use when fixing a bug, crash, regression, broken endpoint, or any reported wrong behavior in this project — orchestrates the full chain investigate (root cause) → reproducer test → minimal fix → review → verify. Triggers on phrases like "fix bug", "fix the issue", "почини баг", "сломалось", or the /fix-bug slash command.
---

# Bug Fix Chain

End-to-end orchestration for fixing bugs. Surgical changes only — every changed line must trace to the bug. Discipline is enforced by checkpoints; do not skip a phase.

**Core principle (Karpathy):** investigate → reproduce → minimal fix → verify. No "while I'm here" refactors. No improvements to adjacent code, comments, or formatting. Match existing style even if you would do it differently.

## Mandatory background reads

If not already in this session:

- `CLAUDE.md` at the repo root — especially Known Gotchas (recurring footguns)
- `.claude/rules/integration-tests.md` for any test work
- `.claude/rules/wolverine-tests.md` if the bug is in event publishing or async handler
- `.claude/rules/backend-migrations.md` if a schema-related fix
- The relevant `backend/{Service}/CLAUDE.md`

## TodoWrite scaffold

Open the chain by writing this todo list. Mark cancelled phases as `cancelled`, never silently skip.

1. Phase 0 — Issue/ticket (find or create, link to PR)
2. Phase 1 — Investigate (gather evidence, form hypothesis)
3. Phase 2 — Reproducer test (failing test that captures the bug)
4. Phase 3 — Plan minimal fix
5. Phase 4 — Implement fix
6. Phase 5 — Re-run reproducer, all tests
7. Phase 6 — Code review (code-reviewer)
8. Phase 7 — Security review (if auth / SQL / permission related)
9. Phase 8 — Verify (build + browser if UI bug)
10. Phase 9 — Add observability / log point if symptom was non-obvious
11. Phase 10 — Close issue / link PR

## Phase 0 — Issue/ticket

Search the issue tracker for an existing ticket for this symptom. Reuse if found. If none — create one with `type::bug`, default `prio::medium` (`prio::high` if blocks prod / auth / payment / data loss). Description includes symptom + repro steps + suspect file:line if known.

Note the id for commit messages `fix(svc): bar (#N)` and PR `Closes #N`.

Skip Phase 0 only for one-line copy / typo / styling fixes (mark cancelled with reason).

## Phase 1 — Investigate

ALWAYS use the `investigate-and-fix` skill OR `superpowers:systematic-debugging`. They define the platform-specific evidence-gathering toolkit. Do not skip this — guessing the cause and editing wastes more time than 5 minutes of investigation.

For prod bugs: read logs via observability stack first (Loki/Grafana). For local bugs: `docker logs <service>` and Grafana local if observability stack is up. SSH to prod is allowed if needed.

For test failures: `debugger` subagent. For non-trivial bugs that span multiple services: `Explore` subagent for parallel read-only investigation.

Output of Phase 1 (write into Phase 2 todo):
- Symptom (exact error / wrong output)
- Reproduction steps
- Suspected root cause (one hypothesis, not three)
- Affected files / endpoints / handlers (absolute paths)
- Whether bug is backend / frontend / migration / data / config

If 2+ hypotheses fail in a row — STOP and re-examine assumptions before continuing. The bug is somewhere you have not looked.

## Phase 2 — Reproducer test

TDD discipline (`superpowers:test-driven-development`). Write the test BEFORE the fix.

Backend:
- Integration test in the affected service's `tests/{Service}.IntegrationTests/` project
- Test must fail on current code (run it once, observe the failure)
- Use `integration-test-coverage` skill to get the right harness
- For event publishing bugs: L2 test asserting via `OutboxCollector.OfType<T>()` — this catches "publish without flush" bugs
- For event handler bugs: L1 test with `Host.InvokeMessageAndWaitAsync(evt)`

Frontend:
- Vitest unit test under `frontend/src/**/__tests__/` if pure logic
- Playwright golden-path interaction if UI / browser-only bug

Migration / schema bug:
- The reproducer is a fresh DB run: dev down + up + migrate and check the symptom returns
- If migration was already deployed and column was dropped — recover from backups

Exception: pure copy / styling fix may not need a test. Mark Phase 2 cancelled with reason "trivial visual fix, manually verified in Phase 8".

Commit the failing test before writing the fix — this proves the test is real. (Optional but encouraged.)

## Phase 3 — Plan minimal fix

State in plain words:
- What ONE thing changes
- Why it fixes the symptom
- What stays untouched

Refuse temptation:
- Do NOT clean up adjacent code, comments, naming, formatting.
- Do NOT refactor things that are not broken.
- Do NOT widen the scope ("while I'm here, let me also...").
- If you notice unrelated dead code or other bugs, mention them in the final report — do NOT delete or fix them in this chain.

The test: every changed line should be answerable to "this is here to fix the reported bug."

## Phase 4 — Implement fix

Backend rules (still applicable for fixes):
- `Result<T, Error>` — never `throw` for business errors
- `Guid.CreateVersion7()` in production code
- Outbox `PublishAsync` always followed by `SaveChangesAsync` / commit (`.claude/rules/wolverine-tests.md`)
- Trailing slashes on routes
- Migration: NEW migration only, never edit existing (`.claude/rules/backend-migrations.md`). Drop/rename column EF migrations require `docker compose build` on prod, not just restart.

Frontend rules:
- React Compiler 19 — no manual memoization
- Trailing slash on all API URLs
- Icons from `Icons.{concept}` central registry
- No `useRef` for render-affecting data
- Composite keys when list data comes from multiple sources

If the fix orphans imports / variables / functions — remove only those orphans. Do NOT remove pre-existing dead code.

## Phase 5 — Re-run tests

- [ ] Reproducer test now PASSES
- [ ] Full integration suite for the affected service is green: `dotnet test backend/{Service}/tests/{Service}.IntegrationTests`
- [ ] If multiple services touched: run tests for each
- [ ] If frontend touched: `npm test` and any new Vitest specs
- [ ] Reproducer test stays in the codebase as a regression guard. Do NOT delete it.

If the reproducer passes but other tests now fail → the fix is too wide. Return to Phase 3, narrow the change.

## Phase 6 — Code review

`code-reviewer` subagent on the changed files. Pass the file list explicitly. Reviewer checks:
- Surgical scope (no unrelated edits)
- Patterns followed (Result/Error, FSD layers, outbox flush)
- Regression test exists and is meaningful

For a fix to a single .NET service with non-trivial domain logic: `microservice-reviewer` instead of `code-reviewer`.

Address every blocker.

## Phase 7 — Security review

Invoke `security-reviewer` if the bug or fix touches:
- Authentication, OIDC token handling, refresh / sign-in cookies
- Authorization — permissions, roles, ownership checks, entitlement checks
- Raw SQL or Dapper query (SQL injection class)
- Anonymous endpoints or new `AllowAnonymousEndpoint()`
- File upload validation, signed URLs
- Cross-service contract auth headers

## Phase 8 — Verification

Invoke `superpowers:verification-before-completion`. Use `full-dev-verification` skill or run piecewise:

- [ ] `cd backend && dotnet build backend.slnx` → 0 errors
- [ ] All tests in the touched service(s) green
- [ ] `npm run lint` + `npm run build` clean if frontend touched
- [ ] If UI bug: walk the golden path with Playwright MCP. Capture a snapshot AFTER the fix to confirm the visual symptom is gone.
- [ ] If prod-affecting bug: confirm the deploy path (build container, push, restart) is consistent with the change. EF column drop = `compose build`, not just `restart`.

If reproducer was skipped (trivial visual fix), the browser check is the only proof the bug is gone — do not skip it.

## Phase 9 — Observability

If the symptom was hard to find from existing logs / traces, add ONE log point at the suspect spot so the next regression is faster to diagnose. Use `_logger.LogInformation` / `LogWarning` with structured properties. Do not add generic "method called" logs.

If the bug exposed a class of issues (e.g. missing outbox flush, missing entitlement check), consider whether the relevant CLAUDE.md "Known Gotchas" section should grow a new bullet. Do NOT add the gotcha unless you are sure it is reusable knowledge.

## Phase 10 — Close issue / link PR

- PR open → ensure description has `Closes #N`.
- Direct commit to `dev`/`main` → close manually and link the commit SHA.
- If during fix you found additional unrelated bugs — **separate** issues for each (do not bundle). The current issue closes only if the originally-reported symptom is gone.

## Final report

Terse, Russian if user used Russian:
- Root cause, one sentence
- Files changed (absolute paths)
- Reproducer test name + path
- Verification results (which boxes green)
- Any unrelated issues spotted (mention only — do not silently fix unrelated code)
