import type { Progress, Word } from '@/lib/learning';
import { selectedAiModel } from '@/lib/ai-models';

export async function loadFeedbackModel(db: D1Database, userId: string) {
  const row = await db.prepare('SELECT settings FROM learner_states WHERE user_id=?').bind(userId).first<{ settings: string }>();
  return selectedAiModel(row ? JSON.parse(row.settings) : {});
}

export async function loadFeedbackContext(db: D1Database, userId: string, kind: 'word' | 'grammar', id: string) {
  // D1 batch reads one consistent model/document snapshot. A later setting change
  // cannot switch an already-started request to a different-priced model.
  const rows = await db.batch([
    db.prepare('SELECT settings,revision FROM learner_states WHERE user_id=?').bind(userId),
    db.prepare(kind === 'word' ? 'SELECT document FROM study_sessions WHERE user_id=? AND session_id=?'
      : 'SELECT document FROM grammar_progress WHERE user_id=? AND lesson_id=?').bind(userId, id),
  ]);
  const profile = rows[0].results[0] as { settings: string;revision:number } | undefined;
  const document = rows[1].results[0] as { document: string } | undefined;
  return { modelId: selectedAiModel(profile ? JSON.parse(profile.settings) : {}), document: document?.document ?? null,revision:profile?.revision };
}

export async function loadPersonalWord(db: D1Database, userId: string, entryId: string): Promise<Word | undefined> {
  const row = await db.prepare('SELECT document FROM word_progress WHERE user_id=? AND entry_id=?')
    .bind(userId, entryId).first<{ document: string }>();
  return row ? (JSON.parse(row.document) as Progress).personal : undefined;
}

// Operational attempt counter only, never a quota or cooldown.
const FEEDBACK_USAGE_SQL = `INSERT INTO ai_daily_usage (user_id,day,request_count,last_request_at)
VALUES (?,?,1,?) ON CONFLICT(user_id,day) DO UPDATE SET
request_count=request_count+1,last_request_at=excluded.last_request_at RETURNING request_count`;

export async function recordFeedbackAttempt(db: D1Database, userId: string, day: string, now: number): Promise<void> {
  try{await db.prepare(FEEDBACK_USAGE_SQL).bind(userId, day, now).first<{ request_count: number }>();}
  catch{console.warn(JSON.stringify({event:'feedback_usage_write_failed',code:'storage_unavailable'}));}
}
