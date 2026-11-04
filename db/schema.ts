import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Independent resume cursor; deliberately excluded from learning/backup revisions.
export const imagePracticePositions = sqliteTable('image_practice_positions', {
  userId: text('user_id').primaryKey(),
  entryId: text('entry_id').notNull(),
  revision: integer('revision').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Short-lived server request receipts; no card content, keys, or learning revisions.
export const cardAutomationNonces = sqliteTable('card_automation_nonces', {
  nonce: text('nonce').primaryKey(), expiresAt: integer('expires_at').notNull(),
}, table => [index('card_automation_nonce_expiry').on(table.expiresAt)]);

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

// Bounded, independent mini-lesson progress. Shares learner_states.revision.
export const grammarProgress = sqliteTable('grammar_progress', {
  userId: text('user_id').notNull(), lessonId: text('lesson_id').notNull(), document: text('document').notNull(),
}, table => [primaryKey({ columns: [table.userId, table.lessonId] })]);

// Durable request counts are operational metrics, not an app-enforced quota.
export const aiDailyUsage = sqliteTable("ai_daily_usage", {
  userId: text("user_id").notNull(),
  day: text("day").notNull(),
  requestCount: integer("request_count").notNull(),
  lastRequestAt: integer("last_request_at").notNull(),
}, table => [primaryKey({ columns: [table.userId, table.day] })]);

// Response body: 24h; minimal idempotency tombstone: 7d. Not learning history.
export const feedbackRequests = sqliteTable('feedback_requests', {
  userId:text('user_id').notNull().references(()=>learnerStates.userId,{onDelete:'cascade'}),
  requestId:text('request_id').notNull(),fingerprint:text('fingerprint').notNull(),
  domain:text('domain').notNull(),targetId:text('target_id').notNull(),status:text('status').notNull(),
  startedAt:integer('started_at').notNull(),expiresAt:integer('expires_at').notNull(),
  responseExpiresAt:integer('response_expires_at').notNull(),responseStatus:integer('response_status'),response:text('response'),
},table=>[primaryKey({columns:[table.userId,table.requestId]}),index('feedback_requests_expiry').on(table.expiresAt)]);

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
