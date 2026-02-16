# Handoff: MAXential V3 Implementation Planning
Generated: 2026-02-16 15:00
Project: MAXential-Thinking-MCP
Branch: main (MAXential repo)

## Active Plan Context
- Plan documents: `docs/UPDATED-MASTER-PLAN.md` (the implementation plan)
- Supporting docs: `docs/PHASE-0-FINDINGS.md`, `docs/V3-PERSISTENCE-SCHEMA.md`, `docs/V3-SCHEMA-DIAGRAM.mermaid`
- Research roadmap (superseded but useful for background): `docs/V3-RESEARCH-ROADMAP.md`
- Current phase: **Phase 1 — Ready to Build** (persistence layer for MAXential v2.3)
- Origin: White paper "Beyond Reward Signals" — docx/odt copies in `docs/`

## What We Were Working On
This session was focused on **locating** the implementation plan files, not on implementation itself. Kent and a previous Claude session (Feb 15 in Claude Desktop chat) completed:
1. Phase 0 research — how agents connect to MCP servers (all three modes)
2. The implementation plan — two-product strategy (MAXential v2.3 → MAXc fork)
3. Full persistence schema design (7 SQLite tables)
4. Strategic decision log

The files were in a zip archive and have now been extracted to `docs/`.

## Current State
- **Planning is complete.** All four documents are in `docs/` and ready to guide implementation.
- **No code has been written yet.** The codebase is at v2.2 (the version on npm).
- **Build status:** Not checked this session — the repo should be in working state from Jan 28 last session.
- **The docs/ files are untracked in git** — they need to be committed.

## What Changed This Session
- Extracted 4 plan documents from `docs/files.zip` into `docs/`:
  - `UPDATED-MASTER-PLAN.md` — the master implementation plan
  - `PHASE-0-FINDINGS.md` — completed research on agent-MCP connection models
  - `V3-PERSISTENCE-SCHEMA.md` — full SQLite schema with 7 tables
  - `V3-SCHEMA-DIAGRAM.mermaid` — entity relationship diagram

## Mental Model Built Up

### Two-Product Strategy
MAXential stays as the single-AI thinking tool. A new product (MAXc, working name) forks from MAXential v2.3 and adds multi-agent coordination. The persistence layer benefits both — it's the bridge.

### The Three Agent-MCP Connection Modes
1. **Shared Process** (Claude Code foreground subagents) — agents share MCP instance, in-memory state is automatically shared. Current architecture handles this.
2. **Shared File** (Claude Code Agent Teams, Cursor multi-agent) — each agent gets its own MCP instance. **Persistence layer is REQUIRED** for coordination. SQLite + WAL mode handles concurrent access.
3. **No MCP Access** (Claude Code background subagents) — orchestrator must proxy context via prompts. Not a MAXential feature, it's an orchestrator pattern.

### Key Architectural Insight
The persistence layer IS the universal coordination substrate. In-memory handles same-process. SQLite handles cross-process. Both run in parallel (write-through). The "universal problem" is simpler than it first appeared.

### Agent Teams Discovery
Agent Teams shipped Feb 5, 2026 (10 days before the research). It's the most powerful multi-agent mode AND the one that needs MAXential's persistence most. This is the strategic justification for Phase 1.

## Key Files and Their Roles

### Plan Documents (read these to understand what to build)
- `docs/UPDATED-MASTER-PLAN.md` — **THE implementation plan.** Supersedes the research roadmap. Contains product architecture, development phases, strategic decisions, and immediate next steps.
- `docs/PHASE-0-FINDINGS.md` — Research results on how agents connect to MCP. Documents all three modes with sources and implications.
- `docs/V3-PERSISTENCE-SCHEMA.md` — Full schema design. 7 tables, SQL DDL, TypeScript tool specs, integration architecture, write/load flow diagrams.
- `docs/V3-SCHEMA-DIAGRAM.mermaid` — ER diagram for the schema.

### Existing Codebase (what you'll modify)
- `src/lib.ts` — `SequentialThinkingServer` class. The core thinking engine. Phase 1 adds write-through to SQLite here.
- `src/index.ts` — Tool definitions. Phase 1 adds 4 new session tools.
- `src/types/index.ts` — TypeScript types. Minor additions needed (session types partially exist).
- `src/persistence.ts` — **NEW FILE** to create. The `PersistenceLayer` class.

### Reference
- `docs/V3-RESEARCH-ROADMAP.md` — Original research roadmap (superseded but provides background context and the white paper connection).
- `docs/beyond-reward-signals-whitepaper.docx` / `.odt` — The theoretical white paper that originated the V3 vision.

## Decisions Made

1. **Two-product strategy** — Why: Persistence benefits all MAXential users (single-AI sessions become durable). Agent coordination is a distinct, more complex product. Bundling them would delay the persistence benefit.

2. **SQLite with WAL mode** — Why: Zero external dependencies, handles concurrent agents via WAL + busy_timeout, works offline, battle-tested. Already have `better-sqlite3` as a dependency.

3. **Project-local DB default** (`.maxential/thinking.db`) — Why: Agent teammates auto-discover the DB. Global override via `MAXENTIAL_DB_PATH` env var. Disable with `:memory:`.

4. **All 7 tables created upfront** — Why: Empty tables cost nothing in SQLite. No schema migrations needed for future phases. Phases 2+ just start inserting.

5. **MAXc is model-agnostic** — Why: The SQLite file is the coordination substrate. Any MCP client can read/write to it. Not Claude-specific.

6. **Auto-session creation** — Why: First `think()` call auto-creates a session with human-readable label. `session_save` renames later. Frictionless for users who don't care about persistence.

