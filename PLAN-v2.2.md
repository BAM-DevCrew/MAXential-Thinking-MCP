# MAXential Thinking MCP v2.2 Implementation Plan

## Overview

Version 2.2 adds practical usability features identified through real-world usage by AI models. These features make the thinking tool actually useful for navigating, organizing, and sharing reasoning chains.

## New Tools

### 1. `reset`

**Purpose:** Clear session state, start fresh thinking chain.

**Schema:**
```typescript
{
  name: "reset",
  description: "Clear the current thinking session and start fresh. Use when beginning a new problem.",
  inputSchema: {
    type: "object",
    properties: {
      confirm: {
        type: "boolean",
        description: "Must be true to confirm reset (prevents accidental clearing)"
      }
    },
    required: ["confirm"]
  }
}
```

**Implementation:**
- Reset `thoughtHistory` to `[]`
- Reset `branches` to `{}`
- Reset `activeBranchId` to `undefined`
- Reset `currentThoughtNumber` to `0`
- Reset `isComplete` to `false`
- Return count of cleared thoughts/branches for confirmation

**Response:**
```json
{
  "status": "reset",
  "cleared": {
    "thoughts": 15,
    "branches": 3
  },
  "message": "Session cleared. Ready for new thinking chain."
}
```

---

### 2. `search`

**Purpose:** Find thoughts by content, tags, or metadata.

**Schema:**
```typescript
{
  name: "search",
  description: "Search through thought history by content, tags, or filters.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Text to search for (case-insensitive, supports regex)"
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Filter by tags (AND logic - must have all specified tags)"
      },
      branchId: {
        type: "string",
        description: "Limit search to specific branch"
      },
      includeRevisions: {
        type: "boolean",
        description: "Include revision thoughts in results (default: true)"
      }
    },
    required: []
  }
}
```

**Implementation:**
- If `query` provided: regex match against `thought` content
- If `tags` provided: filter to thoughts with ALL specified tags
- If `branchId` provided: limit to that branch's thoughts
- Return matching thoughts with context (thought number, branch, tags)

**Response:**
```json
{
  "matches": [
    {
      "thoughtNumber": 5,
      "thought": "The API should use REST not GraphQL because...",
      "branchId": "api-design",
      "tags": ["decision", "architecture"]
    }
  ],
  "totalMatches": 1,
  "searchedThoughts": 12
}
```

---

### 3. `tag`

**Purpose:** Add semantic tags to thoughts for organization and filtering.

**Schema:**
```typescript
{
  name: "tag",
  description: "Add or remove tags from a thought. Tags help categorize and search thoughts.",
  inputSchema: {
    type: "object",
    properties: {
      thoughtNumber: {
        type: "integer",
        description: "The thought to tag",
        minimum: 1
      },
      add: {
        type: "array",
        items: { type: "string" },
        description: "Tags to add"
      },
      remove: {
        type: "array",
        items: { type: "string" },
        description: "Tags to remove"
      }
    },
    required: ["thoughtNumber"]
  }
}
```

**Suggested standard tags:**
- `hypothesis` - A proposed explanation or approach
- `evidence` - Supporting information or data
- `counter` - Counter-argument or contradicting evidence
- `decision` - A conclusion or choice made
- `question` - Open question needing resolution
- `rejected` - Approach considered and discarded
- `key` - Important insight or turning point

**Implementation:**
- Add `tags: string[]` field to `ThoughtData` interface
- Modify `addThought()` to initialize empty tags array
- `tag` tool adds/removes from the array
- Tags are lowercase, trimmed, deduplicated

**Response:**
```json
{
  "thoughtNumber": 5,
  "tags": ["hypothesis", "architecture"],
  "added": ["architecture"],
  "removed": []
}
```

---

### 4. `export`

**Purpose:** Export thinking chain to portable format.

**Schema:**
```typescript
{
  name: "export",
  description: "Export the thinking chain to markdown or JSON format.",
  inputSchema: {
    type: "object",
    properties: {
      format: {
        type: "string",
        enum: ["markdown", "json"],
        description: "Output format (default: markdown)"
      },
      includeBranches: {
        type: "boolean",
        description: "Include branch thoughts in export (default: true)"
      },
      branchId: {
        type: "string",
        description: "Export only a specific branch"
      }
    },
    required: []
  }
}
```

**Markdown format:**
```markdown
# Thinking Chain

## Main Thread

### Thought 1
Testing after restart

### Thought 2 [hypothesis]
Maybe the issue is in the API layer...

### Thought 3 (revises #2) [decision]
Confirmed: API layer was the problem.

---

## Branch: alt-approach
*Branched from thought 2*

### Thought 4
What if we tried a different approach...

*Branch closed with conclusion: This approach was viable*
```

**Implementation:**
- Build markdown string from thought history
- Include tags as `[tag1, tag2]` after thought header
- Show revision relationships
- Show branch structure with headers
- For JSON: just serialize the internal state

---

### 5. `visualize`

**Purpose:** Generate visual representation of thought tree.

**Schema:**
```typescript
{
  name: "visualize",
  description: "Generate a visual diagram of the thinking chain and branches.",
  inputSchema: {
    type: "object",
    properties: {
      format: {
        type: "string",
        enum: ["ascii", "mermaid"],
        description: "Output format (default: mermaid)"
      },
      showTags: {
        type: "boolean",
        description: "Include tags in visualization (default: false)"
      },
      showContent: {
        type: "boolean",
        description: "Include thought content preview (default: false, shows first 30 chars)"
      }
    },
    required: []
  }
}
```

**ASCII format:**
```
Thinking Chain
==============

T1 ─── T2 ─── T3 ─┬─ T4 ─── T5 [CONCLUSION]
                  │
                  └─ [alt-approach]
                       T6 ─── T7 [closed]

Revisions:
  T3 revises T1

Legend: [branch-name] = branch, [closed] = closed branch
```

**Mermaid format:**
```
graph TD
    T1["#1: Testing after restart"]
    T2["#2: BRANCH START"]
    T3["#3: Comprehensive test"]
    T4["#4: Revision of #1"]

    T1 --> T2
    T1 --> T3
    T3 --> T4

    subgraph alt-approach
        T2
    end

    T4 -.revises.-> T1
```

**Implementation:**
- Build graph structure from thought history
- Track parent-child relationships (sequential thoughts)
- Track branch relationships
- Track revision relationships (dotted lines)
- Generate appropriate output format

---

## Data Model Changes

### ThoughtData (updated)
```typescript
interface ThoughtData {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  nextThoughtNeeded: boolean;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
  tags?: string[];  // NEW
}
```

---

## Implementation Order

1. **`reset`** - Simplest, unblocks fresh testing
2. **`tag`** - Adds tags field to data model (needed by search/export)
3. **`search`** - Uses tags, provides immediate value
4. **`export`** - Straightforward formatting
5. **`visualize`** - Most complex, depends on understanding full structure

---

## Testing Plan

Each tool needs tests for:
- Basic happy path
- Edge cases (empty state, missing params)
- Integration (tag then search, branch then visualize)

---

## Notes

- All new tools follow existing patterns (makeResponse, makeError)
- No breaking changes to existing tools
- Backward compatible - existing sessions still work
- Tags are optional - thoughts without tags still searchable by content
