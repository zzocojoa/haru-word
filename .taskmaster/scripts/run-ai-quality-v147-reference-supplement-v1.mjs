import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAuthorizedReferenceSupplementV1 } from './ai-quality-v147-reference-supplement-collector-v1.mjs';

function loadExistingKey() {
  const path = fileURLToPath(new URL('../../../../.env.local', import.meta.url));
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || realpathSync(path) !== resolve(path)) throw new Error('RSC1_KEY_PATH');
  const matches = [...readFileSync(path, 'utf8').matchAll(/^OPENAI_API_KEY=([^\r\n]+)$/gm)];
  if (matches.length !== 1) throw new Error('RSC1_KEY');
  const key = matches[0][1].trim().replace(/^("|')(.*)\1$/, '$2');
  if (!/^sk-[A-Za-z0-9_-]+$/.test(key)) throw new Error('RSC1_KEY');
  return key;
}

try {
  if (process.argv.length !== 3 || process.argv[2] !== '--execute-preregistered-reference-supplement') throw new Error('RSC1_EXPLICIT_RUN');
  const t = await runAuthorizedReferenceSupplementV1({ loadKey: loadExistingKey });
  console.log(JSON.stringify({ status: t.status, failureCode: t.failureCode, countCalls: t.actualCountApiCalls, modelCalls: t.actualProviderCalls,
    usedUpperMicros: t.stageUsedUpperMicros, supportedCases: t.inspection?.supportedCases ?? [] }));
  if (t.failureCode) process.exitCode = 2;
} catch (error) {
  console.error(/^(?:RSC1|RS1|EB3|W3|PF2)_[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'RSC1_LOCAL_HELD');
  process.exitCode = 1;
}
