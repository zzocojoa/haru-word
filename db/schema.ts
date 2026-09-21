import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

// Durable quota survives Worker restarts and simultaneous requests.
export const aiDailyUsage = sqliteTable("ai_daily_usage", {
  userId: text("user_id").notNull(),
  day: text("day").notNull(),
  requestCount: integer("request_count").notNull(),
  lastRequestAt: integer("last_request_at").notNull(),
}, table => [primaryKey({ columns: [table.userId, table.day] })]);
