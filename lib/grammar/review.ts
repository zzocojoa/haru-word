import ledger from '../../data/grammar-content-review.json';
import { grammarReviewUnits } from './content-v4';
import { sourceIndex } from './review-sources';
export { exampleReviewSources } from './review-sources';

export async function reviewHash(content: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(content));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
// Fail closed before offering new v4 lessons. This is integrity/coverage,
// not an automatic certification of English correctness.
export async function grammarV4Reviewed(manifest = ledger, units = grammarReviewUnits()) {
  try {
    if (manifest.contentVersion !== 4 || manifest.entries.length !== units.length) return false;
    const entries = new Map(manifest.entries.map(entry => [entry.id, entry]));
    if (entries.size !== units.length || units.some(unit => {
      const entry = entries.get(unit.id);
      return !entry || entry.contentVersion !== 4 || entry.status !== 'source-compared' || !entry.reviewedOn
        || !entry.evidenceSummary || !entry.sources.length || entry.sources.some(id => !manifest.sources[id as keyof typeof manifest.sources]);
    })) return false;
    if (await reviewHash(units) !== manifest.curriculumHash) return false;
    if (await reviewHash(manifest.sources) !== manifest.sourceHash || JSON.stringify(manifest.sources) !== JSON.stringify(sourceIndex.sources)) return false;
    if (units.filter(u => u.id.includes(':example:')).some(unit => JSON.stringify(entries.get(unit.id)!.sources) !== JSON.stringify(sourceIndex.examples[unit.id as keyof typeof sourceIndex.examples]))) return false;
    return (await Promise.all(units.map(async unit => await reviewHash(unit.content) === entries.get(unit.id)!.contentHash))).every(Boolean);
  } catch { return false; }
}
// Content and ledger are immutable within a deployed Worker. Do not repeat
// hundreds of identical hashes on every dynamic home request.
let readiness: Promise<boolean> | undefined;
export function grammarV4Ready() { return readiness ??= grammarV4Reviewed(); }
