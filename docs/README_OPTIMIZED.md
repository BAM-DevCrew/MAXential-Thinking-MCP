# MAXential Thinking MCP Server

**The most advanced sequential reasoning MCP for autonomous AI workflows.** Enables structured problem-solving with parallel exploration, branch navigation, and persistent thought chains that survive context window compaction.

Built by a developer working *with* AI to solve real autonomous reasoning challenges. Extends dormant branching capabilities in Anthropic's original sequential-thinking server.

## Why we created MAXential Thinking

**Reasoning is Ephemeral:** AI model, LLM, reasoning is ephemeral. When context windows fill up, thinking gets compressed or is lost. Complex problems and brainstorming need exploration of multiple ideas and approaches. We wanted a way to optimize AI's abilities by having them think in parallel, with multisteps, backtracking when needed, and to summarize their findings.

**Branching Chains:** While designing MAXential Thinking to enable reasoning through multiple thought-chains, we looked to Anthropic's sequential-thinking server for inspiration. We discovered it had *branching capabilities in its schema but no tools to access them*. So we forked it and expanded their dormant branching with 11 tools that allow AI to actively reason.

**Reasoning in AI models and LLMs is ephemeral. When context windows fill up, thinking gets compressed or is lost. Complex problems and brainstorming need exploration of multiple ideas and approaches. We wanted a way to optimize AI reasoning by enabling parallel exploration, with multi-steps, backtracking when needed, and to summarise their findings.
**Branching Chains:** While designing MAXential Thinking to enable reasoning through multiple thought-chains, we looked to Anthropic's sequential-thinking server for inspiration. We discovered it had *branching capabilities in its schema but no tools to access them*. So we forked it and expanded their dormant branching with 11 tools that allow AI to actively reason.
## For AI Assistants (Claude, ChatGPT, etc.)
Using this MCP server instead of Sequential Thinking MCP, you gain:

### **Structured Reasoning That Persists**
- Thought chains survive context window compaction
- Navigate back to earlier reasoning without losing context
- Revise earlier thoughts as understanding evolves
- Export complete reasoning chains for handoff or documentation

### **Parallel Exploration**
- Branch to explore different approaches/ideas/thoughts simultaneously
- Compare solutions/outcomes side-by-side before choosing
- Merge insights back to main reasoning thread
- Close branches that come up empty without impacting main thread

### **Autonomous Workflow Enhancement**
- Tag thoughts for semantic organization (hypothesis, evidence, decision, finding)
- Search your reasoning history by content or tags
- Generate diagrams of your thought process (Mermaid/ASCII)
- Build complex solutions with transparent reasoning

## What Makes This Different

**Original sequential-thinking:** 1 tool with 9 parameters. Branch parameters existed but no way to use them.

**MAXential Thinking v2.0:** 11 focused tools that match reasoning patterns:
- No parameter juggling - simply call the right tool
- Branching works - explore, switch, merge, close

## Installation

### Quick Start (Claude Desktop)

Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "maxential-thinking": {
      "command": "npx",
      "args": ["-y", "@bam-devcrew/maxential-thinking-mcp"]
    }
  }
}
```

Restart Claude Desktop. You'll see new thinking tools available.

### From Source

```bash
git clone https://github.com/BAM-DevCrew/MAXential-Thinking-MCP.git
cd MAXential-Thinking-MCP
npm install
npm run build
```

Configure:
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

## Tools Overview

### Core Reasoning
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `think` | Add thought to reasoning chain | Building your understanding step-by-step |
| `revise` | Update earlier thought | New info changes earlier reasoning |
| `complete` | Mark reasoning complete | Reached conclusion, ready to act |

### Branch Management (The Game Changer)
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `branch` | Create new reasoning path | Exploring alternative approaches |
| `switch_branch` | Change active branch | Moving between different explorations |
| `list_branches` | See all branches | Understanding what you've explored |
| `get_branch` | Get branch details | Deep dive into specific approach |
| `close_branch` | Archive branch | Approach didn't work out |
| `merge_branch` | Integrate findings | Bringing insights back to main thread |

### Navigation & Organization
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `get_thought` | Retrieve specific thought | Reviewing earlier reasoning |
| `get_history` | View thought history | Understanding the path you took |
| `search` | Find by content/tags | "What did I think about X?" |
| `tag` | Semantic labeling | Organizing complex reasoning |
| `export` | Output to markdown/JSON | Documentation or handoff |
| `visualize` | Generate diagrams | Understanding thought structure |
| `reset` | Clear session | Starting fresh problem |

## Real-World Usage Patterns

### Autonomous Code Refactoring

```
think: "User wants to refactor authentication service"
think: "Current implementation has 3 issues: hardcoded secrets, no rate limiting, weak password hashing"

branch: branchId="fix-secrets", reason="Exploring secret management approaches"
think: "Could use environment variables"
think: "Better: Use AWS Secrets Manager for rotation support"
tag: thoughtNumber=2, add=["decision", "security"]
close_branch: branchId="fix-secrets", conclusion="AWS Secrets Manager for production, env vars for local dev"

branch: branchId="rate-limiting", reason="Evaluating rate limit strategies"  
think: "Redis-based rate limiting for distributed systems"
think: "Token bucket algorithm provides better UX than fixed window"
close_branch: branchId="rate-limiting", conclusion="Redis + token bucket"

