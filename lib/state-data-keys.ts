import type { Progress } from './learning/model';
import { assertCollectionLimit, STATE_COUNTS } from './state-limits.ts';

// These names are user data only at progress.<entry>.senses.<meaning>.
// Reject them everywhere else before schema parsing can drop or reinterpret them.
export function assertStateDataKeys(value: unknown, part?: 'progress' | 'sessions' | 'grammar', boundCollections = true) {
  const stack: [unknown, string[]][] = [[value, part ? [part] : []]];
  while (stack.length) {
    const [item, path] = stack.pop()!;
    if (!item || typeof item !== 'object') continue;
    if (path.length > 24) throw new Error('Unsupported state depth');
    const meanings = path.length === 3 && path[0] === 'progress' && path[2] === 'senses';
    const recordPart = path.length === 1 && Object.hasOwn(STATE_COUNTS, path[0]) ? path[0] as keyof typeof STATE_COUNTS : undefined;
    if (recordPart && Array.isArray(item)) throw new Error('Unsupported state record collection');
    const last = path.at(-1);
    const arrayLimit = last === 'encounters' ? 200 : last === 'warmupIds' ? 3
      : last === 'questionIds' || last === 'hints' || last === 'clues' ? 3
      : last === 'frame' ? 4 : last === 'order' ? 12
      : last === 'ids' && path[0] === 'sessions' ? 5000
      : last === 'ids' && path[0] === 'settings' && path[1] === 'assessments' ? 20
      : last === 'seen' ? 5000 : last === 'retry' ? 10000 : 20000;
    // Existing oversized server histories remain readable/exportable. Mutation
    // and restore callers use bounds; response validation still checks keys.
    if (boundCollections) assertCollectionLimit(item, meanings ? 100 : recordPart ? STATE_COUNTS[recordPart] : Array.isArray(item) ? arrayLimit : 10000);
    for (const [key, child] of Object.entries(item)) {
      if (!meanings && ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe state key');
      if (child && typeof child === 'object') stack.push([child, [...path, key]]);
    }
  }
}
export const SENSE_KEY_HEADERS = { 'X-Study-Sense-Keys': '1' };
export const SENSE_KEY_UPGRADE_MESSAGE = '뜻별 기록 처리가 업데이트되었어요. 저장하지 못한 입력은 따로 보관한 뒤 페이지를 새로고침해 주세요.';
export const supportsSenseKeys = (request?: Request) => request?.headers.get('X-Study-Sense-Keys') === '1';
export const hasLiteralPrototypeSense = (progress: Record<string, Progress>) => Object.values(progress).some(p => p.senses && Object.hasOwn(p.senses, '__proto__'));

