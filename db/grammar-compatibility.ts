import { grammarUnsupported, type GrammarClientVersion } from '@/lib/grammar/compatibility';
import { grammarProgressSchema } from '@/lib/grammar/model';

export async function hasSavedModernGrammar(db: D1Database, user: string, ids?: string[]) {
  return hasSavedUnsupportedGrammar(db,user,1,ids);
}
export async function hasSavedUnsupportedGrammar(db: D1Database, user: string, supported:GrammarClientVersion, ids?: string[]) {
  const rows = await db.prepare('SELECT lesson_id,document FROM grammar_progress WHERE user_id=?').bind(user).all<{ lesson_id: string; document: string }>();
  return rows.results.some(row => (!ids || ids.includes(row.lesson_id)) && grammarUnsupported(grammarProgressSchema.parse(JSON.parse(row.document)),supported));
}
