export type ImagePracticePosition = { entryId: string | null; revision: number; updatedAt: string | null };
const columns = 'entry_id AS entryId, revision, updated_at AS updatedAt';

export async function loadImagePracticePosition(db: D1Database, userId: string): Promise<ImagePracticePosition> {
  return await db.prepare(`SELECT ${columns} FROM image_practice_positions WHERE user_id = ?`)
    .bind(userId).first<ImagePracticePosition>() ?? { entryId: null, revision: 0, updatedAt: null };
}

// One statement arbitrates even simultaneous first writes. No learner row creation.
export async function saveImagePracticePosition(db: D1Database, userId: string, entryId: string, revision: number) {
  const updatedAt = new Date().toISOString();
  return revision === 0
    ? db.prepare(`INSERT INTO image_practice_positions (user_id, entry_id, revision, updated_at)
        VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING RETURNING ${columns}`)
      .bind(userId, entryId, updatedAt).first<ImagePracticePosition>()
    : db.prepare(`UPDATE image_practice_positions SET entry_id = ?, revision = revision + 1, updated_at = ?
        WHERE user_id = ? AND revision = ? RETURNING ${columns}`)
      .bind(entryId, updatedAt, userId, revision).first<ImagePracticePosition>();
}
