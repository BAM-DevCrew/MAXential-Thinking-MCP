# MAXential Thinking MCP Server

**Enhanced sequential thinking for AI reasoning with branch navigation, thought compression, and session persistence.**

A powerful fork of Anthropic's [sequential-thinking MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking) that activates and extends the original's dormant branching capabilities.

## Why MAXential?

The original sequential-thinking server included branch parameters in its schema but provided no tools to access, manage, or integrate branched reasoning. The data structures existed but were unusable.

**MAXential Thinking** activates these dormant capabilities by adding branch management tools:
- **🌿 Parallel Deep Exploration** - Create branches for different aspects, approaches, or hypotheses
- **📊 Organized Analysis** - Each branch maintains its own thought chain with conclusions
- **🔄 Clean Synthesis** - Retrieve and integrate findings from all branches
- **💾 Cache Persistence** - Branches survive Claude Code session compaction, enabling long-running analysis

## Real-World Impact

Production testing demonstrated:
- **35 thoughts** in main reasoning chain
- **6 parallel branches** exploring different dimensions of a complex problem
- **58 total reasoning steps** across all branches
- **Survived compaction in Claude Code** - all branch data retrievable after memory optimization
- **Result:** Comprehensive analysis with prioritized recommendations that would be impossible with linear thinking alone

## Features

### Phase 1: Branch Enhancement ✅ **COMPLETE**
- `list_branches()` - View all reasoning branches with metadata
- `get_branch(branchId)` - Retrieve complete branch with all thoughts and conclusions
- `close_branch(branchId, conclusion)` - Mark branch complete with synthesis
- `merge_branch(branchId, strategy)` - Integrate findings to main reasoning line

### Phase 2: Thought Compression 🚧 (Planned)
- `create_checkpoint(thoughtNumber, name)` - Mark reasoning milestones
- `create_summary(range, content)` - Compress thought ranges
- `get_thought_chain(thoughtNumber)` - Retrieve dependency graph
- Support for 100+ thought reasoning sessions

### Phase 3: Session Persistence 🚧 (Planned)
- `create_session(name)` - Initialize persistent reasoning session
- `resume_session(sessionId)` - Continue previous reasoning
- `export_session(sessionId, format)` - Export to markdown/JSON
- Multi-session knowledge building

## Installation

### From NPM (when published)
```bash
npm install -g maxential-thinking-mcp
```

### From Source
```bash
git clone https://github.com/BAM-DevCrew/MAXential-Thinking-MCP.git
cd MAXential-Thinking-MCP
npm install
npm run build
npm link
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maxential-thinking": {
      "command": "node",
      "args": [
        "/path/to/MAXential-Thinking-MCP/dist/index.js"
      ]
    }
  }
}
```

Or if installed via npm:

```json
{
  "mcpServers": {
    "maxential-thinking": {
      "command": "npx",
      "args": [
        "-y",
        "maxential-thinking-mcp"
      ]
    }
  }
}
```

## Usage

Fully backward compatible with the original sequential-thinking tool. All new features are additive.

### Basic Sequential Thinking (Original Functionality)

```typescript
// Use the sequentialthinking tool as before
{
  "thought": "Analyzing the problem structure...",
  "thoughtNumber": 1,
  "totalThoughts": 10,
  "nextThoughtNeeded": true
}
```

### Branch Exploration (Now Active!)

```typescript
// Create a branch to explore an alternative approach
{
  "thought": "Exploring performance optimization strategies...",
  "thoughtNumber": 5,
  "totalThoughts": 10,
  "nextThoughtNeeded": true,
  "branchFromThought": 4,
  "branchId": "performance-analysis"
}

// Continue exploring in the branch
{
  "thought": "Caching at the API layer reduces database calls by 60%...",
  "thoughtNumber": 6,
  "totalThoughts": 10,
  "nextThoughtNeeded": true,
  "branchId": "performance-analysis"
}

// Close the branch with conclusion
close_branch("performance-analysis",
  "API-level caching provides best performance improvement with minimal code changes.")

// Later: retrieve the branch (even after Claude Code compaction)
list_branches() // See all branches with metadata
get_branch("performance-analysis") // Get complete branch with all thoughts

// Integrate findings
merge_branch("performance-analysis", "conclusion_only")
```

## How AI Uses Branches

**Claude uses branches for:**
- Parallel exploration of different solution approaches
- Testing multiple implementation strategies before deciding
- Deep-diving on tangential questions without losing main thread
- Organizing complex architectural analysis by component or concern
- Comparing trade-offs across different dimensions

**Branches are not needed for:**
- Linear problem-solving
- Simple debugging
- Sequential implementation tasks

## Project Status

- ✅ **Phase 1: Branch Enhancement** - Complete & tested in production
- 🚧 **Phase 2: Thought Compression** - Planned for 100+ thought chains
- 🚧 **Phase 3: Session Persistence** - Planned for multi-session reasoning

See [DEV-PLAN.md](docs/MAXential-Thinking-DEV-PLAN.md) for detailed roadmap.

## Architecture

Built on the MCP (Model Context Protocol) framework:
- **Tools:** `sequentialthinking`, `list_branches`, `get_branch`, `close_branch`, `merge_branch`
- **Storage:** In-memory branch management with thought chain preservation
- **Compatibility:** Fully backward compatible with sequential-thinking MCP

## Credits

Built on the excellent foundation of [Anthropic's sequential-thinking MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking).

Special thanks to the MCP team for creating the protocol that makes tools like this possible.

## License

MIT - See LICENSE file for details

---

**Developed by BAM DevCrew and Claude Sonnet 4.5 in Claude Code** | [GitHub](https://github.com/BAM-DevCrew/MAXential-Thinking-MCP) | [Issues](https://github.com/BAM-DevCrew/MAXential-Thinking-MCP/issues)
