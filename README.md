# MAXential Thinking MCP Server

**Enhanced sequential thinking for AI reasoning with branch navigation, thought compression, and session persistence.**

A powerful fork of Anthropic's [sequential-thinking MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking) that extends structured reasoning capabilities to enable:

- **🌿 Branch Navigation** - Explore tangential reasoning paths and integrate findings back
- **📦 Thought Compression** - Scale to 100+ thought reasoning chains with summaries and checkpoints  
- **💾 Session Persistence** - Multi-session reasoning and reusable knowledge building

## Why MAXential?

The original sequential-thinking server provides excellent structured reasoning, but lacks tools for:
- Managing complex branching thought processes
- Compressing long reasoning chains to manage context
- Persisting reasoning across sessions

**MAXential Thinking** unlocks these capabilities while maintaining full backward compatibility.

## Features

### Phase 1: Branch Enhancement ✅ (In Development)
- `list_branches()` - View all reasoning branches
- `get_branch(branchId)` - Retrieve complete branch with metadata
- `close_branch(branchId, conclusion)` - Mark branch complete
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

```bash
npm install -g @bam-protect/maxential-thinking-mcp
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maxential-thinking": {
      "command": "npx",
      "args": [
        "-y",
        "@bam-protect/maxential-thinking-mcp"
      ]
    }
  }
}
```

## Usage

The server is fully backward compatible with the original sequential-thinking tool. All new features are additive.

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

### Branch Exploration (New!)

```typescript
// Create a branch to explore an alternative approach
{
  "thought": "What if we try approach B instead?",
  "thoughtNumber": 5,
  "totalThoughts": 10,
  "nextThoughtNeeded": true,
  "branchFromThought": 4,
  "branchId": "explore-approach-b"
}

// Later: retrieve the branch
list_branches() // See all branches
get_branch("explore-approach-b") // Get complete branch

// Integrate findings
merge_branch("explore-approach-b", "conclusion_only")
```

## Development

```bash
# Clone the repo
git clone https://github.com/BAM-DevCrew/MAXential-Thinking-MCP.git
cd MAXential-Thinking-MCP

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run watch
```

## Project Status

- ✅ Phase 1: Branch Enhancement - **In Development**
- 🚧 Phase 2: Thought Compression - Planned
- 🚧 Phase 3: Session Persistence - Planned

See [DEV-PLAN.md](Docs/MAXential-Thinking-DEV-PLAN.md) for detailed roadmap.

## Credits

Built on the excellent foundation of [Anthropic's sequential-thinking MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking).

## License

MIT - See LICENSE file for details

---

**Developed by BAM PROTECT DevCrew** | [GitHub](https://github.com/BAM-DevCrew/MAXential-Thinking-MCP) | [Issues](https://github.com/BAM-DevCrew/MAXential-Thinking-MCP/issues)
