#!/usr/bin/env bash
# Mirror ~/.claude (global config) into .claude/global/ for git-track.
# Direction: SOURCE (~/.claude) -> MIRROR (repo/.claude/global)
# Run automatically on Stop hook; runnable manually.

set -euo pipefail

REPO="${CLAUDE_PROJECT_DIR:-$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)}"
SRC="$HOME/.claude"
DST="$REPO/.claude/global"
PROJECT_KEY=$(echo "$REPO" | sed 's|/|-|g')
MEM_SRC="$SRC/projects/$PROJECT_KEY/memory"

mkdir -p "$DST" "$DST/memory" "$DST/skills"

# 1. Global CLAUDE.md
[ -f "$SRC/CLAUDE.md" ] && cp "$SRC/CLAUDE.md" "$DST/CLAUDE.md"

# 2. Global settings.json (NB: contains plugin keys & permissions only — no secrets)
[ -f "$SRC/settings.json" ] && cp "$SRC/settings.json" "$DST/settings.json"

# 3. Auto-memory for THIS project (rsync semantics — drops removed files)
if [ -d "$MEM_SRC" ]; then
  rsync -a --delete --exclude='.DS_Store' "$MEM_SRC/" "$DST/memory/"
fi

# 4. Personal global skills NOT already mirrored as project skills
PROJECT_SKILLS_DIR="$REPO/.claude/skills"
if [ -d "$SRC/skills" ]; then
  for skill_path in "$SRC/skills"/*/; do
    skill=$(basename "$skill_path")
    [ -d "$PROJECT_SKILLS_DIR/$skill" ] && continue
    rsync -a --delete --exclude='.DS_Store' "$skill_path" "$DST/skills/$skill/"
  done
fi

# 5. Manifest with origin paths so reviewers can see drift
cat > "$DST/MANIFEST.md" <<EOF
# Global config mirror

Auto-synced from \`~/.claude\` by \`.claude/scripts/sync-global-config.sh\`
(Stop-hook trigger). Last sync: $(date -u +"%Y-%m-%dT%H:%M:%SZ").

## Sources

| Mirror path | Origin |
|---|---|
| \`CLAUDE.md\` | \`~/.claude/CLAUDE.md\` |
| \`settings.json\` | \`~/.claude/settings.json\` |
| \`memory/\` | \`~/.claude/projects/$PROJECT_KEY/memory/\` |
| \`skills/<name>/\` | \`~/.claude/skills/<name>/\` (only those NOT in \`.claude/skills/\`) |

## Why this exists

Claude Code's own config (Karpathy guidelines, allow-list, plugins, auto-memory)
lives under \`~/.claude\` — outside the repo. This mirror lets git track it so
behavioural changes (new feedback, allow-list edits) are reviewable and shareable
across machines.

## Editing

Don't edit files in \`.claude/global/\` directly — they get overwritten by sync.
Edit the originals in \`~/.claude/\`; the next Stop hook picks them up.
EOF

exit 0
