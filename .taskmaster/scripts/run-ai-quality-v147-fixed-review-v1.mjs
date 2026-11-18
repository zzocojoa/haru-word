import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { executeAuthorizedFixedReviewsV1 } from './ai-quality-v147-fixed-review-executor-v1.mjs';

function loadKey() {
  const file = resolve(process.cwd(), '.env.local'), stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || realpathSync(file) !== file) throw Error('FRE1_KEY_PATH');
  const values = [...readFileSync(file, 'utf8').matchAll(/^OPENAI_API_KEY=([^\r\n]+)$/gm)];
  if (values.length !== 1) throw Error('FRE1_KEY');
  return values[0][1].trim().replace(/^("|')(.*)\1$/, '$2');
}
try {
  if (process.argv.length !== 4 || process.argv[2] !== '--execute-authorized-review') throw Error('FRE1_EXPLICIT_MODE');
  const r = await executeAuthorizedFixedReviewsV1({ scopeHash: process.argv[3], loadKey,
    onProgress: event => console.log(JSON.stringify(event)) });
  console.log(JSON.stringify({ status: r.status, failureCode: r.failureCode, actualProviderCalls: r.actualProviderCalls,
    actualCountCalls: r.actualCountCalls, independentJudgments: r.independentJudgments, usedUpperMicros: r.combinedUsedUpperMicros }));
  if (r.failureCode) process.exitCode = 2;
} catch (error) {
  console.error(/^FRE1_[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'FRE1_LOCAL_HELD'); process.exitCode = 1;
}
