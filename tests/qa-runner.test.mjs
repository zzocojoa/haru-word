import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('browser suite enumerates image resume and request concurrency separately from performance', () => {
  const lists = {};
  for (const group of ['functional', 'performance']) {
    const result = spawnSync(process.execPath, ['tests/qa/run.cjs', group, '--list'], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    lists[group] = result.stdout.trim().split(/\r?\n/);
    assert.equal(new Set(lists[group]).size, lists[group].length);
  }
  assert.ok(lists.functional.includes('image-practice-resume-qa.cjs'));
  assert.ok(lists.functional.includes('request-concurrency-qa.cjs'));
  assert.ok(lists.performance.includes('image-practice-performance-qa.cjs'));
  assert.ok(!lists.functional.some(name => lists.performance.includes(name)));
});
