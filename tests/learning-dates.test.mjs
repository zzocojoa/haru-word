import test from 'node:test';
import assert from 'node:assert/strict';
import { today } from '../lib/learning/dates.ts';

test('Korean study dates preserve midnight, year and leap-day boundaries', () => {
  for (const [input, expected] of [
    ['2026-10-15T14:59:59.999Z', '2026-10-15'],
    ['2026-10-15T15:00:00.000Z', '2026-10-16'],
    ['2025-12-31T15:00:00.000Z', '2026-01-01'],
    ['2024-02-28T15:00:00.000Z', '2024-02-29'],
    ['2024-02-29T15:00:00.000Z', '2024-03-01'],
    ['2026-03-08T01:30:00-05:00', '2026-03-08'],
  ]) assert.equal(today(new Date(input)), expected, input);
});

test('reusing date formatting never caches the date value or mutates its input', () => {
  const earlier = new Date('2026-10-15T14:59:59.999Z');
  const later = new Date('2026-10-15T15:00:00.000Z');
  const timestamps = [earlier.getTime(), later.getTime()];
  for (let i = 0; i < 3; i++) {
    assert.equal(today(later), '2026-10-16');
    assert.equal(today(earlier), '2026-10-15');
  }
  assert.deepEqual([earlier.getTime(), later.getTime()], timestamps);
});

test('default study date advances across Korean midnight without reloading the module', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-12-31T14:59:59.999Z') });
  assert.equal(today(), '2026-12-31');
  t.mock.timers.tick(1);
  assert.equal(today(), '2027-01-01');
});

test('invalid dates keep the existing RangeError contract', () => {
  assert.throws(() => today(new Date('invalid date')), RangeError);
  assert.equal(today(new Date('2026-10-15T15:00:00Z')), '2026-10-16');
});
