#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { SequentialThinkingServer } from "./lib.js";

// =============================================================================
// THINKING TOOLS
// =============================================================================

const THINK_TOOL: Tool = {
  name: "think",
  description: "Add a thought to your reasoning chain. Use this for step-by-step problem solving. The server automatically tracks thought numbers and history.",
  inputSchema: {
    type: "object",
    properties: {
      thought: {
        type: "string",
        description: "Your current thinking step"
      }
    },
    required: ["thought"]
  }
};

const REVISE_TOOL: Tool = {
  name: "revise",
  description: "Revise a previous thought. Use when you realize earlier thinking was flawed or incomplete.",
  inputSchema: {
    type: "object",
    properties: {
      thought: { type: "string", description: "Your revised thinking" },
      revisesThought: { type: "integer", description: "The thought number being revised", minimum: 1 }
    },
    required: ["thought", "revisesThought"]
  }
};

const COMPLETE_TOOL: Tool = {
  name: "complete",
  description: "Mark your thinking chain as complete with a final conclusion.",
  inputSchema: {
    type: "object",
    properties: {
      conclusion: { type: "string", description: "Your final conclusion or answer" }
    },
    required: ["conclusion"]
  }
};


const RESET_TOOL: Tool = {
  name: "reset",
  description: "Clear the current thinking session and start fresh. Use when beginning a new problem.",
  inputSchema: {
    type: "object",
    properties: {
      confirm: { type: "boolean", description: "Must be true to confirm reset (prevents accidental clearing)" }
    },
    required: ["confirm"]
  }
};

// =============================================================================
// BRANCHING TOOLS
// =============================================================================

const BRANCH_TOOL: Tool = {
  name: "branch",
  description: "Create a new reasoning branch to explore an alternative path. Like git branches for thoughts.",
  inputSchema: {
    type: "object",
    properties: {
      branchId: { type: "string", description: "A short identifier for this branch" },
      reason: { type: "string", description: "Why you are branching" }
    },
    required: ["branchId", "reason"]
  }
};

const SWITCH_BRANCH_TOOL: Tool = {
  name: "switch_branch",
  description: "Switch your active context to a different branch (or back to main).",
  inputSchema: {
    type: "object",
    properties: {
      branchId: { type: "string", description: "The branch to switch to, or omit for main" }
    },
    required: []
  }
};

const LIST_BRANCHES_TOOL: Tool = {
  name: "list_branches",
  description: "List all reasoning branches with their status and thought counts.",
  inputSchema: { type: "object", properties: {}, required: [] }
};

const GET_BRANCH_TOOL: Tool = {
  name: "get_branch",
  description: "Retrieve complete details of a specific branch.",
  inputSchema: {
    type: "object",
    properties: {
      branchId: { type: "string", description: "The ID of the branch to retrieve" }
    },
    required: ["branchId"]
  }
};

const CLOSE_BRANCH_TOOL: Tool = {
  name: "close_branch",
  description: "Close a branch with an optional conclusion.",
  inputSchema: {
    type: "object",
    properties: {
      branchId: { type: "string", description: "The ID of the branch to close" },
      conclusion: { type: "string", description: "Summary or conclusion" }
    },
    required: ["branchId"]
  }
};

const MERGE_BRANCH_TOOL: Tool = {
  name: "merge_branch",
  description: "Merge insights from a branch back into main. Strategies: conclusion_only, full_integration, summary",
  inputSchema: {
    type: "object",
    properties: {
      branchId: { type: "string", description: "The ID of the branch to merge" },
      strategy: { type: "string", enum: ["conclusion_only", "full_integration", "summary"], description: "How to merge" }
    },
    required: ["branchId", "strategy"]
  }
};

// =============================================================================
// NAVIGATION TOOLS
// =============================================================================

const GET_THOUGHT_TOOL: Tool = {
  name: "get_thought",
  description: "Retrieve a specific thought by its number.",
  inputSchema: {
    type: "object",
    properties: {
      thoughtNumber: { type: "integer", description: "The thought number to retrieve", minimum: 1 }
    },
    required: ["thoughtNumber"]
  }
};

const GET_HISTORY_TOOL: Tool = {
  name: "get_history",
  description: "Get your thought history. Optionally filter by branch.",
  inputSchema: {
    type: "object",
    properties: {
      branchId: { type: "string", description: "Optional: filter by branch" },
      limit: { type: "integer", description: "Optional: limit results", minimum: 1 }
    },
    required: []
  }
};


// =============================================================================
// ORGANIZATION TOOLS (v2.2)
// =============================================================================

const TAG_TOOL: Tool = {
  name: "tag",
  description: "Add or remove tags from a thought. Tags help categorize and search thoughts.",
  inputSchema: {
    type: "object",
    properties: {
      thoughtNumber: { type: "integer", description: "The thought to tag", minimum: 1 },
      add: { type: "array", items: { type: "string" }, description: "Tags to add" },
      remove: { type: "array", items: { type: "string" }, description: "Tags to remove" }
    },
    required: ["thoughtNumber"]
  }
};

