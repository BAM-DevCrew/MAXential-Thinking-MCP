# MAXential v2.3 — Persistence Schema Design

**Date:** February 15, 2026 (revised February 16, 2026)
**Status:** Design Review
**Target:** MAXential v2.3 (persistence layer — foundation for multi-agent features in v2.4+)
**Depends on:** Phase 0 Findings (Agent-MCP Connection Model)

---

## Design Philosophy

1. **Forward-compatible** — All tables created upfront (agents, syntheses, thought_references), even though Phase 1 won't populate them. Empty tables cost nothing in SQLite. v2.4+ just starts inserting — no schema migrations needed.

2. **Backward-compatible** — Everything new is optional. No `session_id` provided? Auto-create one. No `agent_id`? It's null (orchestrator). Existing v2.2 behavior is preserved exactly. Users who don't care about persistence get the same experience.

3. **Maps to existing types** — Every table maps directly to types already defined in `src/types/index.ts` (`ThoughtData`, `BranchData`, `SessionMetadata`, etc.). The schema is the TypeScript types, persisted.

4. **Dual-mode operation** — `SequentialThinkingServer` keeps its in-memory arrays (fast reads, zero API changes). New `PersistenceLayer` class handles SQLite. Every write goes to both. Load hydrates memory from disk.

---

## Configuration

```typescript
// Activated via environment variable
const dbPath = process.env.MAXENTIAL_DB_PATH || null;

// If set, persistence is enabled. If not, pure in-memory (current behavior).
// Example: MAXENTIAL_DB_PATH=~/.maxential/thinking.db
```

```typescript
// First two lines of persistence setup — the ones your questions surfaced
db.pragma('journal_mode = WAL');     // concurrent readers, non-blocking
db.pragma('busy_timeout = 5000');    // retry on contention, don't fail
```

---

## Schema

### Table: `sessions`
The top-level container. One session = one conversation or one Agent Teams project.

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,                          -- uuid
    name        TEXT NOT NULL,                             -- human-readable
    description TEXT,                                      -- optional context
    status      TEXT NOT NULL DEFAULT 'active',            -- active | complete | archived
    created_at  INTEGER NOT NULL,                          -- unix ms
    updated_at  INTEGER NOT NULL                           -- unix ms
);
```

### Table: `thoughts`
The core data. Maps to `ThoughtData` in existing types.

```sql
CREATE TABLE IF NOT EXISTS thoughts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT, -- internal row ID
    session_id          TEXT NOT NULL REFERENCES sessions(id),
    thought_number      INTEGER NOT NULL,                  -- per-session sequence (1, 2, 3...)
    thought             TEXT NOT NULL,                      -- the actual content
    type                TEXT NOT NULL DEFAULT 'thought',    -- thought | summary | checkpoint |
                                                           -- conclusion | branch_start | interjection
    branch_id           TEXT,                               -- NULL = main thread
    agent_id            TEXT,                               -- NULL = orchestrator (Phase 2)
    is_revision         INTEGER NOT NULL DEFAULT 0,         -- boolean
    revises_thought     INTEGER,                            -- thought_number it revises
    branch_from_thought INTEGER,                            -- thought_number it branches from
    created_at          INTEGER NOT NULL,                   -- unix ms
    UNIQUE(session_id, thought_number)
);

