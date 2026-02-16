# MAXential Thinking V3 — Research Roadmap & Plan

## Shared Metacognitive Bus for Multi-Agent AI Workflows

**Date:** February 15, 2026
**Author:** Kent + Claude (collaborative session)
**Status:** Research & Discovery Phase
**Origin:** Conversation exploring AI metacognition, reward signal bottlenecks, and the gap between interpretability and capability research. Full thesis documented in white paper: "Beyond Reward Signals: Metacognitive Architecture as the Missing Layer in AI Advancement"

---

## The Core Question

**How do we evolve MAXential Thinking from a single-AI metacognitive scaffold into a shared reasoning substrate where multiple agents contribute to, observe, and draw from a unified thinking space — making agent reasoning transparent, searchable, and integrated rather than black-boxed?**

---

## Problem Statement

### Current State (v2.2)
- One AI, one thinking session, branches are conceptual alternatives
- In-memory storage — everything lost when session ends
- No awareness of multi-agent workflows
- No persistence across conversations

### Problems This Creates in Agent Workflows
1. **Agent reasoning is opaque.** Sub-agents run, produce a summary, discard all intermediate reasoning. The orchestrator sees conclusions but not the thinking that produced them — no dead ends explored, no nuances discovered, no "almost went this way" signals.
2. **Token waste through redundant context.** Each agent receives a large context dump and re-reasons over shared ground. No structured handoff of distilled reasoning between agents.
3. **No cross-agent pattern recognition.** When multiple agents work on related aspects of a problem, there's no mechanism to detect connections, contradictions, or complementary insights across their reasoning chains.
4. **No real-time monitoring.** The orchestrator cannot observe agent reasoning as it happens — only after completion. No ability to redirect an agent mid-reasoning.

---

## V3 Vision: The Shared Metacognitive Bus

MAXential becomes the **nervous system** of a multi-agent cognitive architecture:

- **Orchestrator** = conscious executive function (main branch)
- **Agents** = specialised cognitive processes (agent branches)
- **MAXential** = shared workspace where all coordinate
- **Cross-agent tools** = self-observation capability — the system examining how its own agents reason

---

## Proposed New Tools

### Agent Lifecycle Tools

| Tool | Purpose |
|------|---------|
| `agent_register` | Agent announces itself, states purpose, auto-creates a named branch. Metadata: agent name, task description, parent agent (if nested), timestamp |
| `agent_handoff` | Structured completion: conclusion, tagged key findings, confidence level, unresolved questions. Marks branch as complete-but-readable |
| `agent_status` | Report current agent state: active, blocked, completed, failed. Enables orchestrator dashboard |

### Cross-Agent Observation Tools

| Tool | Purpose |
|------|---------|
| `agent_observe` | Orchestrator reads another agent's thinking chain in real-time, not just post-completion. The core "monitoring" capability |
| `agent_interject` | Orchestrator writes a thought INTO an agent's branch — a redirect, a hint, a correction. The agent sees it as a tagged interjection it should attend to |
| `cross_agent_search` | Search across ALL agent branches by content, tags, or metadata. Find patterns, connections, contradictions |
| `synthesis` | Takes multiple agent branch conclusions and produces an integrated analysis. Can be auto-triggered or manual |

### Persistence Tools

| Tool | Purpose |
|------|---------|
| `session_save` | Persist the full thinking state (all branches, tags, metadata) to durable storage |
| `session_load` | Restore a previous thinking session — enables cross-conversation continuity |
| `session_summary` | Generate a compressed summary of a session for efficient loading into new contexts |

---

## Architecture Decisions to Investigate

### CRITICAL: Agent-MCP Connection Model

**This is the first thing to nail down.** Everything else depends on it.

**Question:** When Claude MAX spawns a sub-agent, does that agent:
- (A) Share the same MCP server connections as the orchestrator?
- (B) Get its own isolated MCP session?
- (C) Have no MCP access at all?

**If (A) — Shared instance:**
- Current in-memory architecture extends naturally
- All agents read/write the same thinking state
- Simplest path to v3
- Just need to add agent-awareness to existing tools

**If (B) — Isolated sessions:**
- Need a persistence backend that all sessions connect to
- Options: SQLite, JSON file store, Redis, or a thin API layer
- Each agent instance connects to the same backend
- More complex but more robust

**If (C) — No MCP access:**
- Agents would need to receive thinking context through their prompt
- MAXential serves as a context-preparation layer for the orchestrator
- Orchestrator reads the thinking chain and includes relevant portions in agent prompts
- Agent outputs are parsed back into thinking chain by orchestrator
- Most limited but still valuable

### Investigation Plan
1. Test with Kent's MAX subscription: spawn a sub-agent and check if it can see/use MAXential tools
2. Check Claude agent documentation for MCP inheritance behaviour
3. Test whether agent system prompts can instruct tool usage
4. Document findings and select architecture path

---

## Persistence Architecture

### Current: In-Memory Only
```
[AI Session] → [MAXential MCP (memory)] → session ends → gone
```

### V3 Minimum: File-Based Persistence
```
[AI Session(s)] → [MAXential MCP] → [JSON/SQLite file store]
                                   ↑
[Agent 1] ────────────────────────┘
[Agent 2] ────────────────────────┘
```

### V3 Target: Networked Persistence
```
[Orchestrator] ──→ [MAXential MCP Server (networked)]
[Agent 1] ────────→       ↕
[Agent 2] ────────→ [Persistence Layer]
[Agent N] ────────→  (SQLite / Redis / API)
```

### Persistence Schema (Draft)

