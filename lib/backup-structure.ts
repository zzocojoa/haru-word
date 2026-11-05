import { assertCollectionLimit } from './state-limits.ts';
// Bound untrusted collections before schema validation clones them or creates
// per-item errors. Shared by whole-file and staged-part validation.
export function assertBackupStructure(value: unknown) {
  const stack: [unknown, number][] = [[value, 0]];
  while (stack.length) {
    const [item, depth] = stack.pop()!;
    if (!item || typeof item !== 'object') continue;
    if (depth > 24)
      throw new Error('백업 내부의 기록 수나 구조가 지원 범위를 넘었어요.');
    assertCollectionLimit(item, Array.isArray(item) ? 20000 : 10000);
    const values = Object.values(item);
    for (const child of values) if (child && typeof child === 'object') stack.push([child, depth + 1]);
  }
}
