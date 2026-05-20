-- Runs once when the Postgres container creates a fresh data directory.
-- Idempotent: safe to apply against an existing DB too.

CREATE SCHEMA IF NOT EXISTS arena;

-- ltree backs hierarchical paths (e.g. chapter→task ordering, story-map
-- prerequisites) without bespoke recursive CTEs.
CREATE EXTENSION IF NOT EXISTS ltree;
