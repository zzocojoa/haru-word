import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const compiled = await build({ entryPoints: ['lib/grammar/review.ts'], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const compiledReview = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
export async function checkGrammarReview() {
  if (!await compiledReview.grammarV4Reviewed()) throw Error('Grammar v4 review is incomplete or stale. New content requires source comparison and a new review ledger.');
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await checkGrammarReview();
  console.log('Grammar v4 source comparison and content hashes verified.');
}