## What's Incomplete
- **All implementation.** No code has been written. Phase 1 is entirely ahead.
- **The untracked docs need to be committed** to the MAXential repo.
- **Build verification** — haven't confirmed the repo builds cleanly from current state.

## Open Questions
1. **Agent Teams stability** — It's experimental (gated behind env var). Build against it now or wait?
2. **Session discovery for Agent Teams** — How does a new MAXential instance find the right session? Env var? Convention? Auto-detect?
3. **MAXc naming** — "MAXc" is a working name. Final name deferred.
4. **Whether to also pursue Agent SDK integration path** in parallel with the MCP tool path.

## For the Next Claude

### Start Here
1. `docs/UPDATED-MASTER-PLAN.md` — The implementation plan. Read this first. It has the product architecture, all phases, and the immediate next steps.
2. `docs/V3-PERSISTENCE-SCHEMA.md` — The schema you'll implement. Has SQL DDL, TypeScript tool specs, and integration flow diagrams.
3. `src/lib.ts` — The existing thinking engine you'll wire persistence into.

### Do NOT Assume
- "V3-RESEARCH-ROADMAP.md is the plan" — No, it's superseded by UPDATED-MASTER-PLAN.md. The roadmap was the initial research vision; the master plan incorporates Phase 0 findings and product strategy decisions.
- "This is a Claude-only tool" — No, MAXential is model-agnostic. The persistence layer must work with any MCP client.
- "Agent Teams is the only multi-agent mode" — No, there are three modes. The architecture must handle all three transparently.

### Landmines
- `better-sqlite3` is already a dependency but verify it's in `package.json` — the v2.2 release may or may not have included it.
- The `docs/files/` and `docs/files (2)/` directories were created during zip extraction — they may contain duplicate files from the zip. Check before committing.
- There's a `.~lock.beyond-reward-signals-whitepaper.docx#` file in docs/ — that's a LibreOffice lock file, don't commit it.

### What I Tried That Failed
Nothing — this session was research/file-location only. No implementation was attempted.

### Kent's Current Thinking
- Kent is ready to build. Phase 1 is approved and documented.
- He found the plan files in a zip archive — they originated from a Claude Desktop chat session (Feb 15, stored server-side, not locally). The artifacts were downloaded as a zip.
- Kent is enthusiastic about this project. The white paper "Beyond Reward Signals" is the intellectual foundation.
- This is a separate project from BAM PROTECT — the working directory is `/media/k3nt/Files/4aDEV/MAXential-Thinking-MCP/`.

### Relevant Constraints
- **KENT_LEADS** — Present options, wait for approval. Do not make architectural choices autonomously. This is especially important for a new implementation — every structural decision needs Kent's sign-off.
- **CODE_QUALITY** — Senior-level, production-ready. No stubs, no TODOs. This is going to npm as a published package.
- **EXISTING_PATTERNS_FIRST** — Read the existing codebase thoroughly before writing new code. Understand the patterns in `lib.ts` and `index.ts` before adding persistence.
- **NO_WORKAROUNDS** — Proper solutions only. SQLite + WAL is the chosen architecture — implement it correctly.
- **WASM_IP_PROTECTION** does NOT apply here — MAXential is open source, not BAM's proprietary code. But CODE_QUALITY still applies fully.

### Confidence Levels
- **CERTAIN:** The four plan documents are complete and represent Kent's approved direction. Phase 1 scope is well-defined.
- **CERTAIN:** The working directory is `/media/k3nt/Files/4aDEV/MAXential-Thinking-MCP/` and the repo is on `main` branch.
- **PROBABLE:** `better-sqlite3` is already installed (schema doc says so, but verify).
- **UNCERTAIN:** Whether the repo builds cleanly right now — not tested this session.

### Tone & Approach Established
- Kent directed the search, Claude executed. Standard KENT_LEADS dynamic.
- Session was collaborative and efficient — no friction.
- Kent proactively recognized context pollution and initiated the handoff. Good sign — he's managing session health actively.

## Relevant Documentation
- `docs/UPDATED-MASTER-PLAN.md` — The implementation plan
- `docs/PHASE-0-FINDINGS.md` — Research results
- `docs/V3-PERSISTENCE-SCHEMA.md` — Schema design
- `docs/V3-SCHEMA-DIAGRAM.mermaid` — ER diagram
- `docs/V3-RESEARCH-ROADMAP.md` — Original research roadmap (superseded)
- `docs/beyond-reward-signals-whitepaper.docx` — White paper

## Git State

### Recent Commits (MAXential repo)
```
1309711 chore: Remove dev handoff doc from repo
8a9f576 chore: Add project docs, registry metadata, and update .gitignore
8757847 feat: Echo thought content in tool responses
```

### Uncommitted Changes
No modified tracked files. Many untracked files in `docs/`:
- `PHASE-0-FINDINGS.md`, `UPDATED-MASTER-PLAN.md`, `V3-PERSISTENCE-SCHEMA.md`, `V3-SCHEMA-DIAGRAM.mermaid`
- `V3-RESEARCH-ROADMAP.md`, `README_OPTIMIZED.md`
- `beyond-reward-signals-whitepaper.docx`, `.odt`
- `files.zip`, `files/`, `files (2)/` (zip extraction artifacts)
- `.~lock.beyond-reward-signals-whitepaper.docx#` (LibreOffice lock — don't commit)
- `maxential-update-handoff-2025-12-21-2300.md`
- This handoff file

### Branch Status
On `main`, up to date with `origin/main`. No unpushed commits.
