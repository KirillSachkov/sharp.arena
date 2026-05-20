-- Runs once when the Postgres container creates a fresh data directory.
-- Idempotent: safe to apply against an existing DB too.

-- ltree backs hierarchical paths (e.g. chapter→task ordering, story-map
-- prerequisites) without bespoke recursive CTEs.
CREATE EXTENSION IF NOT EXISTS ltree;

-- Per-module schemas. Each module owns exactly one schema and never reads
-- across schema boundaries. Cross-module reads go through IXxxReader contracts.
CREATE SCHEMA IF NOT EXISTS arena_content;
CREATE SCHEMA IF NOT EXISTS arena_execution;
CREATE SCHEMA IF NOT EXISTS arena_progress;
CREATE SCHEMA IF NOT EXISTS arena_identity;

-- Wolverine durable inbox/outbox + envelope tables. Wolverine auto-provisions
-- these on startup; the schema itself must pre-exist.
CREATE SCHEMA IF NOT EXISTS arena_wolverine;
