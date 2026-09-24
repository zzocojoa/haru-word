import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Optimistic revisions protect edits across devices. Individual progress and
// session rows avoid D1's per-row size limit as the learning history grows.
export const learnerStates = sqliteTable("learner_states", {
  userId: text("user_id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  settings: text("settings").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const wordProgress = sqliteTable("word_progress", {
  userId: text("user_id").notNull(),
  entryId: text("entry_id").notNull(),
  document: text("document").notNull(),
}, table => [primaryKey({ columns: [table.userId, table.entryId] })]);
export const studySessions = sqliteTable("study_sessions", {
  userId: text("user_id").notNull(),
  sessionId: text("session_id").notNull(),
  document: text("document").notNull(),
}, table => [primaryKey({ columns: [table.userId, table.sessionId] })]);

// Durable request counts are operational metrics, not an app-enforced quota.
export const aiDailyUsage = sqliteTable("ai_daily_usage", {
  userId: text("user_id").notNull(),
  day: text("day").notNull(),
  requestCount: integer("request_count").notNull(),
  lastRequestAt: integer("last_request_at").notNull(),
}, table => [primaryKey({ columns: [table.userId, table.day] })]);

// Nullable active_owner permits receipts but only one active upload per account.
export const restoreJobs = sqliteTable('restore_jobs', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), activeOwner: text('active_owner'),
  baseRevision: integer('base_revision').notNull(), manifest: text('manifest').notNull(), fileHash: text('file_hash').notNull(),
  status: text('status').notNull(), validated: integer('validated').notNull().default(0),
  expiresAt: integer('expires_at').notNull(), committedRevision: integer('committed_revision'),
}, t => [uniqueIndex('restore_jobs_active_owner').on(t.activeOwner), index('restore_jobs_owner').on(t.userId), index('restore_jobs_expiry').on(t.expiresAt)]);
export const restoreParts = sqliteTable('restore_parts', {
  jobId: text('job_id').notNull().references(() => restoreJobs.id, { onDelete: 'cascade' }),
  partIndex: integer('part_index').notNull(), kind: text('kind').notNull(), hash: text('hash').notNull(), document: text('document').notNull(),
}, t => [primaryKey({ columns: [t.jobId, t.partIndex] })]);
