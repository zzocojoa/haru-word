import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { issueClosedDayCalibrationFundingV1, readClosedDayCalibrationFundingV1 } from './ai-quality-v147-closed-day-calibration-funding-v1.mjs';

const root = fileURLToPath(new URL('../../../..', import.meta.url));
const tests = resolve(root, 'outputs/ai-quality-v147-implementation-20261106/phase106');
const ledger = '.taskmaster/docs/ai-quality-v147-evaluation-budget-ledger-v3.json';
const mirrors = [resolve(root, ledger), resolve(root, 'work/ai-quality-v147-20261106', ledger)];
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const exec = promisify(execFile);
mkdirSync(tests, { recursive: true });

function isolated() {
  const syntheticDirectory = resolve(tests, 'test-' + randomUUID());
  mkdirSync(syntheticDirectory);
  return { syntheticDirectory };
}

test('The scope reserves only the prepared 72 Standard requests, with no new grant or paid action', () => {
  const before = mirrors.map(digest);
  const target = isolated();
  const created = issueClosedDayCalibrationFundingV1(target);
  const same = readClosedDayCalibrationFundingV1(target);
  assert.deepEqual(same, created);
  const { funding } = created;
  assert.equal(funding.mode, 'synthetic');
  assert.equal(funding.plan.studyPlanHash, '2c96bc43df962814774d6abadeec3c3df748658f69ad4325dbfbd98a391298a8');
  assert.deepEqual([funding.plan.standardModelRequests, funding.plan.countRequests], [72, 72]);
  assert.deepEqual([funding.plan.earmarkMicros, funding.plan.unusedProvisionHeldMicros, funding.plan.independentV3AvailableMicros],
    ['8567184', '7816', '3039780']);
  assert.deepEqual([funding.newGrantCreated, funding.providerDispatchAuthorized, funding.actualProviderCalls], [false, false, 0]);
  assert.throws(() => issueClosedDayCalibrationFundingV1(target), { code: 'EEXIST' });
  assert.equal(digest(created.file), created.sha256);
  assert.deepEqual(mirrors.map(digest), before);
});

test('Corrupt or interrupted issuance is held instead of being overwritten', () => {
  const target = isolated();
  const claim = resolve(target.syntheticDirectory, '20261108-count-provision-rendered-calibration-once.json');
  assert.throws(() => readClosedDayCalibrationFundingV1(target), { code: 'ENOENT' });
  writeFileSync(claim, '{"status":', { flag: 'wx' });
  assert.throws(() => readClosedDayCalibrationFundingV1(target), SyntaxError);
  assert.throws(() => issueClosedDayCalibrationFundingV1(target), { code: 'EEXIST' });
  assert.equal(readFileSync(claim, 'utf8'), '{"status":');
  assert.throws(() => issueClosedDayCalibrationFundingV1({ syntheticDirectory: root }), /CF1_SYNTHETIC_SCOPE/);
});

test('Competing issuers can create only one claim', async () => {
  const target = isolated();
  const fundingModule = pathToFileURL(resolve(root, 'work/ai-quality-v147-20261106/.taskmaster/scripts/ai-quality-v147-closed-day-calibration-funding-v1.mjs')).href;
  const code = `import {issueClosedDayCalibrationFundingV1 as issue} from ${JSON.stringify(fundingModule)};
    try { issue(${JSON.stringify(target)}); console.log('issued'); }
    catch (e) { console.log(e.code === 'EEXIST' ? 'exists' : 'unexpected'); }`;
  const children = await Promise.all([0, 1].map(() => exec(process.execPath, ['--input-type=module', '-e', code], { windowsHide: true, timeout: 30000 })));
  assert.deepEqual(children.map(x => x.stdout.trim()).sort(), ['exists', 'issued']);
  assert.equal(readClosedDayCalibrationFundingV1(target).funding.status, 'earmarked');
});
