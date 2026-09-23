import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsActivity, SETTINGS_ACTIVITY_TEXT } from '../lib/learning-notices.ts';

test('settings activity preserves precedence for every overlapping status combination', () => {
  for (let mask = 0; mask < 32; mask++) {
    const status = { loading: !!(mask & 1), saving: !!(mask & 2), signedIn: !!(mask & 4), unsaved: !!(mask & 8), error: mask & 16 ? 'failed' : '' };
    const before = structuredClone(status);
    const expected = status.loading ? 'loading' : status.saving ? 'saving' : !status.signedIn ? 'signed-out' : status.unsaved && !status.error ? 'unsaved' : null;
    assert.equal(settingsActivity('settings', status), expected);
    assert.equal(settingsActivity('page', status), null);
    if (expected) assert.ok(SETTINGS_ACTIVITY_TEXT[expected]);
    assert.deepEqual(status, before);
  }
});
