import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRAMMAR_LESSONS } from '../lib/grammar/content.ts';

export function prepareGrammarIndex(check = false) {
  const sourceSha256 = createHash('sha256').update(readFileSync('lib/grammar/content.ts')).digest('hex');
  const entries = GRAMMAR_LESSONS.map(({ id, pos, title, role, examples }) => ({ id, pos, title, role, example: examples[0] }));
  const bytes = JSON.stringify({ sourceSha256, entries }) + '\n', file = 'data/grammar-index.json';
  if (check) assert.equal(readFileSync(file, 'utf8'), bytes, 'Grammar index stale; regenerate with --experimental-strip-types scripts/prepare-grammar-index.mjs');
  else writeFileSync(file, bytes);
  return { entries: entries.length, bytes: Buffer.byteLength(bytes), checked: check };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every(arg => arg === '--check'));
  console.log(JSON.stringify(prepareGrammarIndex(process.argv.includes('--check'))));
}
