import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAuthorizedAssessmentBoundaryV1 } from './ai-quality-v147-assessment-boundary-collector-v1.mjs';

function loadExistingKey() {
  const path = fileURLToPath(new URL('../../../../.env.local', import.meta.url));
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || realpathSync(path) !== resolve(path)) throw new Error('ABC1_KEY_PATH');
  const matches = [...readFileSync(path, 'utf8').matchAll(/^OPENAI_API_KEY=([^\r\n]+)$/gm)];
  if (matches.length !== 1) throw new Error('ABC1_KEY');
  const key = matches[0][1].trim().replace(/^("|')(.*)\1$/, '$2');
  if (!/^sk-[A-Za-z0-9_-]+$/.test(key)) throw new Error('ABC1_KEY');
  return key;
}

try {
  if (process.argv.length !== 3 || process.argv[2] !== '--execute-preregistered-assessment-boundaries') throw new Error('ABC1_EXPLICIT_RUN');
  const t = await runAuthorizedAssessmentBoundaryV1({ loadKey: loadExistingKey });
  console.log(JSON.stringify({ status: t.status, failureCode: t.failureCode, counts: t.actualCountApiCalls, models: t.actualProviderCalls,
    usedUpperMicros: t.stageUsedUpperMicros, candidatePasses: t.inspection?.candidatePasses ?? null, improvements: t.inspection?.improvements ?? null,
    regressions: t.inspection?.regressions ?? null, payloadFailures: t.payloadFailures.length }));
  if (t.failureCode) process.exitCode = 2;
} catch (error) {
  console.error(/^(?:ABC1|AB1|TM2|TM1|EB3|W3|PF2|MC1)_[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'ABC1_LOCAL_HELD');
  process.exitCode = 1;
}
