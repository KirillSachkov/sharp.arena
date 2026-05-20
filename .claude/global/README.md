# `.claude/global/` — git-tracked mirror of personal Claude config

This folder is **read-only documentation** of what lives in `~/.claude/`.
It exists so that:

1. Behavioural changes (new feedback memories, allow-list edits, hook tweaks) are reviewable in PRs.
2. Re-onboarding on a new machine can replay the config: `cp -r .claude/global/* ~/.claude/` (then bootstrap project-specific paths).
3. Memory files that influence agent behaviour are auditable — no more "claude is doing X and we don't know why".

## Layout

```
.claude/global/
├── CLAUDE.md          # Karpathy guidelines (global behavioural defaults)
├── settings.json      # Global allow-list, hooks, enabled plugins
├── memory/            # Auto-memory for THIS project (mirrored from ~/.claude/projects/.../memory/)
│   ├── MEMORY.md      # Index loaded into every session
│   └── *.md           # Individual memory files
├── skills/            # Personal global skills NOT mirrored as project skills
└── MANIFEST.md        # Auto-generated origin map
```

## Sync

Automatic via Stop hook (`.claude/scripts/sync-global-config.sh`).
Manual: `bash .claude/scripts/sync-global-config.sh`.

Direction is one-way: **`~/.claude/` → `.claude/global/`**. Editing files in
this folder has no effect — they get overwritten on next sync.

## What's NOT mirrored

- `~/.claude/sessions/`, `history.jsonl`, `cache/`, `paste-cache/`, `image-cache/` — ephemeral, large, no review value
- `~/.claude/plugins/` — installed plugin code (huge, fetched from marketplaces, declared in `settings.json` `enabledPlugins`)
- `~/.claude/projects/<other>/` — other projects' memory
- `~/.claude/keybindings.json` — personal UX, not project-relevant
- Anything containing secrets (none currently in mirrored files)

## Reviewing changes

```bash
git diff .claude/global/  # see what changed in personal config since last commit
```

If a memory file appears that you don't want public, delete it from
`~/.claude/projects/.../memory/` (and `MEMORY.md`) — next sync drops it from the mirror.