CREATE INDEX IF NOT EXISTS idx_thoughts_session_branch 
    ON thoughts(session_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_session_agent 
    ON thoughts(session_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_type 
    ON thoughts(session_id, type);
```

### Table: `branches`
Maps to `BranchData` in existing types.

```sql
CREATE TABLE IF NOT EXISTS branches (
    id              TEXT NOT NULL,                          -- user-provided identifier
    session_id      TEXT NOT NULL REFERENCES sessions(id),
    origin_thought  INTEGER NOT NULL,                      -- branched from this thought_number
    status          TEXT NOT NULL DEFAULT 'active',         -- active | closed | merged
    conclusion      TEXT,                                   -- set on close
    agent_id        TEXT,                                   -- owning agent (Phase 2)
    merge_strategy  TEXT,                                   -- conclusion_only | full_integration | summary
    created_at      INTEGER NOT NULL,                      -- unix ms
    closed_at       INTEGER,                               -- unix ms
    merged_at       INTEGER,                               -- unix ms
    PRIMARY KEY (session_id, id)
);
```

### Table: `tags`
Many-to-many relationship. Separate table enables efficient tag-based queries across thoughts.

```sql
CREATE TABLE IF NOT EXISTS tags (
    session_id      TEXT NOT NULL,
    thought_number  INTEGER NOT NULL,
    tag             TEXT NOT NULL,                          -- lowercase, trimmed
    PRIMARY KEY (session_id, thought_number, tag)
);

CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);       -- cross-session tag search
```

### Table: `thought_references`
DAG support — the `references[]` field exists in `ThoughtData` types but isn't implemented yet. Table ready for when it is.

```sql
CREATE TABLE IF NOT EXISTS thought_references (
    session_id      TEXT NOT NULL,
    from_thought    INTEGER NOT NULL,                      -- this thought...
    to_thought      INTEGER NOT NULL,                      -- ...references this thought
    PRIMARY KEY (session_id, from_thought, to_thought)
);
```

### Table: `agents` *(v2.4 — table created now, populated later)*
Tracks agent lifecycle in multi-agent sessions.

```sql
CREATE TABLE IF NOT EXISTS agents (
    id              TEXT NOT NULL,                          -- agent identifier
    session_id      TEXT NOT NULL REFERENCES sessions(id),
    name            TEXT NOT NULL,                          -- human-readable name
    description     TEXT,                                   -- what this agent does
    parent_agent_id TEXT,                                   -- for nested agents
    status          TEXT NOT NULL DEFAULT 'active',         -- active | completed | failed | blocked
    branch_id       TEXT,                                   -- auto-created branch for this agent
    registered_at   INTEGER NOT NULL,                      -- unix ms
    completed_at    INTEGER,                               -- unix ms
    PRIMARY KEY (session_id, id)
);

CREATE INDEX IF NOT EXISTS idx_agents_status 
    ON agents(session_id, status);
```

### Table: `syntheses` *(v3.0 — table created now, populated later)*
Integrated conclusions from multiple agent branches.

```sql
CREATE TABLE IF NOT EXISTS syntheses (
    id              TEXT PRIMARY KEY,                       -- uuid
    session_id      TEXT NOT NULL REFERENCES sessions(id),
    source_branches TEXT NOT NULL,                          -- JSON array of branch IDs
    content         TEXT NOT NULL,                          -- the synthesized analysis
    created_at      INTEGER NOT NULL                       -- unix ms
);
```

---

## Entity Relationship

```
┌──────────────┐
│   sessions   │
│──────────────│
│ • id (PK)    │
│ • name       │
│ • status     │
└──────┬───────┘
       │ 1:many
       ├─────────────────────┬──────────────────┬─────────────────┐
       ▼                     ▼                  ▼                 ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐  ┌──────────────┐
│   thoughts   │   │   branches   │   │    agents    │  │  syntheses   │
│──────────────│   │──────────────│   │──────────────│  │──────────────│
│ • session_id │   │ • session_id │   │ • session_id │  │ • session_id │
│ • thought_#  │   │ • id         │   │ • id         │  │ • id         │
│ • thought    │   │ • status     │   │ • name       │  │ • content    │
│ • branch_id ─┼──▶│ • conclusion │   │ • status     │  │ • sources[]  │
│ • agent_id  ─┼───┼──────────────┼──▶│ • branch_id ─┼─▶│              │
│ • type       │   │ • agent_id  ─┼──▶│              │  │              │
└──────┬───────┘   └──────────────┘   └──────────────┘  └──────────────┘
       │ 1:many              
       ▼                     
┌──────────────┐   ┌────────────────────┐
│     tags     │   │ thought_references │
│──────────────│   │────────────────────│
│ • thought_#  │   │ • from_thought     │
│ • tag        │   │ • to_thought       │
└──────────────┘   └────────────────────┘
```

---

## How It Integrates with Existing Code

### Current Architecture (v2.2)
```
[AI] → tool call → [index.ts] → method call → [lib.ts: SequentialThinkingServer]
                                                    │
                                                    ▼
                                              In-memory arrays:
                                              • thoughtHistory[]
                                              • branches{}
```

### V3 Architecture (Phase 1)
```
[AI] → tool call → [index.ts] → method call → [lib.ts: SequentialThinkingServer]
                                                    │
                                               ┌────┴────┐
                                               ▼         ▼
                                         In-memory   [persistence.ts: PersistenceLayer]
                                         arrays           │
                                         (fast reads)     ▼
                                                     SQLite DB
                                                     (durability + sharing)
```

### Write Flow (e.g., `think()`)
```
1. AI calls think("Analyzing the problem...")
2. SequentialThinkingServer.think() → adds to in-memory thoughtHistory[]
3. If persistence enabled: PersistenceLayer.insertThought() → writes to SQLite
4. Return response to AI (same as v2.2, no change)
```

### Load Flow (e.g., `session_load`)
```
1. AI calls session_load({ id: "abc-123" })
2. PersistenceLayer.loadSession("abc-123") → reads from SQLite
3. Populates SequentialThinkingServer's in-memory arrays
4. AI continues thinking as if it had been there all along
```

---

## New Tools (Phase 1)

### `session_save`
Explicit save with metadata. (Data is already persisted per-write, but this allows naming/describing the session.)

```typescript
{
    name: "session_save",
    input: {
        name: string,           // required: "Debugging auth flow"
        description?: string    // optional context
    },
    output: {
        sessionId: string,
        name: string,
        thoughtCount: number,
        branchCount: number,
        savedAt: number
    }
}
```

### `session_load`
Restore a previous session into memory.

```typescript
{
    name: "session_load",
    input: {
        id: string              // session UUID
    },
    output: {
        sessionId: string,
        name: string,
        thoughtCount: number,
        branchCount: number,
        status: string,
        loadedAt: number
    }
}
```

### `session_list`
Browse available sessions.

```typescript
{
    name: "session_list",
    input: {
        status?: string,        // filter by status
        limit?: number          // default 20
    },
    output: {
        sessions: SessionMetadata[],
        totalCount: number
    }
}
```

### `session_summary`
Generate a compressed summary for token-efficient loading into new contexts.

```typescript
{
    name: "session_summary",
    input: {
        id: string,             // session UUID
        maxLength?: number      // target summary length in chars
    },
    output: {
        sessionId: string,
        summary: string,        // compressed narrative of the session
        thoughtCount: number,
        branchCount: number,
        keyFindings: string[]   // extracted from tagged/concluded thoughts
    }
}
```

---

## File Size Impact

| Component | Estimated Size |
|-----------|---------------|
| `src/persistence.ts` (new) | ~15-20 KB |
| Changes to `src/lib.ts` | ~5-10 KB net additions |
| New tool defs in `src/index.ts` | ~3-5 KB |
| Schema SQL (embedded in persistence.ts) | ~2 KB |
| **Total code growth** | **~25-37 KB** |
| **better-sqlite3 dependency** | **Already installed (v2.2.0)** |
| **Typical SQLite DB file** | **< 1 MB for thousands of thoughts** |

---

## Design Questions — Resolved

1. **DB file location**: ✅ **Project-local default** (`.maxential/thinking.db` in working directory). Override via `MAXENTIAL_DB_PATH` env var for global or custom paths. Disable persistence entirely with `MAXENTIAL_DB_PATH=:memory:`.

2. **Auto-session vs explicit session**: ✅ **Auto-create with human-readable label.** First `think()` call generates `"Session YYYY-MM-DD h:mm AM/PM"`. Optional: append first ~50 chars of first thought as context suffix. `session_save` renames/describes later.

3. **Session isolation**: Scoped to the DB file. Cross-project sharing is possible by pointing `MAXENTIAL_DB_PATH` to a shared location — user's choice, not the default.

4. **Model-agnostic design**: ✅ Schema and tools have no model-specific dependencies. Any MCP client that calls the tools can read/write to the shared SQLite file. The `agents` table will store agent identifiers regardless of what model or harness drives them.

---

*This schema is designed to be created once and never migrated. Future versions (v2.4 agent awareness, v3.0 cross-agent intelligence) populate tables that already exist.*
