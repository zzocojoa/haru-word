// Used only for old clients. Current clients avoid these compatibility reads.
// NULL checks all owned rows; an empty array checks none. No cross-account data.
export async function hasSavedStructuredFeedback(db: D1Database, user: string, sessions: string[] | null = null, grammar: string[] | null = null) {
  if (sessions === null || sessions.length) {
    const found = await db.prepare(`SELECT 1 AS found FROM study_sessions s, json_each(s.document,'$.records') r
      WHERE s.user_id=? AND (? IS NULL OR s.session_id IN (SELECT value FROM json_each(?)))
      AND json_type(r.value,'$.aiFeedback.structure') IS NOT NULL LIMIT 1`)
      .bind(user, sessions === null ? null : JSON.stringify(sessions), JSON.stringify(sessions)).first();
    if (found) return true;
  }
  if (grammar === null || grammar.length) {
    const found = await db.prepare(`SELECT 1 AS found FROM grammar_progress WHERE user_id=?
      AND (? IS NULL OR lesson_id IN (SELECT value FROM json_each(?)))
      AND json_type(document,'$.feedback.structure') IS NOT NULL LIMIT 1`)
      .bind(user, grammar === null ? null : JSON.stringify(grammar), JSON.stringify(grammar)).first();
    if (found) return true;
  }
  return false;
}
