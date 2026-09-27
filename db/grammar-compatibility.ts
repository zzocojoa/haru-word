import { hasModernGrammar } from '@/lib/grammar/compatibility';
import { grammarProgressSchema } from '@/lib/grammar/model';

export async function hasSavedModernGrammar(db: D1Database, user: string, ids?: string[]) {
  const rows = await db.prepare('SELECT lesson_id,document FROM grammar_progress WHERE user_id=?').bind(user).all<{ lesson_id: string; document: string }>();
  return rows.results.some(row => (!ids || ids.includes(row.lesson_id)) && hasModernGrammar(grammarProgressSchema.parse(JSON.parse(row.document))));
}
