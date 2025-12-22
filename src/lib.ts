import chalk from 'chalk';
import {
  ThoughtData,
  BranchData,
  BranchSummary,
  BranchError
} from './types/index.js';

export class SequentialThinkingServer {
  private thoughtHistory: ThoughtData[] = [];
  private branches: Record<string, BranchData> = {};
  private activeBranchId: string | undefined;
  private disableThoughtLogging: boolean;
  private currentThoughtNumber: number = 0;
  private isComplete: boolean = false;

  constructor() {
    this.disableThoughtLogging = (process.env.DISABLE_THOUGHT_LOGGING || "").toLowerCase() === "true";
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

      return this.makeResponse({
        thoughtNumber: thoughtData.thoughtNumber,
        activeBranchId: this.activeBranchId,
        totalThoughts: this.currentThoughtNumber,
        branchCount: Object.keys(this.branches).length
      });
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

      return this.makeResponse({
        thoughtNumber: thoughtData.thoughtNumber,
        revisesThought: data.revisesThought,
        activeBranchId: this.activeBranchId,
        totalThoughts: this.currentThoughtNumber
      });
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

      if (branchId) {
        if (!this.branches[branchId]) {
          throw new BranchError(`Branch '${branchId}' not found`);
        }
        if (this.branches[branchId].status !== 'active') {
          throw new BranchError(`Branch '${branchId}' is ${this.branches[branchId].status}, not active`);
        }
        this.activeBranchId = branchId;
      } else {
        // Switch to main (no branch)
        this.activeBranchId = undefined;
      }

      return this.makeResponse({
        activeBranchId: this.activeBranchId || 'main',
        message: branchId ? `Switched to branch '${branchId}'` : 'Switched to main'
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

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            branchId: branch.branchId,
            status: branch.status,
            closedAt: branch.closedAt
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
