/**
 * MAXential Thinking MCP Server - Type Definitions
 * Extended types for branch navigation, thought compression, and session persistence
 */

// ============================================================================
// Core Types (from original sequential-thinking)
// ============================================================================

export interface ThoughtData {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  nextThoughtNeeded: boolean;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
  
  // Phase 2: Thought Compression additions
  references?: number[]; // Array of thought numbers this builds on (DAG)
  type?: 'thought' | 'summary' | 'checkpoint';
  tags?: string[]; // v2.2: semantic tags for categorization
}

// ============================================================================
// Phase 1: Branch Enhancement Types
// ============================================================================

export type BranchStatus = 'active' | 'closed' | 'merged';

export interface BranchData {
  branchId: string;
  originThought: number;
  thoughts: ThoughtData[];
  status: BranchStatus;
  conclusion?: string;
  createdAt: number; // timestamp
  closedAt?: number; // timestamp
  mergedAt?: number; // timestamp
}

export interface BranchSummary {
  id: string;
  originThought: number;
  thoughtCount: number;
  status: BranchStatus;
  lastThought: number;
  lastUpdated: number;
}

export type MergeStrategy = 'conclusion_only' | 'full_integration' | 'summary';

export interface BranchMergeMetadata {
  branchId: string;
  strategy: MergeStrategy;
  mergedAt: number;
}

// ============================================================================
// Phase 2: Thought Compression Types
// ============================================================================

export interface CheckpointData {
  name: string;
  thoughtNumber: number;
  conclusion: string;
  createdAt: number;
}

export interface SummaryData {
  summaryId: string;
  summarizes: {
    start: number;
    end: number;
  };
  content: string;
  compressionRatio: number; // original tokens / summary tokens
  createdAt: number;
}

export interface ThoughtChain {
  thought: ThoughtData;
  dependencies: ThoughtData[];
}

// ============================================================================
// Phase 3: Session Persistence Types
// ============================================================================

export interface SessionMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  thoughtCount: number;
  branchCount: number;
}

export interface SessionState {
  thoughtHistory: ThoughtData[];
  branches: Record<string, BranchData>;
  summaries: SummaryData[];
  checkpoints: CheckpointData[];
}

export interface Session extends SessionMetadata {
  state: SessionState;
}

export type ExportFormat = 'markdown' | 'json';

// ============================================================================
// Tool Response Types
// ============================================================================

export interface SequentialThinkingResponse {
  thoughtNumber: number;
  totalThoughts: number;
  nextThoughtNeeded: boolean;
  thoughtHistoryLength: number;
  activeBranchId?: string;
  branches: BranchSummary[];
}

export interface ListBranchesResponse {
  branches: BranchSummary[];
  totalBranches: number;
}

export interface GetBranchResponse extends BranchData {
  // Full branch data
}

export interface CloseBranchResponse {
  branchId: string;
  status: BranchStatus;
  closedAt: number;
}

export interface MergeBranchResponse {
  branchId: string;
  status: BranchStatus;
  mergedAt: number;
  mergeThoughtNumber: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class BranchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BranchError';
  }
}

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}
