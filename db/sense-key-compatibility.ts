// Old Zod clients drop this literal dictionary key. Refuse their reads and
// affected writes instead of allowing a partial snapshot to erase the sense.
export async function hasSavedLiteralPrototypeSense(db: D1Database, user: string, ids: string[] | null = null) {
  if (ids && !ids.length) return false;
  const keys = ids === null ? null : JSON.stringify(ids);
  return !!await db.prepare(`SELECT 1 AS found FROM word_progress p,json_each(p.document,'$.senses') sense
    WHERE p.user_id=? AND (? IS NULL OR p.entry_id IN (SELECT value FROM json_each(?))) AND sense.key='__proto__' LIMIT 1`)
    .bind(user, keys, keys).first();
}
