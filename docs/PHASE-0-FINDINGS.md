# MAXential Thinking V3 — Phase 0 Investigation Findings

## Agent-MCP Connection Model: Research Results

**Date:** February 15, 2026  
**Investigators:** Kent + Claude (collaborative session)  
**Status:** Phase 0 COMPLETE — Ready for architectural decision  
**Context:** This investigation addresses the roadmap's critical first question: *When Claude spawns a sub-agent, does that agent share MCP connections (A), get isolated sessions (B), or have no MCP access (C)?*

---

## Executive Finding

**The answer is not A, B, or C — it's all three, depending on execution context.**

The Claude ecosystem now has three distinct agent execution modes, each with fundamentally different MCP inheritance behavior. This is more nuanced than the roadmap anticipated, and it *strengthens* the case for the persistence layer — because the most powerful multi-agent mode (Agent Teams) requires it.

---

## Detailed Findings by Execution Context

### 1. Claude Code — Foreground Subagents → Option (A): Shared Instance

**MCP Behavior:** Subagents inherit all tools from the main conversation, including MCP tools. They share the same MCP server instance as the orchestrator.

**Source:** [Claude Code Docs — Subagents](https://code.claude.com/docs/en/sub-agents): *"Subagents can use any of Claude Code's internal tools. By default, subagents inherit all tools from the main conversation, including MCP tools."*

**Implications for MAXential V3:**
- Current in-memory architecture works as-is for this mode
- All agents read/write the same thinking state automatically
- Tool restriction is possible via `tools` (allowlist) or `disallowedTools` (denylist) in subagent definitions
- Simplest integration path — just add agent-awareness metadata to existing tools

**Constraints:**
- Subagents cannot spawn other subagents (no nested delegation)
- Each invocation creates fresh context (but can be "resumed" with full history)
- Maximum 7 simultaneous subagents
- Known bugs: plugin-defined subagents sometimes fail to inherit MCP tools (multiple open issues since Dec 2025)

---

### 2. Claude Code — Background Subagents → Option (C): No MCP Access

**MCP Behavior:** MCP tools are explicitly unavailable in background subagents.

**Source:** [Claude Code Docs — Subagents](https://code.claude.com/docs/en/sub-agents): *"MCP tools are not available in background subagents."*

**Implications for MAXential V3:**
- Background agents cannot directly use MAXential tools
- Requires the orchestrator-as-proxy pattern described in the original roadmap
- Orchestrator would read relevant thinking context and include it in the agent's prompt
- Agent outputs would be parsed back into the thinking chain by the orchestrator
- Most limited but still valuable for context-preparation

**Constraints:**
- If a background subagent needs permissions it doesn't have, the tool call fails silently (subagent continues)
- Can be "resumed" in foreground to retry with interactive prompts and MCP access

---

### 3. Claude Code — Agent Teams → Option (B): Isolated Sessions, Shared Config

**This is the most significant finding.** Agent Teams shipped with Opus 4.6 on February 5, 2026 — just 10 days before this investigation. It fundamentally changes the multi-agent landscape.

**MCP Behavior:** Each teammate is a fully independent Claude Code session with its own context window. Teammates load the same project configuration (CLAUDE.md, MCP servers, skills) but do NOT inherit the lead's conversation history. Each teammate spins up its own MCP server instances from the shared project config.

**Source:** [alexop.dev — Agent Teams](https://alexop.dev/posts/from-tasks-to-swarms-agent-teams-in-claude-code/): *"Each teammate is a full Claude Code session with its own context window. They load the same project context (CLAUDE.md, MCP servers, skills) but don't inherit the lead's conversation history. The task files on disk and SendMessage are the only coordination channels—there's no shared memory."*

**Implications for MAXential V3:**
- Multiple MAXential MCP instances would be running simultaneously (one per teammate)
- In-memory state is NOT shared between teammates
- **Persistence layer is REQUIRED** for Agent Teams integration
- A shared SQLite database would allow all MAXential instances to coordinate
- This is the most powerful multi-agent mode AND the one that needs MAXential most

**Agent Teams Architecture:**
- Coordination via: shared task list (file on disk) + direct peer messaging (mailbox system)
- Tasks have three states: pending → in progress → completed
- Teammates can self-claim or be assigned tasks by the lead
- Dependency chains enable wave-based execution
- File locking prevents double-claiming
- Experimental: gated behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Proven at scale: Anthropic used 16 parallel Opus 4.6 instances to build a 100,000-line C compiler

**Critical Observation:** Agent Teams' coordination primitives (task list + mailbox) are structurally similar to but LESS capable than what MAXential V3 proposes. Agent Teams provides:
- Task assignment and status tracking
- Direct messaging between agents
- File-based coordination

MAXential V3 would add:
- Structured reasoning chains (not just messages)
- Tagged, searchable thinking history across all agents
- Cross-agent pattern detection and contradiction identification
- Synthesis of multiple agents' reasoning into integrated conclusions
- Persistent reasoning artifacts across sessions
- Real-time observation of another agent's thinking process

**This positions the multi-agent product (MAXc) as a complementary metacognitive layer on top of Agent Teams — and any other multi-agent MCP workflow — not a replacement for any of them.**

**Model-Agnostic Reframing (Updated Feb 15):** While Agent Teams is Claude-specific, the underlying coordination problem is universal. Any MCP client that spawns multiple processes needs a shared thinking substrate. The persistence layer (SQLite + WAL) IS the model-agnostic solution — it doesn't care what model or harness wrote the thought, only that MCP tools were called. This means the same infrastructure serves Claude Agent Teams, Cursor multi-agent workflows, VS Code Copilot, Gemini CLI, and any future MCP client.

---

### 4. Claude Agent SDK — Programmatic Control → All Options Available

The Agent SDK (formerly Claude Code SDK) provides the most flexible configuration. Each subagent can be explicitly configured with its own MCP servers.

**Key capabilities:**
- `mcpServers` can be passed per-agent in the `AgentDefinition`
- `createSdkMcpServer()` enables in-process MCP servers (no external process needed)
- Permission modes propagate to subagents spawned by the Task tool
- Hook system allows intercepting tool calls (potential for automatic thought logging)
- Subagent definitions include: `description`, `tools`, `prompt`, `model`, `mcpServers`

**Implications for MAXential V3:**
- The SDK path gives full control over which agents connect to which MCP servers
- Could run MAXential as an SDK MCP server (in-process with orchestrator)
- Could configure all agents to connect to the same external MAXential server
- Hook system could automatically log all tool usage to the thinking chain
- Most flexible but requires building the orchestrator application

---

## Architecture Recommendation

### The Layered Approach

Given that all three connection models exist and serve different use cases, V3 should implement a **layered architecture** that adapts to the execution context:

```
┌─────────────────────────────────────────────────────────┐
│                   MAXential V3 MCP Server                │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Thinking Engine (Core)                │   │
│  │   thoughts[] · branches[] · tags[] · search       │   │
│  └──────────────┬───────────────────────┬────────────┘   │
│                 │                       │                 │
│  ┌──────────────▼──────┐  ┌────────────▼──────────────┐ │
│  │   In-Memory Store   │  │   SQLite Persistence      │ │
│  │  (foreground subs)  │  │   (Agent Teams / cross-   │ │
│  │                     │  │    session continuity)     │ │
│  └─────────────────────┘  └───────────────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Agent Awareness Layer (Phase 2)           │   │
│  │  agent_register · agent_handoff · agent_observe    │   │
│  │  agent_interject · cross_agent_search · synthesis  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Transport Layer (Phase 4 if needed)        │   │
│  │         stdio (current) │ HTTP/SSE (future)        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Why SQLite?

SQLite is the clear choice for the persistence layer:

1. **Agent Teams requires it** — the most powerful multi-agent mode has isolated MCP instances that need shared state
2. **WAL (Write-Ahead Logging) mode** handles concurrent readers with single writer efficiently — perfect for multiple agent instances reading + one writing
3. **Zero external dependencies** — no Redis, no API server, just a file
4. **Works offline** — critical for local development workflows
5. **Cross-session continuity for free** — persisted data survives session end
6. **Battle-tested** — SQLite handles millions of concurrent reads; our use case is tiny by comparison
7. **Future-proof** — can be fronted by an HTTP server later if networked mode is needed

### Dual-Mode Operation

MAXential V3 should detect its execution context and route accordingly:

- **Shared instance detected** (foreground subagent): Use in-memory store as primary, write-through to SQLite for persistence
- **Independent instance detected** (Agent Team teammate): Use SQLite as primary, in-memory as cache
- **Detection mechanism**: Check for a session lock file or environment variable set by the orchestrator

---

## Updated Phase Plan

Based on these findings, the development phases should be adjusted:

### Phase 1: Persistence Layer (NEXT)
- [ ] Add SQLite persistence backend with WAL mode
- [ ] Implement `session_save` / `session_load` / `session_summary`
- [ ] Add session ID + agent ID to thought schema
- [ ] Dual-mode: in-memory primary with SQLite write-through
- [ ] Backward compatible — in-memory-only mode still works if no SQLite configured
- [ ] Test: single session persists and reloads correctly

### Phase 2: Agent Awareness
- [ ] Add `agent` field to thought schema
- [ ] Implement `agent_register` — auto-branch creation with agent metadata
- [ ] Implement `agent_handoff` — structured conclusion protocol
- [ ] Implement `agent_status` — lifecycle tracking
- [ ] Update existing tools (history, search, export, visualize) with agent filtering

### Phase 3: Agent Teams Integration
- [ ] Test MAXential persistence with Agent Teams (multiple instances, shared SQLite)
- [ ] Implement `agent_observe` — read another agent's thinking chain
- [ ] Implement `cross_agent_search` — search across all agent branches
- [ ] Implement `synthesis` — multi-branch conclusion integration
- [ ] Handle concurrency: read/write coordination between instances

### Phase 4: Cross-Agent Intelligence
- [ ] `agent_interject` — orchestrator writes into agent's branch
- [ ] Automatic cross-reference detection (tag-based, content-based)
- [ ] Pattern extraction across sessions
- [ ] Agent performance profiling

### Phase 5: Networked Architecture (if needed)
- [ ] HTTP/SSE transport layer
- [ ] Multiple simultaneous remote connections
- [ ] Authentication and access control

---

## Open Questions Refined

1. **Agent Teams stability:** The feature is experimental (10 days old). How stable is it? Should we build against it now or wait for it to mature?

2. **Concurrent write handling:** When multiple Agent Team teammates write to MAXential simultaneously, how do we handle write conflicts? SQLite WAL handles concurrent readers well, but concurrent writers need serialization.

3. **Session discovery:** How does a new MAXential instance (spawned by Agent Teams) discover the correct session to join? Environment variable? Config file? Convention-based path?

4. **Token efficiency:** The thinking chain grows over time. How do we keep the data each agent reads from MAXential token-efficient? Tagging + selective retrieval is the current plan, but we need to validate this empirically.

5. **Agent SDK path:** Should we also pursue the Agent SDK integration path in parallel? It gives the most control but requires building a custom orchestrator application.

---

## Immediate Next Steps

1. **Kent to test:** Enable Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) and verify MAXential behavior — does each teammate get its own instance?
2. **Together:** Review these findings and confirm architectural direction
3. **Build:** Phase 1 persistence layer (SQLite backend)
4. **Test:** Single agent writing to persistent MAXential + separate instance reading
5. **Iterate:** Agent Teams integration testing

---

*This document supersedes the Phase 0 section of the original V3 Research Roadmap. The roadmap's vision remains valid; these findings refine the implementation path.*
