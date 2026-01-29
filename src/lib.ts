import chalk from 'chalk';
import * as fs from 'fs';
import {
  ThoughtData,
  BranchData,
  BranchSummary,
  BranchError
} from './types/index.js';

// ===========================================================================
// Logging (v2.2)
// ===========================================================================

const logFile = process.env.MAXENTIAL_LOG_FILE;

function logError(msg: string, error?: unknown): void {
  const errorStr = error instanceof Error ? error.stack || error.message : String(error || '');
  const line = `[${new Date().toISOString()}] ERROR: ${msg} ${errorStr}
`;
  console.error(line.trim());
  if (logFile) {
    try {
      fs.appendFileSync(logFile, line);
    } catch (e) {
      console.error('Failed to write to log file:', e);
    }
  }
}

function logInfo(msg: string): void {
  const line = `[${new Date().toISOString()}] INFO: ${msg}
`;
  if (logFile) {
    try {
      fs.appendFileSync(logFile, line);
    } catch (e) {
      // silently ignore
    }
  }
}



export class SequentialThinkingServer {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, BranchData> = {};
  private activeBranchId: string | undefined;
  private disableThoughtLogging: boolean;
  private echoThoughts: boolean;
  private currentThoughtNumber: number = 0;
  private isComplete: boolean = false;

