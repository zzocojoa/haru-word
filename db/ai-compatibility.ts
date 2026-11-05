// Only old clients take these account-owned reads. Revision guards still own writes.
export async function hasSavedAiContract(db: D1Database, user: string, supported = 1) {
  if(supported<4){
    if(await db.prepare(`SELECT 1 AS found FROM study_sessions s,json_each(s.document,'$.records') r WHERE s.user_id=? AND json_extract(r.value,'$.aiFeedback.validationVersion') IN ('judgment-v4','judgment-v5','judgment-v6') LIMIT 1`).bind(user).first())return true;
    if(await db.prepare(`SELECT 1 AS found FROM grammar_progress WHERE user_id=? AND json_extract(document,'$.feedback.validationVersion') IN ('judgment-v4','judgment-v5','judgment-v6') LIMIT 1`).bind(user).first())return true;
  }
  if (supported >= 3) return false;
  if (supported === 2) {
    if (await db.prepare(`SELECT 1 AS found FROM study_sessions s,json_each(s.document,'$.records') r WHERE s.user_id=? AND
      (json_type(r.value,'$.aiFeedback.contextFingerprint') IS NOT NULL OR json_type(r.value,'$.aiFeedback.contextNote') IS NOT NULL) LIMIT 1`).bind(user).first()) return true;
    return !!await db.prepare(`SELECT 1 AS found FROM grammar_progress WHERE user_id=? AND
      (json_type(document,'$.feedback.contextFingerprint') IS NOT NULL OR json_type(document,'$.feedback.contextNote') IS NOT NULL) LIMIT 1`).bind(user).first();
  }
  if (await db.prepare("SELECT 1 AS found FROM learner_states WHERE user_id=? AND json_type(settings,'$.aiModelId') IS NOT NULL LIMIT 1").bind(user).first()) return true;
  if (await db.prepare(`SELECT 1 AS found FROM study_sessions s,json_each(s.document,'$.records') r
    WHERE s.user_id=? AND json_type(r.value,'$.aiFeedback') IS NOT NULL AND (
      json_extract(r.value,'$.aiFeedback.model') NOT IN ('gemini-3.1-flash-lite','openai/gpt-oss-120b')
      OR json_type(r.value,'$.aiFeedback.provider') IS NOT NULL OR json_type(r.value,'$.aiFeedback.requestedModel') IS NOT NULL
      OR json_type(r.value,'$.aiFeedback.promptVersion') IS NOT NULL OR json_type(r.value,'$.aiFeedback.validationVersion') IS NOT NULL) LIMIT 1`).bind(user).first()) return true;
  return !!await db.prepare(`SELECT 1 AS found FROM grammar_progress WHERE user_id=? AND json_type(document,'$.feedback') IS NOT NULL AND (
    json_extract(document,'$.feedback.model') NOT IN ('gemini-3.1-flash-lite','openai/gpt-oss-120b')
    OR json_type(document,'$.feedback.provider') IS NOT NULL OR json_type(document,'$.feedback.requestedModel') IS NOT NULL
    OR json_type(document,'$.feedback.promptVersion') IS NOT NULL OR json_type(document,'$.feedback.validationVersion') IS NOT NULL) LIMIT 1`).bind(user).first();
}
