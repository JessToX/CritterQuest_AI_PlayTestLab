// Runtime persistence uses labRecords and labRecordChunks through db/lab.ts.
// The normalized tables below remain for migration compatibility; do not drop them.
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const labRecords = sqliteTable(
  'lab_records',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    value: text('value').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_lab_records_kind_updated').on(table.kind, table.updatedAt),
  ],
);

export const ruleVersions = sqliteTable(
  'rule_versions',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull(),
    sourceFilename: text('source_filename').notNull(),
    sourceHash: text('source_hash').notNull(),
    status: text('status', { enum: ['draft', 'active', 'archived'] })
      .notNull()
      .default('draft'),
    snapshotJson: text('snapshot_json').notNull(),
    diffJson: text('diff_json'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_rule_versions_source_hash').on(table.sourceHash),
    index('idx_rule_versions_status').on(table.status),
  ],
);

export const providerConnections = sqliteTable('provider_connections', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  providerKind: text('provider_kind').notNull(),
  baseUrl: text('base_url'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const agentProfiles = sqliteTable(
  'agent_profiles',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    providerConnectionId: text('provider_connection_id').references(
      () => providerConnections.id,
    ),
    model: text('model').notNull().default(''),
    customInstructions: text('custom_instructions').notNull().default(''),
    memoryMode: text('memory_mode', { enum: ['active', 'frozen', 'disabled'] })
      .notNull()
      .default('active'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_agent_profiles_provider').on(table.providerConnectionId),
  ],
);

export const matches = sqliteTable(
  'matches',
  {
    id: text('id').primaryKey(),
    ruleVersionId: text('rule_version_id')
      .notNull()
      .references(() => ruleVersions.id),
    seed: integer('seed').notNull(),
    status: text('status', {
      enum: ['pending', 'running', 'complete', 'failed', 'draw'],
    }).notNull(),
    winnerAgentId: text('winner_agent_id').references(() => agentProfiles.id),
    roundCount: integer('round_count').notNull().default(0),
    turnCount: integer('turn_count').notNull().default(0),
    configJson: text('config_json').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('idx_matches_rule_created').on(table.ruleVersionId, table.createdAt),
    index('idx_matches_status').on(table.status),
  ],
);

export const gameEvents = sqliteTable(
  'game_events',
  {
    id: text('id').primaryKey(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id),
    turn: integer('turn').notNull(),
    round: integer('round').notNull(),
    actorAgentId: text('actor_agent_id').references(() => agentProfiles.id),
    eventType: text('event_type').notNull(),
    publicText: text('public_text').notNull(),
    payloadJson: text('payload_json'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_game_events_match_turn').on(table.matchId, table.turn),
  ],
);

export const memoryEntries = sqliteTable(
  'memory_entries',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agentProfiles.id),
    ruleVersionId: text('rule_version_id')
      .notNull()
      .references(() => ruleVersions.id),
    kind: text('kind', { enum: ['episode', 'strategy'] }).notNull(),
    content: text('content').notNull(),
    sourceMatchIdsJson: text('source_match_ids_json').notNull().default('[]'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_memory_agent_rule_active').on(
      table.agentId,
      table.ruleVersionId,
      table.active,
    ),
  ],
);

export const memorySnapshots = sqliteTable(
  'memory_snapshots',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agentProfiles.id),
    label: text('label').notNull(),
    memoryEntryIdsJson: text('memory_entry_ids_json').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_memory_snapshots_agent').on(table.agentId, table.createdAt),
  ],
);

export const labRecordChunks = sqliteTable(
  'lab_record_chunks',
  {
    recordId: text('record_id').notNull(),
    revision: text('revision').notNull(),
    part: integer('part').notNull(),
    value: text('value').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.recordId, table.revision, table.part] }),
  ],
);

export const labCallBudgets = sqliteTable('lab_call_budgets', {
  gameId: text('game_id').primaryKey(),
  limit: integer('call_limit').notNull(),
  used: integer('used').notNull(),
});
