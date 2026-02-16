# MAXential Thinking MCP — Development Plan

## Supersedes: V3-RESEARCH-ROADMAP.md
## Incorporates: Phase 0 Findings, Persistence Schema Design, Product Strategy Decisions

**Date:** February 15, 2026 (revised February 16, 2026)
**Author:** Kent + Claude (collaborative sessions)
**Status:** Active — Phase 1 Ready to Build
**Origin:** White paper "Beyond Reward Signals: Metacognitive Architecture as the Missing Layer in AI Advancement"

---

## Strategic Decision Log

| Decision | Date | Rationale |
|----------|------|-----------|
| Agent-MCP model is all three (A, B, C) depending on context | Feb 15, 2026 | Phase 0 research — see findings doc |
| SQLite with WAL mode + `busy_timeout` for persistence | Feb 15, 2026 | Handles concurrent agents, zero dependencies, sub-ms writes |
| MAXential is model-agnostic, not Claude-specific | Feb 15, 2026 | Persistence layer (SQLite file) is the universal coordination substrate — any MCP client can use it |
| "Shared vs separate process" is the core design challenge for multi-agent | Feb 15, 2026 | Must work transparently across same-process, same-machine, and future networked modes |
| Project-local DB default (`.maxential/`) with env var override | Feb 15, 2026 | Agent teammates auto-discover; global via `MAXENTIAL_DB_PATH` |
| Human-readable auto-labels for sessions | Feb 15, 2026 | "Session 2026-02-15 2:30 PM" with optional context extraction |
| Single product — no fork | Feb 16, 2026 | Multi-agent features are a deployment pattern, not a separate product. One repo, one npm package, one maintenance surface. Agent awareness is additive to the existing tool set. |
| Keep the MAXential Thinking name | Feb 16, 2026 | Already published on npm, referenced in white paper, on GitHub. Renaming costs outweigh benefits. The README explains the value, not the name. |

---

## Product Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  MAXential Thinking MCP                                     │
│  "Metacognitive thinking tools for any AI"                  │
│  ─────────────────────────────────────────                  │
│                                                             │
│  v2.2 (current)  — 16 tools, in-memory thinking engine     │
│  v2.3 (Phase 1)  — + persistence layer, 4 session tools    │
│  v2.4 (Phase 2)  — + agent awareness, 8 multi-agent tools  │
│  v3.0 (Phase 3)  — + cross-agent intelligence              │
│                                                             │
│  npm: @bam-devcrew/maxential-thinking-mcp                   │
│  Model-agnostic — works with any MCP client                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## The Core Design Challenge: Universal Process Coordination

### The Problem

When multiple AI agents need to share a thinking space, the coordination mechanism depends on how those agents relate to the MCP server process. This is a universal problem — not specific to any model or harness.

### Three Coordination Modes

```
MODE 1: SHARED PROCESS                    MODE 2: SHARED FILE
┌──────────────────────┐                  ┌──────────┐  ┌──────────┐
│   Host Application   │                  │ Agent A   │  │ Agent B   │
│  ┌────────────────┐  │                  │ ┌──────┐  │  │ ┌──────┐  │
│  │  Orchestrator   │  │                  │ │ MCP  │  │  │ │ MCP  │  │
│  │  Agent A        │──┼── same instance  │ │inst. │  │  │ │inst. │  │
│  │  Agent B        │  │                  │ └──┬───┘  │  │ └──┬───┘  │
│  └───────┬────────┘  │                  └────┼──────┘  └────┼──────┘
│     ┌────▼─────┐     │                       │              │
│     │  MCP    │     │                       ▼              ▼
│     │ (memory) │     │                  ┌────────────────────────┐
│     └──────────┘     │                  │  .maxential/thinking.db │
└──────────────────────┘                  │  (SQLite + WAL)         │
                                          └────────────────────────┘

MODE 3: NETWORKED (future)
┌──────────┐  ┌──────────┐
│ Agent A   │  │ Agent B   │
│ (machine1)│  │ (machine2)│
└─────┬─────┘  └─────┬─────┘
      │              │
      ▼              ▼
┌────────────────────────┐
│  MAXential Server (HTTP)│
│  ┌──────────────────┐  │
│  │  SQLite backend   │  │
│  └──────────────────┘  │
└────────────────────────┘
```

