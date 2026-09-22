import type { Progress, Session, Word } from '@/lib/learning';

export async function loadFeedbackSession(db: D1Database, userId: string, sessionId: string): Promise<Session | null> {
  const row = await db.prepare('SELECT document FROM study_sessions WHERE user_id=? AND session_id=?')
    .bind(userId, sessionId).first<{ document: string }>();
  return row ? JSON.parse(row.document) as Session : null;
}

export async function loadPersonalWord(db: D1Database, userId: string, entryId: string): Promise<Word | undefined> {
  const row = await db.prepare('SELECT document FROM word_progress WHERE user_id=? AND entry_id=?')
    .bind(userId, entryId).first<{ document: string }>();
  return row ? (JSON.parse(row.document) as Progress).personal : undefined;
}

// Operational attempt counter only, never a quota or cooldown. Google owns limits.
const FEEDBACK_USAGE_SQL = `INSERT INTO ai_daily_usage (user_id,day,request_count,last_request_at)
VALUES (?,?,1,?) ON CONFLICT(user_id,day) DO UPDATE SET
request_count=request_count+1,last_request_at=excluded.last_request_at RETURNING request_count`;

export async function recordFeedbackAttempt(db: D1Database, userId: string, day: string, now: number): Promise<void> {
  await db.prepare(FEEDBACK_USAGE_SQL).bind(userId, day, now).first<{ request_count: number }>();
}
