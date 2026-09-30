import { EMPTY, type State } from '@/lib/learning';
import { restoreChunks } from '@/lib/backup';
import type { SaveStateRequest } from '@/lib/api-contracts';
import { checkSaveCapacity } from './state-capacity';

export type StoredStateDocuments = {
  revision: number; settings: string;
  progress: { entry_id: string; document: string }[];
  sessions: { session_id: string; document: string }[];
  grammar?: { lesson_id: string; document: string }[];
};

export async function loadStateDocuments(db: D1Database, userId: string, includeGrammar = false): Promise<StoredStateDocuments> {
  await db.prepare('INSERT OR IGNORE INTO learner_states (user_id,revision,settings,updated_at) VALUES (?,0,?,?)')
    .bind(userId, JSON.stringify(EMPTY.settings), new Date().toISOString()).run();
  const rows = await db.batch([
    db.prepare('SELECT revision,settings FROM learner_states WHERE user_id=?').bind(userId),
    db.prepare('SELECT entry_id,document FROM word_progress WHERE user_id=?').bind(userId),
    db.prepare('SELECT session_id,document FROM study_sessions WHERE user_id=?').bind(userId),
    ...(includeGrammar ? [db.prepare('SELECT lesson_id,document FROM grammar_progress WHERE user_id=?').bind(userId)] : []),
  ]);
  const profile = rows[0].results[0] as { revision: number; settings: string };
  return {
    revision: profile.revision,
    settings: profile.settings,
    progress: rows[1].results as StoredStateDocuments['progress'],
    sessions: rows[2].results as StoredStateDocuments['sessions'],
    ...(includeGrammar ? { grammar: rows[3].results as NonNullable<StoredStateDocuments['grammar']> } : {}),
  };
}

export async function existingSessionIds(db: D1Database, userId: string, ids: string[]): Promise<Set<string>> {
  const rows = await db.prepare('SELECT session_id FROM study_sessions WHERE user_id=? AND session_id IN (SELECT value FROM json_each(?))')
    .bind(userId, JSON.stringify(ids)).all<{ session_id: string }>();
  return new Set(rows.results.map(row => row.session_id));
}

// Validate delta references against this account, not a full history reload.
// The revision-guarded write rejects any concurrent restore/change after this read.
export async function validSaveReferences(db: D1Database, userId: string, data: SaveStateRequest): Promise<boolean> {
  const active = data.settings?.activeSessionId;
  if (active && !data.sessions[active] && !(await existingSessionIds(db, userId, [active])).has(active)) return false;
  const personalIds = [...new Set(Object.values(data.sessions).flatMap(s =>
    [...s.ids.map(id => s.records[id].entryId || id), ...s.warmupIds]))]
    .filter(id => id.startsWith('personal_') && !data.progress[id]?.personal);
  if (!personalIds.length) return true;
  const rows = await db.prepare("SELECT entry_id FROM word_progress WHERE user_id=? AND entry_id IN (SELECT value FROM json_each(?)) AND json_extract(document,'$.personal.id')=entry_id")
    .bind(userId, JSON.stringify(personalIds)).all<{ entry_id: string }>();
  return rows.results.length === personalIds.length;
}

export async function saveState(db: D1Database, userId: string, data: SaveStateRequest): Promise<boolean> {
  if (!await checkSaveCapacity(db, userId, data)) return false;
  const statements: D1PreparedStatement[] = [];
  if (data.grammar && Object.keys(data.grammar).length) {
    statements.push(db.prepare('INSERT INTO grammar_progress(user_id,lesson_id,document) SELECT ?,entry.key,entry.value FROM json_each(?) AS entry WHERE EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND revision=?) ON CONFLICT(user_id,lesson_id) DO UPDATE SET document=excluded.document')
      .bind(userId, JSON.stringify(data.grammar), userId, data.revision));
  }
  // One atomic D1 batch. All deltas test the same revision, which advances LAST.
  // One bounded JSON parameter keeps monthly carryover within D1 query limits.
  if (Object.keys(data.progress).length) {
    statements.push(db.prepare('INSERT INTO word_progress(user_id,entry_id,document) SELECT ?,entry.key,entry.value FROM json_each(?) AS entry WHERE EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND revision=?) ON CONFLICT(user_id,entry_id) DO UPDATE SET document=excluded.document')
      .bind(userId, JSON.stringify(data.progress), userId, data.revision));
  }
  for (const [id, session] of Object.entries(data.sessions)) {
    statements.push(db.prepare('INSERT INTO study_sessions(user_id,session_id,document) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND revision=?) ON CONFLICT(user_id,session_id) DO UPDATE SET document=excluded.document')
      .bind(userId, id, JSON.stringify(session), userId, data.revision));
  }
  statements.push(data.settings
    ? db.prepare('UPDATE learner_states SET revision=revision+1,settings=?,updated_at=? WHERE user_id=? AND revision=?')
      .bind(JSON.stringify(data.settings), new Date().toISOString(), userId, data.revision)
    : db.prepare('UPDATE learner_states SET revision=revision+1,updated_at=? WHERE user_id=? AND revision=?')
      .bind(new Date().toISOString(), userId, data.revision));
  const results = await db.batch(statements);
  return results[results.length - 1].meta.changes === 1;
}

export async function restoreState(db: D1Database, userId: string, revision: number, state: State): Promise<boolean> {
  if (!await checkSaveCapacity(db, userId, { ...state, revision }, true)) return false;
  // Conflicts change no rows. A failed statement rolls back even the deletions.
  const condition = 'EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND revision=?)';
  const statements = [
    db.prepare(`DELETE FROM word_progress WHERE user_id=? AND ${condition}`).bind(userId, userId, revision),
    db.prepare(`DELETE FROM study_sessions WHERE user_id=? AND ${condition}`).bind(userId, userId, revision),
  ];
  if (state.grammar !== undefined) {
    statements.push(db.prepare(`DELETE FROM grammar_progress WHERE user_id=? AND ${condition}`).bind(userId, userId, revision));
    for (const chunk of restoreChunks(state.grammar)) statements.push(db.prepare(`INSERT INTO grammar_progress(user_id,lesson_id,document) SELECT ?,entry.key,entry.value FROM json_each(?) AS entry WHERE ${condition}`).bind(userId, chunk, userId, revision));
  }
  for (const chunk of restoreChunks(state.progress)) {
    statements.push(db.prepare(`INSERT INTO word_progress(user_id,entry_id,document) SELECT ?,entry.key,entry.value FROM json_each(?) AS entry WHERE ${condition}`)
      .bind(userId, chunk, userId, revision));
  }
  for (const chunk of restoreChunks(state.sessions)) {
    statements.push(db.prepare(`INSERT INTO study_sessions(user_id,session_id,document) SELECT ?,entry.key,entry.value FROM json_each(?) AS entry WHERE ${condition}`)
      .bind(userId, chunk, userId, revision));
  }
  statements.push(db.prepare('UPDATE learner_states SET settings=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?')
    .bind(JSON.stringify(state.settings), new Date().toISOString(), userId, revision));
  const results = await db.batch(statements);
  return results.at(-1)?.meta.changes === 1;
}