### Known Examples of Each Mode

| Mode | Known Implementations | Behavior |
|------|----------------------|----------|
| Shared Process | Claude Code foreground subagents | Agents share MCP instance; in-memory state is automatically shared |
| Shared Process | Any MCP client with in-process subagents | Same behavior — memory is shared |
| Shared File | Claude Code Agent Teams | Each teammate loads its own MCP instances from project config; coordinates via files on disk |
| Shared File | Cursor multi-agent workflows | Separate processes, shared project directory |
| Shared File | Any multi-process MCP workflow | Multiple instances reading/writing same SQLite DB |
| No MCP Access | Claude Code background subagents | Agent has no MCP tools; orchestrator must proxy context via prompts |
| Networked | Future / custom SDK builds | HTTP/SSE transport, remote connections |

### Design Principle: Transparent Mode Handling

The persistence layer handles coordination transparently without user configuration:

1. **Shared-process mode** — In-memory state is shared automatically. No detection needed.

2. **Shared-file mode** — Multiple instances hitting the same SQLite file are coordinated by WAL + `busy_timeout`. No detection needed.

3. **No-MCP mode** — The agent doesn't have our tools. The orchestrator handles this by reading from MAXential and injecting context into the agent's prompt. This is an orchestrator pattern, not a MAXential feature.

4. **Networked mode** — Future: MAXential starts as an HTTP server instead of stdio. Configured explicitly.

**Key insight:** Modes 1 and 2 require no detection. In-memory works when processes are shared. SQLite works when they're separate. Both run in parallel (write-through). The persistence layer IS the solution for cross-process coordination, and in-memory IS the solution for same-process coordination.

---

## Development Phases

### Phase 1: v2.3 — Persistence Layer

**Goal:** Ship SQLite persistence. Universal benefit — sessions survive across conversations, and multi-agent coordination becomes possible as a side effect.

**New files:**
- `src/persistence.ts` — SQLite operations, schema creation, WAL setup

**Modified files:**
- `src/lib.ts` — Wire `SequentialThinkingServer` to write-through to persistence
- `src/index.ts` — Add 4 new tool definitions
- `src/types/index.ts` — Minor additions (session types already exist)

**New tools (4):**
- `session_save` — Name/describe current session
- `session_load` — Restore a previous session into memory
- `session_list` — Browse available sessions
- `session_summary` — Generate compressed summary for token-efficient loading

**Configuration:**
```bash
# Default: project-local persistence
# Auto-creates .maxential/thinking.db in working directory

# Override: custom path (global or shared location)
MAXENTIAL_DB_PATH=/custom/path/thinking.db

# Disable persistence entirely (pure in-memory, v2.2 behavior)
MAXENTIAL_DB_PATH=:memory:
```

**SQLite pragmas:**
```sql
PRAGMA journal_mode = WAL;       -- concurrent readers, non-blocking writes
PRAGMA busy_timeout = 5000;      -- retry on contention for 5s before failing
```

**Schema:** 7 tables created upfront (see V3-PERSISTENCE-SCHEMA.md)
- `sessions`, `thoughts`, `branches`, `tags` — used immediately
- `thought_references`, `agents`, `syntheses` — created empty, used by Phase 2+

**Session auto-creation:**
- First `think()` call auto-creates a session if none exists
- Auto-label: `"Session YYYY-MM-DD h:mm AM/PM"`
- Optional: extract first ~50 chars of first thought as suffix
- `session_save` renames/describes it later

**Deliverables:**
- [ ] `src/persistence.ts` — PersistenceLayer class
- [ ] Schema creation with all 7 tables + indices
- [ ] Write-through from all existing tools (think, revise, branch, tag, etc.)
- [ ] `session_save` tool
- [ ] `session_load` tool (hydrates in-memory state from SQLite)
- [ ] `session_list` tool
- [ ] `session_summary` tool
- [ ] Tests: persistence round-trip, concurrent access, backward compatibility
- [ ] npm publish as `@bam-devcrew/maxential-thinking-mcp@2.3.0`