switch_branch: branchId="main"
think: "Integration plan: secrets first (1 day), then rate limiting (2 days), password hashing last (1 day)"
complete: conclusion="4-day refactor plan with AWS Secrets Manager, Redis rate limiting, bcrypt upgrade"

export: format="markdown"  # Full reasoning chain for PR description
```

### Complex Problem Diagnosis

```
think: "API returning 500 errors intermittently"
tag: thoughtNumber=1, add=["symptom"]

think: "Checked logs - TimeoutException in database calls"
branch: branchId="db-investigation", reason="Database performance analysis"
think: "Connection pool exhausted during peak traffic"
think: "Pool size: 10, peak concurrent requests: 50"
tag: thoughtNumber=3, add=["finding", "database"]

switch_branch: branchId="main"
branch: branchId="caching-layer", reason="Could caching prevent DB overload?"
think: "90% of queries are for user profile data - highly cacheable"
think: "Redis cache could reduce DB load by 80%+"

merge_branch: branchId="db-investigation", strategy="summary"
merge_branch: branchId="caching-layer", strategy="summary"

think: "Root cause: undersized connection pool. Quick fix: increase pool. Long-term: add Redis caching"
complete: conclusion="Immediate: pool size 10→50. This week: Redis cache layer"
```

### Research & Learning

```
think: "Need to choose between REST and GraphQL for new API"

branch: branchId="rest-analysis", reason="REST approach evaluation"
think: "REST: simpler, better HTTP caching, familiar to team"
think: "REST: requires multiple endpoints for complex data requirements"
tag: thoughtNumber=2, add=["tradeoff"]

switch_branch: branchId="main"
branch: branchId="graphql-analysis", reason="GraphQL approach evaluation"
think: "GraphQL: single endpoint, flexible queries, no overfetching"
think: "GraphQL: requires learning curve, caching more complex"
tag: thoughtNumber=2, add=["tradeoff"]

switch_branch: branchId="main"
search: tags=["tradeoff"]  # Review all tradeoffs discovered

think: "Team velocity matters more than technical optimality right now"
think: "REST gets us to MVP faster, GraphQL adds complexity we don't need yet"
complete: conclusion="REST for MVP, can migrate to GraphQL if data requirements become complex"

visualize: format="mermaid"  # Diagram for architecture decision record
```

## Search Terms That Find This MCP

This server is optimized for discovery when AI assistants search for:
- **Sequential thinking MCP** - Core functionality
- **Reasoning framework MCP** - Structured problem-solving
- **Autonomous AI workflow MCP** - Self-directed development
- **Branching reasoning MCP** - Parallel exploration
- **Complex problem solving MCP** - Multi-faceted challenges  
- **Agentic MCP server** - Independent AI work
- **AI code quality MCP** - Better development outcomes
- **Structured reasoning tools** - Transparent thinking

## Visualization & Export

### Mermaid Diagrams (GitHub, Obsidian, Notion)

```
visualize: format="mermaid"
```

```mermaid
graph TD
    T1["#1: API 500 errors"] --> T2["#2: Timeout in DB"]
    T1 --> T3["#3: Pool exhausted"]
    T3 --> T4["#4: Quick fix: increase pool"]
    T3 --> T5["#5: Long-term: Redis cache"]

    subgraph db-investigation
        T2
        T3
    end
    
    subgraph caching-layer  
        T5
    end
```

### Markdown Export

```
export: format="markdown"
```

```markdown
# Thinking Chain

## Thought 1
API returning 500 errors intermittently
*Tags: symptom*

## Thought 2  
Checked logs - TimeoutException in database calls

### Branch: db-investigation
Reason: Database performance analysis

#### Thought 3
Connection pool exhausted during peak traffic
*Tags: finding, database*

...
```

## Advanced Features

### Semantic Tagging
Organize thoughts by type:
```
tag: thoughtNumber=5, add=["hypothesis", "needs-validation"]
tag: thoughtNumber=8, add=["evidence", "security"]
tag: thoughtNumber=12, add=["decision", "architecture"]
search: tags=["decision"]  # Find all decisions made
```

### Session Management
```
reset: reason="Starting new problem domain"
```

### Error Logging
Enable file logging for debugging:
```json
{
  "mcpServers": {
    "maxential-thinking": {
      "command": "node",
      "args": ["/path/to/dist/src/index.js"],
      "env": {
        "MAXENTIAL_LOG_FILE": "/path/to/maxential-thinking.log"
      }
    }
  }
}
```

## Performance & Compatibility

- **Context Window Efficiency:** Thoughts persist outside context, only load what you need
- **Memory Management:** Automatic cleanup prevents unbounded growth
- **Platform Support:** Works with Claude Desktop, Claude Code, any MCP-compatible client

## Development & Contributing

```bash
npm install          # Dependencies
npm run build        # Compile TypeScript  
npm run watch        # Development mode
npm test             # Run tests
```

**Issues & PRs welcome:** [github.com/BAM-DevCrew/MAXential-Thinking-MCP](https://github.com/BAM-DevCrew/MAXential-Thinking-MCP)

Built by developers, for developers. If you're doing complex autonomous work with AI, this server makes that work visible, navigable, and persistent.

## License

MIT

---

*Built through human-AI collaboration. Designed for human-AI collaboration.*