const SEARCH_TOOL: Tool = {
  name: "search",
  description: "Search through thought history by content or tags.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text to search for (case-insensitive)" },
      tags: { type: "array", items: { type: "string" }, description: "Filter by tags (must have all specified)" },
      branchId: { type: "string", description: "Limit search to specific branch" }
    },
    required: []
  }
};

const EXPORT_TOOL: Tool = {
  name: "export",
  description: "Export the thinking chain to markdown or JSON format.",
  inputSchema: {
    type: "object",
    properties: {
      format: { type: "string", enum: ["markdown", "json"], description: "Output format (default: markdown)" },
      branchId: { type: "string", description: "Export only a specific branch" }
    },
    required: []
  }
};

const VISUALIZE_TOOL: Tool = {
  name: "visualize",
  description: "Generate a visual diagram of the thinking chain and branches.",
  inputSchema: {
    type: "object",
    properties: {
      format: { type: "string", enum: ["ascii", "mermaid"], description: "Output format (default: mermaid)" },
      showContent: { type: "boolean", description: "Include thought content preview (default: false)" }
    },
    required: []
  }
};

// =============================================================================
// SESSION TOOLS (v2.3)
// =============================================================================

const SESSION_SAVE_TOOL: Tool = {
  name: "session_save",
  description: "Name and describe the current thinking session for later retrieval. Data is already persisted automatically — this adds a meaningful name and optional description.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "A descriptive name for this session (e.g., 'Debugging auth flow')" },
      description: { type: "string", description: "Optional longer description of the session's purpose or context" }
    },
    required: ["name"]
  }
};

const SESSION_LOAD_TOOL: Tool = {
  name: "session_load",
  description: "Restore a previously saved thinking session into memory. Resumes where you left off — all thoughts, branches, and tags are restored.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The session UUID to load (from session_list)" }
    },
    required: ["id"]
  }
};

const SESSION_LIST_TOOL: Tool = {
  name: "session_list",
  description: "Browse available thinking sessions. Shows most recently updated first.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["active", "complete", "archived"], description: "Filter by session status" },
      limit: { type: "integer", description: "Max sessions to return (default: 20)", minimum: 1, maximum: 100 }
    },
    required: []
  }
};

const SESSION_SUMMARY_TOOL: Tool = {
  name: "session_summary",
  description: "Generate a compressed summary of a thinking session for token-efficient context loading. Includes key findings from conclusions, tagged thoughts, and branch results.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The session UUID to summarize" },
      maxLength: { type: "integer", description: "Target summary length in characters (default: 2000)", minimum: 100 }
    },
    required: ["id"]
  }
};

// =============================================================================
// SERVER SETUP
// =============================================================================

const server = new Server(
  { name: "maxential-thinking-server", version: "2.3.0" },
  { capabilities: { tools: {} } }
);

const thinkingServer = new SequentialThinkingServer();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    THINK_TOOL, REVISE_TOOL, COMPLETE_TOOL, RESET_TOOL,
    BRANCH_TOOL, SWITCH_BRANCH_TOOL, LIST_BRANCHES_TOOL, GET_BRANCH_TOOL, CLOSE_BRANCH_TOOL, MERGE_BRANCH_TOOL,
    GET_THOUGHT_TOOL, GET_HISTORY_TOOL,
    TAG_TOOL, SEARCH_TOOL, EXPORT_TOOL, VISUALIZE_TOOL,
    SESSION_SAVE_TOOL, SESSION_LOAD_TOOL, SESSION_LIST_TOOL, SESSION_SUMMARY_TOOL,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "think": return thinkingServer.think(request.params.arguments);
    case "revise": return thinkingServer.revise(request.params.arguments);
    case "complete": return thinkingServer.complete(request.params.arguments);
    case "reset": return thinkingServer.reset(request.params.arguments);
    case "branch": return thinkingServer.branch(request.params.arguments);
    case "switch_branch": return thinkingServer.switchBranch(request.params.arguments);
    case "list_branches": return thinkingServer.listBranches();
    case "get_branch": return thinkingServer.getBranch(request.params.arguments);
    case "close_branch": return thinkingServer.closeBranch(request.params.arguments);
    case "merge_branch": return thinkingServer.mergeBranch(request.params.arguments);
    case "get_thought": return thinkingServer.getThought(request.params.arguments);
    case "get_history": return thinkingServer.getHistory(request.params.arguments);
    case "tag": return thinkingServer.tag(request.params.arguments);
    case "search": return thinkingServer.search(request.params.arguments);
    case "export": return thinkingServer.export(request.params.arguments);
    case "visualize": return thinkingServer.visualize(request.params.arguments);
    case "session_save": return thinkingServer.sessionSave(request.params.arguments);
    case "session_load": return thinkingServer.sessionLoad(request.params.arguments);
    case "session_list": return thinkingServer.sessionList(request.params.arguments);
    case "session_summary": return thinkingServer.sessionSummary(request.params.arguments);
    default:
      return { content: [{ type: "text", text: "Unknown tool: " + request.params.name }], isError: true };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MAXential Thinking MCP Server v2.3.0 running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