---

### Phase 2: v2.4 — Agent Awareness

**Goal:** Add agent lifecycle and cross-agent observation tools. Multi-agent coordination becomes a first-class feature.

**Prerequisite:** v2.3 shipped and stable.

**New tools (8):**

| Tool | Purpose |
|------|---------|
| `agent_register` | Agent announces itself, states purpose, auto-creates named branch. Metadata: name, task, parent agent, timestamp |
| `agent_handoff` | Structured completion: conclusion, tagged findings, confidence, unresolved questions |
| `agent_status` | Report/query agent state: active, blocked, completed, failed |
| `agent_observe` | Read another agent's thinking chain (real-time or post-completion) |
| `agent_interject` | Write a thought INTO another agent's branch — redirect, hint, correction |
| `cross_agent_search` | Search across ALL agent branches by content, tags, or metadata |
| `synthesis` | Integrate multiple agent branch conclusions into unified analysis |
| `session_agents` | List all agents in current session with status and branch info |

**Investigation items (run in parallel with development):**
- [ ] Test multi-instance SQLite coordination with various MCP clients
- [ ] Document coordination patterns per client
- [ ] Determine if mode detection is needed or if dual-mode (memory + SQLite) handles everything

**Deliverables:**
- [ ] Agent lifecycle tools
- [ ] Cross-agent observation tools
- [ ] Updated `search`, `export`, `visualize` with agent filtering
- [ ] Tests: multi-agent scenarios, concurrent writes
- [ ] npm publish as `@bam-devcrew/maxential-thinking-mcp@2.4.0`

---

### Phase 3: v3.0 — Cross-Agent Intelligence

**Goal:** Pattern detection, automatic cross-referencing, session-spanning insights.

**New capabilities:**
- Automatic contradiction detection across agent branches
- Tag-based cross-referencing (agents using similar tags = potential connection)
- Content-based similarity detection across branches
- Session-spanning pattern extraction (what works, what fails)
- Agent performance profiling (which agents produce high-value reasoning)

**Deliverables:**
- [ ] Contradiction detection in `cross_agent_search`
- [ ] Auto-tagging suggestions based on content analysis
- [ ] Session analytics tools
- [ ] Cross-session learning layer (the "super memory" concept from whitepaper)

---

### Phase 4: Networked Architecture (if needed)

**Goal:** HTTP/SSE transport for remote multi-machine coordination.

**Trigger:** Only build this if real users need agents on different machines sharing a thinking space. Don't build speculatively.

**Deliverables:**
- [ ] HTTP/SSE server mode (alternative to stdio)
- [ ] Authentication and access control
- [ ] Remote agent registration and observation
- [ ] Performance testing at scale

---

## Connection to White Paper Thesis

| White Paper Concept | Implementation | Phase |
|---|---|---|
| External metacognitive scaffolding | Thinking tools (think, branch, revise, search) | v2.x (shipped) |
| Accumulated self-knowledge | Persistent sessions, cross-session patterns | v2.3 (Phase 1) |
| Parallel exploration | Agent branches exploring simultaneously | v2.4 (Phase 2) |
| Real-time self-monitoring | `agent_observe` + `agent_interject` | v2.4 (Phase 2) |
| Interpretability-capability loop | Studying tool usage patterns to inform architecture | v3.0 (Phase 3) |
| Super memory | Cross-session learning layer | v3.0 (Phase 3) |
| Metacognitive architecture | The complete cognitive infrastructure | v3.0+ |

---

## Immediate Next Steps

1. **Build:** v2.3 persistence layer (`src/persistence.ts`)
2. **Test:** Session round-trip, concurrent access, backward compatibility
3. **Ship:** `@bam-devcrew/maxential-thinking-mcp@2.3.0`
4. **Document:** Multi-agent usage patterns in README (shared SQLite via Agent Teams, etc.)
5. **Investigate:** Multi-client coordination testing (shared-file mode)
6. **Build:** v2.4 agent awareness tools

---

*This is a living document. Updated as decisions are made and findings emerge.*
