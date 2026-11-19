import { firstTestAssessmentEntry, isTestFamiliarityReveal } from '@/lib/learning/familiarity-cleanup';
import { progressSchema, settingsSchema } from '@/lib/validation';

export async function clearTestFamiliarityDraft(db: D1Database, userId: string, revision: number) {
  const profile = await db.prepare(`
    SELECT profile.revision,profile.settings,word.document
    FROM learner_states AS profile
    LEFT JOIN word_progress AS word ON word.user_id=profile.user_id
      AND word.entry_id=json_extract(profile.settings,'$.assessments.' || json_extract(profile.settings,'$.level') || '.ids[0]')
    WHERE profile.user_id=?`)
    .bind(userId).first<{ revision: number; settings: string; document: string | null }>();
  if (profile?.revision !== revision) return 'conflict';

  const settings = settingsSchema.safeParse(JSON.parse(profile.settings));
  if (!settings.success) return 'ineligible';
  const entryId = firstTestAssessmentEntry(settings.data);
  if (!entryId || !profile.document) return 'ineligible';
  const document = JSON.parse(profile.document);
  const progress = progressSchema.safeParse(document);
  if (!progress.success || !isTestFamiliarityReveal(progress.data.familiarityCheck)) return 'ineligible';

  const pruneWord = Object.keys(document).length === 1
    ? 'DELETE FROM word_progress'
    : "UPDATE word_progress SET document=json_remove(document,'$.familiarityCheck')";
  // Update the word and settings atomically under the shared learning revision.
  const [, updated] = await db.batch([
    db.prepare(`${pruneWord} WHERE user_id=? AND entry_id=?
      AND EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND revision=?)`)
      .bind(userId, entryId, userId, revision),
    db.prepare('UPDATE learner_states SET settings=json_remove(settings,?),revision=revision+1,updated_at=? WHERE user_id=? AND revision=?')
      .bind(`$.assessments.${settings.data.level}`, new Date().toISOString(), userId, revision),
  ]);
  return updated.meta.changes === 1 ? 'cleared' : 'conflict';
}