```
Session
├── id: uuid
├── created: timestamp
├── metadata: { purpose, participants, status }
├── thoughts[]
│   ├── id: number
│   ├── branch: string
│   ├── agent: string | null
│   ├── content: string
│   ├── tags: string[]
│   ├── revises: number | null
│   ├── timestamp: timestamp
│   └── type: think | revise | interject | conclusion
├── branches[]
│   ├── id: string
│   ├── agent: string | null
│   ├── origin_thought: number
│   ├── status: active | closed | merged
│   ├── conclusion: string | null
│   └── metadata: { purpose, confidence, unresolved }
└── syntheses[]
    ├── id: uuid
    ├── source_branches: string[]
    ├── content: string
    └── timestamp: timestamp
```

---

## Token Efficiency Model

### Current Agent Flow (Wasteful)
```
Orchestrator context (N tokens)
  → dumps to Agent 1 (N tokens consumed)
  → Agent 1 reasons (M tokens)
  → returns summary (S tokens) — discards M-S tokens of reasoning
  → dumps to Agent 2 (N + S tokens consumed)
  → cycle repeats, growing
```

### V3 Agent Flow (Efficient)
```
Orchestrator writes structured thinking to MAXential
  → Agent 1 spawns, reads ONLY relevant tagged thoughts (R << N tokens)
  → Agent 1 writes reasoning to its branch (M tokens, PRESERVED)
  → Agent 1 hands off with structured conclusion
  → Agent 2 spawns, reads relevant thoughts + Agent 1's key findings
  → Cross-agent search finds connections automatically
  → Synthesis tool integrates findings
```

**Key insight:** The thinking chain IS the compressed context. Tags and search mean each agent pulls only what's relevant to its task. Tokens go toward NEW reasoning, not re-processing.

---

## Development Phases

### Phase 0: Investigation (NOW)
- [ ] Test agent-MCP connection model on Claude MAX
- [ ] Document how agents discover and use MCP tools
- [ ] Test whether agent system prompts can mandate MAXential usage
- [ ] Review Claude agent API/documentation for relevant constraints
- [ ] Document findings in this repo

### Phase 1: Persistence Layer
- [ ] Add SQLite or JSON file persistence backend
- [ ] Implement `session_save` / `session_load` / `session_summary`
- [ ] Ensure backward compatibility — in-memory mode still works
- [ ] Add session metadata (purpose, participants, timestamps)
- [ ] Test cross-session continuity

### Phase 2: Agent Awareness
- [ ] Add `agent` field to thought schema
- [ ] Implement `agent_register` — auto-branch creation with agent metadata
- [ ] Implement `agent_handoff` — structured conclusion protocol
- [ ] Implement `agent_status` — lifecycle tracking
- [ ] Update `get_history`, `search`, `export` to filter by agent
- [ ] Update `visualize` to show agent branches distinctly

### Phase 3: Cross-Agent Intelligence
- [ ] Implement `agent_observe` — real-time reading of another agent's chain
- [ ] Implement `agent_interject` — orchestrator writes into agent branch
- [ ] Implement `cross_agent_search` — multi-branch pattern detection
- [ ] Implement `synthesis` — multi-branch conclusion integration
- [ ] Add automatic cross-reference detection (tag-based, content-based)

### Phase 4: Networked Architecture
- [ ] Evaluate need for networked MCP server vs file-based sharing
- [ ] If needed: implement HTTP/WebSocket transport layer
- [ ] Enable multiple simultaneous agent connections
- [ ] Add concurrency handling (read/write locks, conflict resolution)
- [ ] Performance testing with multiple concurrent agents

### Phase 5: Intelligence Layer (Research)
- [ ] Pattern extraction across sessions — what tool usage patterns correlate with better outcomes?
- [ ] Automatic session summarisation for context-efficient loading
- [ ] Agent performance profiling — which agents produce high-value vs low-value reasoning?
- [ ] Cross-session learning — the beginning of the "super memory" concept
- [ ] Integration with interpretability tooling — can we observe HOW agents use the scaffold?

---

## Connection to White Paper Thesis

This roadmap is the practical implementation of the theoretical framework in "Beyond Reward Signals":

| White Paper Concept | V3 Implementation |
|---|---|
| Parallel exploration | Agent branches exploring simultaneously |
| Real-time self-monitoring | `agent_observe` + `agent_interject` |
| Accumulated self-knowledge | Persistent sessions + cross-session patterns |
| Interpretability-capability loop | Studying tool usage patterns to inform architecture |
| Super memory | Phase 5 cross-session learning layer |
| Metacognitive architecture | The entire shared bus concept |

---

## Open Questions

1. **Scope of agent autonomy:** How much should the orchestrator control vs let agents self-direct? Can agents spawn sub-agents with their own branches?
2. **Privacy/isolation:** Should agents be able to read ALL other agents' branches, or only branches they're granted access to? Role-based visibility?
3. **Conflict resolution:** When two agents reach contradictory conclusions, how does synthesis handle it? Flag for human review? Weighted by confidence?
4. **Scaling:** What happens with 10, 50, 100 agent branches? Visualisation becomes critical. Need hierarchical views.
5. **IDE integration:** Kent's original vision of interfacing between models and the IDE — how does this fit? Can the IDE visualise the live thinking bus?
6. **Model-agnostic:** Should v3 support non-Claude agents? Multi-model orchestration where different models contribute to the same thinking space?

---

## Immediate Next Steps

1. **Kent:** Test agent-MCP connection model on MAX subscription
2. **Together:** Review findings and select architecture path (A, B, or C)
3. **Together:** Design persistence schema based on connection model
4. **Build:** Phase 1 persistence layer
5. **Test:** Single agent writing to persistent MAXential + orchestrator reading
6. **Iterate:** From there based on what we learn

---

*This document is a living roadmap. It will be updated as we investigate constraints and begin implementation.*
