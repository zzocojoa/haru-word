// Account totals, shared by delta saves and both whole/partitioned restores.
export const STATE_COUNTS = { progress: 5_000, sessions: 10_000, grammar: 15 } as const;
export const STATE_BACKUP_BYTES = 20_000_000;
export const STATE_PART_BYTES = 1_800_000;

// Check keys without reading child values or allocating Object.entries/values.
// JSON parsing has already happened; this does not bound the parser's allocation.
export function assertCollectionLimit(value: object, limit: number) {
  if (Array.isArray(value)) {
    if (value.length > limit) throw new Error('State collection: 백업 내부의 기록 수나 구조가 지원 범위를 넘었어요.');
    return;
  }
  let count = 0;
  for (const key in value) {
    if (Object.hasOwn(value, key) && ++count > limit) throw new Error('State collection: 백업 내부의 기록 수나 구조가 지원 범위를 넘었어요.');
  }
}
