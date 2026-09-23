import { senseProgress, type Content, type Progress } from './learning.ts';

const fields = ['expression', 'expressionTranslation', 'example', 'translation'] as const;
const pairs = [['expression', 'expressionTranslation'], ['example', 'translation']] as const;
// A lesson keeps its own snapshot. Only deliberate edits may update the library;
// stale snapshots and changes made in another surface are never silently copied.
export function studyMaterialEdit(material: Content, baseline: Content, opened: Progress | undefined, latest: Progress | undefined) {
  const before = senseProgress(opened, material.meaning), now = senseProgress(latest, material.meaning);
  const changed = fields.filter(key => material.meaning.trim() !== baseline.meaning.trim()
    || (material[key] ?? '') !== (baseline[key] ?? ''));
  const conflicts = changed.filter(key => now[key] !== before[key] && now[key] !== material[key]);
  // Expression and its gloss are one contextual unit, as are example and translation.
  for (const pair of pairs) {
    if (pair.some(key => changed.includes(key)) && pair.some(key => now[key] !== before[key] && now[key] !== material[key]))
      for (const key of pair) if (!conflicts.includes(key)) conflicts.push(key);
  }
  // First study must still seed material absent from the library. Backfill a
  // missing member only if its contextual partner has not changed elsewhere.
  const seeded = fields.filter(key => now[key] === undefined && pairs.find(pair => pair.some(partner => partner === key))!
    .every(partner => now[partner] === undefined || now[partner] === material[partner]));
  return { conflicts, patch: Object.fromEntries([...new Set([...changed, ...seeded])].map(key => [key, material[key]])) as Partial<Content> };
}
