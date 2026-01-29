# MAXential Thinking MCP Server

**Structured reasoning tools for Claude and other AI systems.**

An MCP server that gives Claude explicit tools for managing their own reasoning process: adding thoughts, exploring branches, revising earlier thinking, and navigating their thought history.

## What This Does

When Claude reasons through complex problems, they benefit from:
- **Persistent thought chains** - Claude can reference earlier thoughts by number
- **Branching** - Claude can explore alternative approaches without losing the main thread
- **Revision** - Claude can explicitly mark when they're correcting earlier reasoning
- **Navigation** - Claude can retrieve specific thoughts or review their reasoning history

Without these tools, Claude's reasoning is ephemeral and linear. With them, Claude can build structured, navigable reasoning chains.

## Why 11 Tools Instead of 1?

The original sequential-thinking MCP server used a single tool with 9 parameters. Claude had to specify thought numbers, totals, flags, and branch metadata on every call.

**MAXential v2.0** provides focused tools that match how Claude actually thinks:

| Category | Tools | What Claude Does |
|----------|-------|------------------|
| **Thinking** | `think`, `revise`, `complete` | Add thoughts, fix mistakes, conclude |
| **Branching** | `branch`, `switch_branch`, `list_branches`, `get_branch`, `close_branch`, `merge_branch` | Explore alternatives in parallel |
| **Navigation** | `get_thought`, `get_history` | Reference earlier reasoning |

## How Claude Uses These Tools

### Sequential Reasoning
```
Claude calls: think("The problem has three components...")
Server returns: { thoughtNumber: 1 }

Claude calls: think("Component A handles authentication...")
Server returns: { thoughtNumber: 2 }

Claude calls: think("Component B manages state...")
Server returns: { thoughtNumber: 3 }
```

Claude doesn't track numbers - the server handles that automatically.

### Exploring Alternatives
```
Claude calls: branch("caching", "Exploring whether caching helps")
Server returns: { branchId: "caching", originThought: 3 }

Claude calls: think("Redis would add complexity but reduce latency...")
// This thought is automatically on the "caching" branch

Claude calls: switch_branch()  // Back to main
Claude calls: think("Continuing main analysis...")
```

Claude can explore tangential questions without losing their place.

### Correcting Earlier Thinking
```
Claude calls: revise("Actually, Component A also handles sessions", 2)
Server returns: { thoughtNumber: 5, revisesThought: 2 }
```

Claude explicitly marks when they're updating earlier reasoning.

### Reviewing Past Reasoning
```
Claude calls: get_thought(2)
// Returns the full content of thought 2

Claude calls: get_history({ limit: 5 })
// Returns the last 5 thoughts
```

Claude can look back at what they concluded earlier.

## Benefits for Claude

| Without MAXential | With MAXential |
|-------------------|----------------|
| Reasoning disappears after each response | Thoughts persist and are retrievable |
| Linear thinking only | Parallel exploration via branches |
| No way to reference "thought 3" | Explicit thought numbering |
| Revisions are implicit | Revisions are marked and tracked |
| Context window is the only memory | Structured thought history |

## Installation

```bash
git clone https://github.com/BAM-DevCrew/MAXential-Thinking-MCP.git
cd MAXential-Thinking-MCP
npm install && npm run build
```

## Configuration

Add to `.mcp.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maxential-thinking": {
      "command": "node",
      "args": ["/path/to/MAXential-Thinking-MCP/dist/src/index.js"]
    }
  }
}
```

## Tool Reference

### Thinking
- **`think`** `{ thought: string }` - Add a thought (auto-numbered)
- **`revise`** `{ thought: string, revisesThought: number }` - Correct earlier thinking
- **`complete`** `{ conclusion: string }` - Mark reasoning complete

### Branching
- **`branch`** `{ branchId: string, reason: string }` - Create and switch to branch
- **`switch_branch`** `{ branchId?: string }` - Switch branches (omit for main)
- **`list_branches`** `{}` - List all branches with status
- **`get_branch`** `{ branchId: string }` - Get branch details and thoughts
- **`close_branch`** `{ branchId: string, conclusion?: string }` - Close with conclusion
- **`merge_branch`** `{ branchId: string, strategy: string }` - Integrate to main

### Navigation
- **`get_thought`** `{ thoughtNumber: number }` - Retrieve specific thought
- **`get_history`** `{ branchId?: string, limit?: number }` - Get thought history

## Project Status

- **v2.0: Granular Tool API** - Complete
- **Thought Compression** - Planned (for 100+ thought chains)
- **Session Persistence** - Planned (multi-session reasoning)

## License

MIT

---

**Developed by BAM-DevCrew** | [GitHub](https://github.com/BAM-DevCrew/MAXential-Thinking-MCP)
