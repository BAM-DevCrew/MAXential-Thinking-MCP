import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  ThoughtData,
  BranchData,
  SessionMetadata,
  SessionState,
} from './types/index.js';

// =============================================================================
// Schema
// =============================================================================

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS thoughts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id          TEXT NOT NULL REFERENCES sessions(id),
    thought_number      INTEGER NOT NULL,
    thought             TEXT NOT NULL,
    type                TEXT NOT NULL DEFAULT 'thought',
    branch_id           TEXT,
    agent_id            TEXT,
    is_revision         INTEGER NOT NULL DEFAULT 0,
    revises_thought     INTEGER,
    branch_from_thought INTEGER,
    created_at          INTEGER NOT NULL,
    UNIQUE(session_id, thought_number)
);

CREATE INDEX IF NOT EXISTS idx_thoughts_session_branch
    ON thoughts(session_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_session_agent
    ON thoughts(session_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_type
    ON thoughts(session_id, type);

CREATE TABLE IF NOT EXISTS branches (
    id              TEXT NOT NULL,
    session_id      TEXT NOT NULL REFERENCES sessions(id),
    origin_thought  INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    conclusion      TEXT,
    agent_id        TEXT,
    merge_strategy  TEXT,
    created_at      INTEGER NOT NULL,
    closed_at       INTEGER,
    merged_at       INTEGER,
    PRIMARY KEY (session_id, id)
);

CREATE TABLE IF NOT EXISTS tags (
    session_id      TEXT NOT NULL,
    thought_number  INTEGER NOT NULL,
    tag             TEXT NOT NULL,
    PRIMARY KEY (session_id, thought_number, tag)
);

CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);

CREATE TABLE IF NOT EXISTS thought_references (
    session_id      TEXT NOT NULL,
    from_thought    INTEGER NOT NULL,
    to_thought      INTEGER NOT NULL,
    PRIMARY KEY (session_id, from_thought, to_thought)
);

CREATE TABLE IF NOT EXISTS agents (
    id              TEXT NOT NULL,
    session_id      TEXT NOT NULL REFERENCES sessions(id),
    name            TEXT NOT NULL,
    description     TEXT,
    parent_agent_id TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    branch_id       TEXT,
    registered_at   INTEGER NOT NULL,
    completed_at    INTEGER,
    PRIMARY KEY (session_id, id)
);

CREATE INDEX IF NOT EXISTS idx_agents_status
    ON agents(session_id, status);

CREATE TABLE IF NOT EXISTS syntheses (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES sessions(id),
    source_branches TEXT NOT NULL,
    content         TEXT NOT NULL,
    created_at      INTEGER NOT NULL
);
`;

// =============================================================================
// Prepared Statement Types
// =============================================================================

interface PreparedStatements {
  insertSession: Database.Statement;
  updateSessionName: Database.Statement;
  updateSessionTimestamp: Database.Statement;
  updateSessionStatus: Database.Statement;
  getSession: Database.Statement;
  listSessions: Database.Statement;
  listSessionsByStatus: Database.Statement;
  countSessions: Database.Statement;
  countSessionsByStatus: Database.Statement;
  insertThought: Database.Statement;
  getThoughtsBySession: Database.Statement;
  getThoughtsByBranch: Database.Statement;
  countThoughtsBySession: Database.Statement;
  insertBranch: Database.Statement;
  updateBranchStatus: Database.Statement;
  updateBranchMerge: Database.Statement;
  getBranchesBySession: Database.Statement;
  countBranchesBySession: Database.Statement;
  deleteTags: Database.Statement;
  insertTag: Database.Statement;
  getTagsByThought: Database.Statement;
  getTagsBySession: Database.Statement;
}

// =============================================================================
// PersistenceLayer
// =============================================================================

export class PersistenceLayer {
  private db: Database.Database;
  private stmts: PreparedStatements;

  constructor(dbPath: string) {
    // Ensure directory exists for file-based DBs
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(SCHEMA_SQL);
    this.stmts = this.prepareStatements();
  }

  // ===========================================================================
  // Session Operations
  // ===========================================================================

  createSession(name: string, description?: string): string {
    const id = randomUUID();
    const now = Date.now();
    this.stmts.insertSession.run(id, name, description || null, 'active', now, now);
    return id;
  }

  updateSessionName(id: string, name: string, description?: string): void {
    const now = Date.now();
    this.stmts.updateSessionName.run(name, description ?? null, now, id);
  }

  updateSessionTimestamp(id: string): void {
    this.stmts.updateSessionTimestamp.run(Date.now(), id);
  }

  updateSessionStatus(id: string, status: string): void {
    this.stmts.updateSessionStatus.run(status, Date.now(), id);
  }

  getSession(id: string): SessionMetadata | null {
    const row = this.stmts.getSession.get(id) as SessionRow | undefined;
    if (!row) return null;
    return this.rowToSessionMetadata(row);
  }

  listSessions(options?: { status?: string; limit?: number; offset?: number }): SessionMetadata[] {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    let rows: SessionRow[];
    if (options?.status) {
      rows = this.stmts.listSessionsByStatus.all(options.status, limit, offset) as SessionRow[];
    } else {
      rows = this.stmts.listSessions.all(limit, offset) as SessionRow[];
    }

    return rows.map(row => this.rowToSessionMetadata(row));
  }

  countSessions(status?: string): number {
    if (status) {
      const row = this.stmts.countSessionsByStatus.get(status) as { count: number };
      return row.count;
    }
    const row = this.stmts.countSessions.get() as { count: number };
    return row.count;
  }

  // ===========================================================================
  // Thought Operations
  // ===========================================================================

  insertThought(sessionId: string, thought: ThoughtData): void {
    const type = this.classifyThoughtType(thought);
    this.stmts.insertThought.run(
      sessionId,
      thought.thoughtNumber,
      thought.thought,
      type,
      thought.branchId || null,
      null, // agent_id — Phase 2
      thought.isRevision ? 1 : 0,
      thought.revisesThought || null,
      thought.branchFromThought || null,
      Date.now()
    );

    // Persist tags if present
    if (thought.tags && thought.tags.length > 0) {
      this.setTags(sessionId, thought.thoughtNumber, thought.tags);
    }

    this.updateSessionTimestamp(sessionId);
  }

  getThoughts(sessionId: string, branchId?: string): ThoughtData[] {
    let rows: ThoughtRow[];
    if (branchId) {
      rows = this.stmts.getThoughtsByBranch.all(sessionId, branchId) as ThoughtRow[];
    } else {
      rows = this.stmts.getThoughtsBySession.all(sessionId) as ThoughtRow[];
    }

    // Batch-load tags for all thoughts in this session
    const allTags = this.getTagsBySession(sessionId);

    return rows.map(row => this.rowToThoughtData(row, allTags));
  }

  // ===========================================================================
  // Branch Operations
  // ===========================================================================

  insertBranch(sessionId: string, branch: BranchData): void {
    this.stmts.insertBranch.run(
      branch.branchId,
      sessionId,
      branch.originThought,
      branch.status,
      branch.conclusion || null,
      null, // agent_id — Phase 2
      null, // merge_strategy
      branch.createdAt
    );
    this.updateSessionTimestamp(sessionId);
  }

  updateBranchClose(sessionId: string, branchId: string, conclusion: string | undefined, closedAt: number): void {
    this.stmts.updateBranchStatus.run('closed', conclusion || null, null, closedAt, null, sessionId, branchId);
    this.updateSessionTimestamp(sessionId);
  }

  updateBranchMerge(sessionId: string, branchId: string, strategy: string, mergedAt: number): void {
    this.stmts.updateBranchMerge.run('merged', strategy, mergedAt, sessionId, branchId);
    this.updateSessionTimestamp(sessionId);
  }

  getBranches(sessionId: string): BranchData[] {
    const rows = this.stmts.getBranchesBySession.all(sessionId) as BranchRow[];
    return rows.map(row => this.rowToBranchData(row));
  }

  // ===========================================================================
  // Tag Operations
  // ===========================================================================

  setTags(sessionId: string, thoughtNumber: number, tags: string[]): void {
    // Replace all tags for this thought (delete + re-insert in a transaction)
    const setTagsTxn = this.db.transaction((sid: string, tn: number, tagList: string[]) => {
      this.stmts.deleteTags.run(sid, tn);
      for (const tag of tagList) {
        this.stmts.insertTag.run(sid, tn, tag);
      }
    });
    setTagsTxn(sessionId, thoughtNumber, tags);
    this.updateSessionTimestamp(sessionId);
  }

  private getTagsBySession(sessionId: string): Map<number, string[]> {
    const rows = this.stmts.getTagsBySession.all(sessionId) as TagRow[];
    const tagMap = new Map<number, string[]>();
    for (const row of rows) {
      const existing = tagMap.get(row.thought_number);
      if (existing) {
        existing.push(row.tag);
      } else {
        tagMap.set(row.thought_number, [row.tag]);
      }
    }
    return tagMap;
  }

  // ===========================================================================
  // Full Session Load (hydration)
  // ===========================================================================

  loadSession(id: string): { metadata: SessionMetadata; state: SessionState } | null {
    const metadata = this.getSession(id);
    if (!metadata) return null;

    const thoughts = this.getThoughts(id);
    const branches = this.getBranches(id);

    // Build branches record keyed by branchId
    const branchRecord: Record<string, BranchData> = {};
    for (const branch of branches) {
      // Attach thoughts that belong to this branch
      branch.thoughts = thoughts.filter(t => t.branchId === branch.branchId);
      branchRecord[branch.branchId] = branch;
    }

    return {
      metadata,
      state: {
        thoughtHistory: thoughts,
        branches: branchRecord,
        summaries: [], // Phase 2+
        checkpoints: [], // Phase 2+
      }
    };
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  close(): void {
    this.db.close();
  }

  // ===========================================================================
  // Internal Helpers
  // ===========================================================================

  private prepareStatements(): PreparedStatements {
    return {
      // Sessions
      insertSession: this.db.prepare(
        'INSERT INTO sessions (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ),
      updateSessionName: this.db.prepare(
        'UPDATE sessions SET name = ?, description = ?, updated_at = ? WHERE id = ?'
      ),
      updateSessionTimestamp: this.db.prepare(
        'UPDATE sessions SET updated_at = ? WHERE id = ?'
      ),
      updateSessionStatus: this.db.prepare(
        'UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?'
      ),
      getSession: this.db.prepare(`
        SELECT s.*,
          (SELECT COUNT(*) FROM thoughts WHERE session_id = s.id) as thought_count,
          (SELECT COUNT(*) FROM branches WHERE session_id = s.id) as branch_count
        FROM sessions s WHERE s.id = ?
      `),
      listSessions: this.db.prepare(`
        SELECT s.*,
          (SELECT COUNT(*) FROM thoughts WHERE session_id = s.id) as thought_count,
          (SELECT COUNT(*) FROM branches WHERE session_id = s.id) as branch_count
        FROM sessions s
        ORDER BY s.updated_at DESC
        LIMIT ? OFFSET ?
      `),
      listSessionsByStatus: this.db.prepare(`
        SELECT s.*,
          (SELECT COUNT(*) FROM thoughts WHERE session_id = s.id) as thought_count,
          (SELECT COUNT(*) FROM branches WHERE session_id = s.id) as branch_count
        FROM sessions s
        WHERE s.status = ?
        ORDER BY s.updated_at DESC
        LIMIT ? OFFSET ?
      `),
      countSessions: this.db.prepare('SELECT COUNT(*) as count FROM sessions'),
      countSessionsByStatus: this.db.prepare('SELECT COUNT(*) as count FROM sessions WHERE status = ?'),

      // Thoughts
      insertThought: this.db.prepare(
        `INSERT INTO thoughts (session_id, thought_number, thought, type, branch_id, agent_id,
         is_revision, revises_thought, branch_from_thought, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      getThoughtsBySession: this.db.prepare(
        'SELECT * FROM thoughts WHERE session_id = ? ORDER BY thought_number ASC'
      ),
      getThoughtsByBranch: this.db.prepare(
        'SELECT * FROM thoughts WHERE session_id = ? AND branch_id = ? ORDER BY thought_number ASC'
      ),
      countThoughtsBySession: this.db.prepare(
        'SELECT COUNT(*) as count FROM thoughts WHERE session_id = ?'
      ),

      // Branches
      insertBranch: this.db.prepare(
        `INSERT INTO branches (id, session_id, origin_thought, status, conclusion, agent_id,
         merge_strategy, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      updateBranchStatus: this.db.prepare(
        `UPDATE branches SET status = ?, conclusion = ?, merge_strategy = ?, closed_at = ?, merged_at = ?
         WHERE session_id = ? AND id = ?`
      ),
      updateBranchMerge: this.db.prepare(
        'UPDATE branches SET status = ?, merge_strategy = ?, merged_at = ? WHERE session_id = ? AND id = ?'
      ),
      getBranchesBySession: this.db.prepare(
        'SELECT * FROM branches WHERE session_id = ? ORDER BY created_at ASC'
      ),
      countBranchesBySession: this.db.prepare(
        'SELECT COUNT(*) as count FROM branches WHERE session_id = ?'
      ),

      // Tags
      deleteTags: this.db.prepare(
        'DELETE FROM tags WHERE session_id = ? AND thought_number = ?'
      ),
      insertTag: this.db.prepare(
        'INSERT OR IGNORE INTO tags (session_id, thought_number, tag) VALUES (?, ?, ?)'
      ),
      getTagsByThought: this.db.prepare(
        'SELECT tag FROM tags WHERE session_id = ? AND thought_number = ?'
      ),
      getTagsBySession: this.db.prepare(
        'SELECT thought_number, tag FROM tags WHERE session_id = ? ORDER BY thought_number ASC'
      ),
    };
  }

  private classifyThoughtType(thought: ThoughtData): string {
    if (thought.type) return thought.type;
    if (thought.thought.startsWith('CONCLUSION:')) return 'conclusion';
    if (thought.thought.startsWith('BRANCH START:')) return 'branch_start';
    return 'thought';
  }

  private rowToSessionMetadata(row: SessionRow): SessionMetadata {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      thoughtCount: row.thought_count,
      branchCount: row.branch_count,
    };
  }

  private rowToThoughtData(row: ThoughtRow, tagMap: Map<number, string[]>): ThoughtData {
    const thought: ThoughtData = {
      thought: row.thought,
      thoughtNumber: row.thought_number,
      totalThoughts: row.thought_number, // will be corrected by caller
      nextThoughtNeeded: true, // will be corrected by caller
    };

    if (row.is_revision) thought.isRevision = true;
    if (row.revises_thought) thought.revisesThought = row.revises_thought;
    if (row.branch_from_thought) thought.branchFromThought = row.branch_from_thought;
    if (row.branch_id) thought.branchId = row.branch_id;
    if (row.type && row.type !== 'thought') thought.type = row.type as ThoughtData['type'];

    const tags = tagMap.get(row.thought_number);
    if (tags && tags.length > 0) thought.tags = tags;

    return thought;
  }

  private rowToBranchData(row: BranchRow): BranchData {
    const branch: BranchData = {
      branchId: row.id,
      originThought: row.origin_thought,
      thoughts: [], // populated by caller during loadSession
      status: row.status as BranchData['status'],
      createdAt: row.created_at,
    };

    if (row.conclusion) branch.conclusion = row.conclusion;
    if (row.closed_at) branch.closedAt = row.closed_at;
    if (row.merged_at) branch.mergedAt = row.merged_at;

    return branch;
  }
}

// =============================================================================
// Row Types (SQLite result shapes)
// =============================================================================

interface SessionRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: number;
  updated_at: number;
  thought_count: number;
  branch_count: number;
}

interface ThoughtRow {
  id: number;
  session_id: string;
  thought_number: number;
  thought: string;
  type: string;
  branch_id: string | null;
  agent_id: string | null;
  is_revision: number;
  revises_thought: number | null;
  branch_from_thought: number | null;
  created_at: number;
}

interface BranchRow {
  id: string;
  session_id: string;
  origin_thought: number;
  status: string;
  conclusion: string | null;
  agent_id: string | null;
  merge_strategy: string | null;
  created_at: number;
  closed_at: number | null;
  merged_at: number | null;
}

interface TagRow {
  thought_number: number;
  tag: string;
}

// =============================================================================
// Path Resolution
// =============================================================================

export function resolveDbPath(): string {
  const envPath = process.env.MAXENTIAL_DB_PATH;

  if (envPath === ':memory:') {
    return ':memory:';
  }

  if (envPath) {
    // Expand ~ to home directory
    if (envPath.startsWith('~')) {
      return path.join(process.env.HOME || '', envPath.slice(1));
    }
    return path.resolve(envPath);
  }

  // Default: project-local .maxential/thinking.db
  return path.join(process.cwd(), '.maxential', 'thinking.db');
}