  constructor() {
    this.disableThoughtLogging = (process.env.DISABLE_THOUGHT_LOGGING || "").toLowerCase() === "true";
    this.echoThoughts = (process.env.MAXENTIAL_ECHO_THOUGHTS || "true").toLowerCase() !== "false";
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private makeResponse(data: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }

  private makeError(error: unknown): { content: Array<{ type: string; text: string }>; isError: true } {
    logError('Tool error', error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          status: 'failed'
        }, null, 2)
      }],
      isError: true
    };
  }

  private addThought(thought: string, options: {
    isRevision?: boolean;
    revisesThought?: number;
    branchId?: string;
    branchFromThought?: number;
  } = {}): ThoughtData {
    this.currentThoughtNumber++;

    const thoughtData: ThoughtData = {
      thought,
      thoughtNumber: this.currentThoughtNumber,
      totalThoughts: this.currentThoughtNumber,
      nextThoughtNeeded: !this.isComplete,
      isRevision: options.isRevision,
      revisesThought: options.revisesThought,
      branchId: options.branchId || this.activeBranchId,
      branchFromThought: options.branchFromThought,
    };

    this.thoughtHistory.push(thoughtData);

    // Add to branch if we're on one
    if (this.activeBranchId && this.branches[this.activeBranchId]) {
      this.branches[this.activeBranchId].thoughts.push(thoughtData);
    }

    // Log if enabled
    if (!this.disableThoughtLogging) {
      const formatted = this.formatThought(thoughtData);
      console.error(formatted);
    }

    return thoughtData;
  }

  // ===========================================================================
  // Thinking Tools (v2.0)
  // ===========================================================================

  public think(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;

      if (!data.thought || typeof data.thought !== 'string') {
        throw new Error('Invalid thought: must be a string');
      }

      if (this.isComplete) {
        throw new Error('Thinking chain is already complete. Start a new session to continue.');
      }

      const thoughtData = this.addThought(data.thought);

      const response: Record<string, unknown> = {
        thoughtNumber: thoughtData.thoughtNumber,
        activeBranchId: this.activeBranchId,
        totalThoughts: this.currentThoughtNumber,
        branchCount: Object.keys(this.branches).length
      };
      if (this.echoThoughts) {
        response.thought = data.thought;
      }
      return this.makeResponse(response);
    } catch (error) {
      return this.makeError(error);
    }
  }

  public revise(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;

      if (!data.thought || typeof data.thought !== 'string') {
        throw new Error('Invalid thought: must be a string');
      }
      if (!data.revisesThought || typeof data.revisesThought !== 'number') {
        throw new Error('Invalid revisesThought: must be a number');
      }

      const targetThought = this.thoughtHistory.find(t => t.thoughtNumber === data.revisesThought);
      if (!targetThought) {
        throw new Error(`Thought ${data.revisesThought} not found`);
      }

      const thoughtData = this.addThought(data.thought, {
        isRevision: true,
        revisesThought: data.revisesThought as number
      });

      const response: Record<string, unknown> = {
        thoughtNumber: thoughtData.thoughtNumber,
        revisesThought: data.revisesThought,
        activeBranchId: this.activeBranchId,
        totalThoughts: this.currentThoughtNumber
      };
      if (this.echoThoughts) {
        response.thought = data.thought;
      }
      return this.makeResponse(response);
    } catch (error) {
      return this.makeError(error);
    }
  }

  public complete(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;

      if (!data.conclusion || typeof data.conclusion !== 'string') {
        throw new Error('Invalid conclusion: must be a string');
      }

      this.isComplete = true;
      const thoughtData = this.addThought(`CONCLUSION: ${data.conclusion}`);

      return this.makeResponse({
        status: 'complete',
        conclusionThought: thoughtData.thoughtNumber,
        totalThoughts: this.currentThoughtNumber,
        branchCount: Object.keys(this.branches).length,
        conclusion: data.conclusion
      });
    } catch (error) {
      return this.makeError(error);
    }
  }


  public reset(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;

      if (data.confirm !== true) {
        throw new Error('Must pass confirm: true to reset session');
      }

      const cleared = {
        thoughts: this.thoughtHistory.length,
        branches: Object.keys(this.branches).length
      };

      // Reset all state
      this.thoughtHistory = [];
      this.branches = {};
      this.activeBranchId = undefined;
      this.currentThoughtNumber = 0;
      this.isComplete = false;

      return this.makeResponse({
        status: 'reset',
        cleared,
        message: 'Session cleared. Ready for new thinking chain.'
      });
    } catch (error) {
      return this.makeError(error);
    }
  }

  // ===========================================================================
  // Branching Tools (v2.0)
  // ===========================================================================

  public branch(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;

      if (!data.branchId || typeof data.branchId !== 'string') {
        throw new BranchError('Invalid branchId: must be a string');
      }
      if (!data.reason || typeof data.reason !== 'string') {
        throw new BranchError('Invalid reason: must be a string');
      }

      if (this.branches[data.branchId]) {
        throw new BranchError(`Branch '${data.branchId}' already exists`);
      }

      const originThought = this.currentThoughtNumber;

      // Create the branch
      this.branches[data.branchId] = {
        branchId: data.branchId,
        originThought,
        thoughts: [],
        status: 'active',
        createdAt: Date.now()
      };

      // Switch to the new branch
      this.activeBranchId = data.branchId;

      // Add a branch-start thought
      const thoughtData = this.addThought(`BRANCH START: ${data.reason}`, {
        branchId: data.branchId,
        branchFromThought: originThought
      });

      return this.makeResponse({
        branchId: data.branchId,
        originThought,
        reason: data.reason,
        thoughtNumber: thoughtData.thoughtNumber,
        status: 'active'
      });
    } catch (error) {
      return this.makeError(error);
    }
  }

  public switchBranch(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;
      const branchId = data.branchId as string | undefined;

      // Treat "main" the same as omitting branchId (git muscle memory)
      const isMainSwitch = !branchId || branchId === 'main';

      if (!isMainSwitch) {
        if (!this.branches[branchId!]) {
          throw new BranchError(`Branch '${branchId}' not found`);
        }
        if (this.branches[branchId!].status !== 'active') {
          throw new BranchError(`Branch '${branchId}' is ${this.branches[branchId!].status}, not active`);
        }
        this.activeBranchId = branchId;
      } else {
        // Switch to main (no branch)
        this.activeBranchId = undefined;
      }

      return this.makeResponse({
        activeBranchId: this.activeBranchId || 'main',
        message: isMainSwitch ? 'Switched to main' : `Switched to branch '${branchId}'`
      });
    } catch (error) {
      return this.makeError(error);
    }
  }

  // ===========================================================================
  // Navigation Tools (v2.0)
  // ===========================================================================

  public getThought(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;

      if (!data.thoughtNumber || typeof data.thoughtNumber !== 'number') {
        throw new Error('Invalid thoughtNumber: must be a number');
      }

      const thought = this.thoughtHistory.find(t => t.thoughtNumber === data.thoughtNumber);
      if (!thought) {
        throw new Error(`Thought ${data.thoughtNumber} not found`);
      }

      return this.makeResponse({
        ...thought
      });
    } catch (error) {
      return this.makeError(error);
    }
  }

  public getHistory(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;
      const branchId = data.branchId as string | undefined;
      const limit = data.limit as number | undefined;

      let thoughts = this.thoughtHistory;

      // Filter by branch if specified
      if (branchId) {
        if (!this.branches[branchId]) {
          throw new BranchError(`Branch '${branchId}' not found`);
        }
        thoughts = this.branches[branchId].thoughts;
      }

      // Apply limit
      if (limit && limit > 0) {
        thoughts = thoughts.slice(-limit);
      }

      return this.makeResponse({
        thoughts: thoughts.map(t => ({
          thoughtNumber: t.thoughtNumber,
          thought: t.thought,
          isRevision: t.isRevision,
          revisesThought: t.revisesThought,
          branchId: t.branchId
        })),
        totalCount: thoughts.length,
        activeBranchId: this.activeBranchId,
        isComplete: this.isComplete
      });
    } catch (error) {
      return this.makeError(error);
    }
  }


  // ===========================================================================
  // Organization Tools (v2.2)
  // ===========================================================================

  public tag(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;

      if (!data.thoughtNumber || typeof data.thoughtNumber !== 'number') {
        throw new Error('Invalid thoughtNumber: must be a number');
      }

      const thought = this.thoughtHistory.find(t => t.thoughtNumber === data.thoughtNumber);
      if (!thought) {
        throw new Error(`Thought ${data.thoughtNumber} not found`);
      }

      // Initialize tags if not present
      if (!thought.tags) {
        thought.tags = [];
      }

      const added: string[] = [];
      const removed: string[] = [];

      // Add tags
      if (Array.isArray(data.add)) {
        for (const tag of data.add) {
          const normalized = String(tag).toLowerCase().trim();
          if (normalized && !thought.tags.includes(normalized)) {
            thought.tags.push(normalized);
            added.push(normalized);
          }
        }
      }

      // Remove tags
      if (Array.isArray(data.remove)) {
        for (const tag of data.remove) {
          const normalized = String(tag).toLowerCase().trim();
          const idx = thought.tags.indexOf(normalized);
          if (idx !== -1) {
            thought.tags.splice(idx, 1);
            removed.push(normalized);
          }
        }
      }

      const response: Record<string, unknown> = {
        thoughtNumber: data.thoughtNumber,
        tags: thought.tags,
        added,
        removed
      };
      if (this.echoThoughts) {
        response.thought = thought.thought;
      }
      return this.makeResponse(response);
    } catch (error) {
      return this.makeError(error);
    }
  }

  public search(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;
      const query = data.query as string | undefined;
      const tags = data.tags as string[] | undefined;
      const branchId = data.branchId as string | undefined;

      let thoughts = this.thoughtHistory;

      // Filter by branch
      if (branchId) {
        if (!this.branches[branchId]) {
          throw new BranchError(`Branch '${branchId}' not found`);
        }
        thoughts = this.branches[branchId].thoughts;
      }

      // Filter by query (case-insensitive)
      if (query) {
        const lowerQuery = query.toLowerCase();
        thoughts = thoughts.filter(t => t.thought.toLowerCase().includes(lowerQuery));
      }

      // Filter by tags (must have ALL specified tags)
      if (tags && tags.length > 0) {
        const normalizedTags = tags.map(t => t.toLowerCase().trim());
        thoughts = thoughts.filter(t => {
          if (!t.tags || t.tags.length === 0) return false;
          return normalizedTags.every(tag => t.tags!.includes(tag));
        });
      }

      return this.makeResponse({
        matches: thoughts.map(t => ({
          thoughtNumber: t.thoughtNumber,
          thought: t.thought,
          branchId: t.branchId,
          tags: t.tags || [],
          isRevision: t.isRevision,
          revisesThought: t.revisesThought
        })),
        totalMatches: thoughts.length,
        searchedThoughts: this.thoughtHistory.length
      });
    } catch (error) {
      return this.makeError(error);
    }
  }

  public export(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;
      const format = (data.format as string) || 'markdown';
      const branchId = data.branchId as string | undefined;

      if (format === 'json') {
        const exportData = {
          exportedAt: new Date().toISOString(),
          thoughtHistory: branchId ? this.branches[branchId]?.thoughts : this.thoughtHistory,
          branches: branchId ? { [branchId]: this.branches[branchId] } : this.branches,
          isComplete: this.isComplete
        };
        return this.makeResponse({ format: 'json', content: JSON.stringify(exportData, null, 2) });
      }

      // Markdown format
      let md = '# Thinking Chain\n\n';

      // Main thread thoughts (not in branches)
      const mainThoughts = this.thoughtHistory.filter(t => !t.branchId);
      if (mainThoughts.length > 0) {
        md += '## Main Thread\n\n';
        for (const t of mainThoughts) {
          md += this.formatThoughtMarkdown(t);
        }
      }

      // Branch thoughts
      for (const [id, branch] of Object.entries(this.branches)) {
        if (branchId && id !== branchId) continue;
        md += `\n---\n\n## Branch: ${id}\n`;
        md += `*Branched from thought ${branch.originThought}*\n\n`;
        for (const t of branch.thoughts) {
          md += this.formatThoughtMarkdown(t);
        }
        if (branch.status === 'closed' && branch.conclusion) {
          md += `\n*Branch closed with conclusion: ${branch.conclusion}*\n`;
        }
        if (branch.status === 'merged') {
          md += `\n*Branch merged*\n`;
        }
      }

      return this.makeResponse({ format: 'markdown', content: md });
    } catch (error) {
      return this.makeError(error);
    }
  }

  private formatThoughtMarkdown(t: ThoughtData): string {
    let header = `### Thought ${t.thoughtNumber}`;
    if (t.isRevision) {
      header += ` (revises #${t.revisesThought})`;
    }
    if (t.tags && t.tags.length > 0) {
      header += ` [${t.tags.join(', ')}]`;
    }
    return `${header}\n${t.thought}\n\n`;
  }

  public visualize(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;
      const format = (data.format as string) || 'mermaid';
      const showContent = data.showContent === true;

      if (format === 'ascii') {
        return this.makeResponse({ format: 'ascii', content: this.generateAsciiTree(showContent) });
      }

      // Mermaid format
      return this.makeResponse({ format: 'mermaid', content: this.generateMermaidDiagram(showContent) });
    } catch (error) {
      return this.makeError(error);
    }
  }

  private generateAsciiTree(showContent: boolean): string {
    if (this.thoughtHistory.length === 0) {
      return 'No thoughts yet.';
    }

    let output = 'Thinking Chain\n==============\n\n';

    // Group thoughts by branch
    const mainThoughts = this.thoughtHistory.filter(t => !t.branchId);
    const branchStarts: Record<number, string[]> = {};

    // Find where branches start
    for (const [id, branch] of Object.entries(this.branches)) {
      const origin = branch.originThought;
      if (!branchStarts[origin]) branchStarts[origin] = [];
      branchStarts[origin].push(id);
    }

    // Build main line
    let line = '';
    for (const t of mainThoughts) {
      const label = showContent ? `T${t.thoughtNumber}:"${t.thought.substring(0, 20)}..."` : `T${t.thoughtNumber}`;
      line += line ? ` --> ${label}` : label;
      if (branchStarts[t.thoughtNumber]) {
        for (const branchId of branchStarts[t.thoughtNumber]) {
          output += `Branch [${branchId}] from T${t.thoughtNumber}\n`;
        }
      }
    }
    output += line || '(empty)';

    // Show revisions
    const revisions = this.thoughtHistory.filter(t => t.isRevision);
    if (revisions.length > 0) {
      output += '\n\nRevisions:\n';
      for (const r of revisions) {
        output += `  T${r.thoughtNumber} revises T${r.revisesThought}\n`;
      }
    }

    return output;
  }

  private generateMermaidDiagram(showContent: boolean): string {
    if (this.thoughtHistory.length === 0) {
      return 'graph TD\n    empty[No thoughts yet]';
    }

    let mermaid = 'graph TD\n';

    // Define nodes
    for (const t of this.thoughtHistory) {
      const label = showContent
        ? `#${t.thoughtNumber}: ${t.thought.substring(0, 30).replace(/"/g, "'").replace(/\n/g, ' ')}...`
        : `#${t.thoughtNumber}`;
      mermaid += `    T${t.thoughtNumber}["${label}"]\n`;
    }

    mermaid += '\n';

    // Define edges (sequential flow within main/branches)
    let prevMain: number | null = null;
    const branchPrev: Record<string, number> = {};

    for (const t of this.thoughtHistory) {
      if (t.branchFromThought) {
        // Start of a branch
        mermaid += `    T${t.branchFromThought} --> T${t.thoughtNumber}\n`;
        branchPrev[t.branchId!] = t.thoughtNumber;
      } else if (t.branchId) {
        // Continuation in branch
        if (branchPrev[t.branchId]) {
          mermaid += `    T${branchPrev[t.branchId]} --> T${t.thoughtNumber}\n`;
        }
        branchPrev[t.branchId] = t.thoughtNumber;
      } else {
        // Main thread
        if (prevMain !== null) {
          mermaid += `    T${prevMain} --> T${t.thoughtNumber}\n`;
        }
        prevMain = t.thoughtNumber;
      }

      // Revision link (dotted)
      if (t.isRevision && t.revisesThought) {
        mermaid += `    T${t.thoughtNumber} -.revises.-> T${t.revisesThought}\n`;
      }
    }

    // Subgraphs for branches
    for (const [id, branch] of Object.entries(this.branches)) {
      const thoughtNums = branch.thoughts.map(t => `T${t.thoughtNumber}`).join('\n        ');
      if (thoughtNums) {
        mermaid += `\n    subgraph ${id}\n        ${thoughtNums}\n    end\n`;
      }
    }

    return mermaid;
  }


  // ===========================================================================
  // Legacy Methods (v1.0)
  // ===========================================================================

  private validateThoughtData(input: unknown): ThoughtData {
    const data = input as Record<string, unknown>;

    if (!data.thought || typeof data.thought !== 'string') {
      throw new Error('Invalid thought: must be a string');
    }
    if (!data.thoughtNumber || typeof data.thoughtNumber !== 'number') {
      throw new Error('Invalid thoughtNumber: must be a number');
    }
    if (!data.totalThoughts || typeof data.totalThoughts !== 'number') {
      throw new Error('Invalid totalThoughts: must be a number');
    }
    if (typeof data.nextThoughtNeeded !== 'boolean') {
      throw new Error('Invalid nextThoughtNeeded: must be a boolean');
    }

    return {
      thought: data.thought,
      thoughtNumber: data.thoughtNumber,
      totalThoughts: data.totalThoughts,
      nextThoughtNeeded: data.nextThoughtNeeded,
      isRevision: data.isRevision as boolean | undefined,
      revisesThought: data.revisesThought as number | undefined,
      branchFromThought: data.branchFromThought as number | undefined,
      branchId: data.branchId as string | undefined,
      needsMoreThoughts: data.needsMoreThoughts as boolean | undefined,
    };
  }

  private formatThought(thoughtData: ThoughtData): string {
    const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } = thoughtData;

    let prefix = '';
    let context = '';

    if (isRevision) {
      prefix = chalk.yellow('🔄 Revision');
      context = ` (revising thought ${revisesThought})`;
    } else if (branchFromThought) {
      prefix = chalk.green('🌿 Branch');
      context = ` (from thought ${branchFromThought}, ID: ${branchId})`;
    } else {
      prefix = chalk.blue('💭 Thought');
      context = '';
    }

    const header = `${prefix} ${thoughtNumber}/${totalThoughts}${context}`;
    const border = '─'.repeat(Math.max(header.length, thought.length) + 4);

    return `
┌${border}┐
│ ${header} │
├${border}┤
│ ${thought.padEnd(border.length - 2)} │
└${border}┘`;
  }

  public processThought(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const validatedInput = this.validateThoughtData(input);

      if (validatedInput.thoughtNumber > validatedInput.totalThoughts) {
        validatedInput.totalThoughts = validatedInput.thoughtNumber;
      }

      this.thoughtHistory.push(validatedInput);

      if (validatedInput.branchFromThought && validatedInput.branchId) {
        if (!this.branches[validatedInput.branchId]) {
          this.branches[validatedInput.branchId] = {
            branchId: validatedInput.branchId,
            originThought: validatedInput.branchFromThought,
            thoughts: [],
            status: 'active',
            createdAt: Date.now()
          };
        }
        this.branches[validatedInput.branchId].thoughts.push(validatedInput);
        this.activeBranchId = validatedInput.branchId;
      }

      if (!this.disableThoughtLogging) {
        const formattedThought = this.formatThought(validatedInput);
        console.error(formattedThought);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            thoughtNumber: validatedInput.thoughtNumber,
            totalThoughts: validatedInput.totalThoughts,
            nextThoughtNeeded: validatedInput.nextThoughtNeeded,
            activeBranchId: this.activeBranchId,
            branches: this.getBranchSummaries(),
            thoughtHistoryLength: this.thoughtHistory.length
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            status: 'failed'
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  private getBranchSummaries(): BranchSummary[] {
    return Object.values(this.branches).map(branch => ({
      id: branch.branchId,
      originThought: branch.originThought,
      thoughtCount: branch.thoughts.length,
      status: branch.status,
      lastThought: branch.thoughts[branch.thoughts.length - 1]?.thoughtNumber || 0,
      lastUpdated: branch.mergedAt || branch.closedAt || branch.createdAt
    }));
  }

  public listBranches(): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const summaries = this.getBranchSummaries();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            branches: summaries,
            totalBranches: summaries.length
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            status: 'failed'
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  public getBranch(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;

      if (!data.branchId || typeof data.branchId !== 'string') {
        throw new BranchError('Invalid branchId: must be a string');
      }

      const branch = this.branches[data.branchId];
      if (!branch) {
        throw new BranchError('Branch not found: ' + data.branchId);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(branch, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            status: 'failed'
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  public closeBranch(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;

      if (!data.branchId || typeof data.branchId !== 'string') {
        throw new BranchError('Invalid branchId: must be a string');
      }

      const branch = this.branches[data.branchId];
      if (!branch) {
        throw new BranchError('Branch not found: ' + data.branchId);
      }

      if (branch.status !== 'active') {
        throw new BranchError('Branch ' + data.branchId + ' is already ' + branch.status);
      }

      branch.status = 'closed';
      branch.closedAt = Date.now();

      if (data.conclusion && typeof data.conclusion === 'string') {
        branch.conclusion = data.conclusion;
      }

      if (this.activeBranchId === data.branchId) {
        this.activeBranchId = undefined;
      }

      const response: Record<string, unknown> = {
        branchId: branch.branchId,
        status: branch.status,
        closedAt: branch.closedAt
      };
      if (this.echoThoughts && branch.conclusion) {
        response.conclusion = branch.conclusion;
      }
      return this.makeResponse(response);
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            status: 'failed'
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  public mergeBranch(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const data = input as Record<string, unknown>;

      if (!data.branchId || typeof data.branchId !== 'string') {
        throw new BranchError('Invalid branchId: must be a string');
      }

      if (!data.strategy || !['conclusion_only', 'full_integration', 'summary'].includes(data.strategy as string)) {
        throw new BranchError('Invalid strategy: must be conclusion_only, full_integration, or summary');
      }

      const branch = this.branches[data.branchId];
      if (!branch) {
        throw new BranchError('Branch not found: ' + data.branchId);
      }

      if (branch.status === 'merged') {
        throw new BranchError('Branch ' + data.branchId + ' is already merged');
      }

      const strategy = data.strategy as 'conclusion_only' | 'full_integration' | 'summary';
      const mergedAt = Date.now();

      branch.status = 'merged';
      branch.mergedAt = mergedAt;

      if (this.activeBranchId === data.branchId) {
        this.activeBranchId = undefined;
      }

      const nextThoughtNumber = this.thoughtHistory.length + 1;

      let mergeContent = '';
      switch (strategy) {
        case 'conclusion_only':
          mergeContent = branch.conclusion || 'Branch ' + data.branchId + ' merged without explicit conclusion';
          break;
        case 'full_integration':
          mergeContent = 'Branch ' + data.branchId + ' integration:\n' + branch.thoughts.map(t => '- Thought ' + t.thoughtNumber + ': ' + t.thought).join('\n');
          break;
        case 'summary':
          mergeContent = 'Branch ' + data.branchId + ' summary: ' + branch.thoughts.length + ' thoughts explored from thought ' + branch.originThought + (branch.conclusion ? '. Conclusion: ' + branch.conclusion : '');
          break;
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            branchId: branch.branchId,
            status: branch.status,
            mergedAt: branch.mergedAt,
            mergeThoughtNumber: nextThoughtNumber,
            mergeContent: mergeContent
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            status: 'failed'
          }, null, 2)
        }],
        isError: true
      };
    }
  }
}
