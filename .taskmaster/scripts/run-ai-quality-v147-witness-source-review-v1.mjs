import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAuthorizedWitnessSourceReviewV1 } from './ai-quality-v147-witness-source-collector-v1.mjs';

function loadExistingKey() {
  const path = fileURLToPath(new URL('../../../../.env.local', import.meta.url));
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || realpathSync(path) !== resolve(path)) throw new Error('WSC1_KEY_PATH');
  const matches = [...readFileSync(path, 'utf8').matchAll(/^OPENAI_API_KEY=([^\r\n]+)$/gm)];
  if (matches.length !== 1) throw new Error('WSC1_KEY');
  const key = matches[0][1].trim().replace(/^("|')(.*)\1$/, '$2');
  if (!/^sk-[A-Za-z0-9_-]+$/.test(key)) throw new Error('WSC1_KEY');
  return key;
}

try {
  if (process.argv.length !== 3 || process.argv[2] !== '--execute-preregistered-source-review') throw new Error('WSC1_EXPLICIT_RUN');
  const result = await runAuthorizedWitnessSourceReviewV1({ loadKey: loadExistingKey });
  console.log(JSON.stringify({ status: result.status, failureCode: result.failureCode,
    countCalls: result.actualCountApiCalls, modelCalls: result.actualProviderCalls,
    usedUpperMicros: result.stageUsedUpperMicros, supportedCases: result.inspection?.passedAcrossJudges ?? null }));
  if (result.failureCode) process.exitCode = 2;
} catch (error) {
  console.error(/^(?:WSC1|WSR1|EB3|W3|PF2)_[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'WSC1_LOCAL_HELD');
  process.exitCode = 1;
}
