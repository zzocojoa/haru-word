import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWordImageUiCatalog, prepareWordImageUi } from '../scripts/prepare-word-image-ui.mjs';

const read = file => readFileSync(file), json = file => JSON.parse(read(file));
const inputs = () => [json('data/word-image-web-manifest.json'), json('data/word-image-hosted-manifest.json'),
  read('data/words.json'), read('data/content.json'), json('data/word-image-pilot-web.json')];

test('the compact client index is reproducible, complete and retains the twenty practiced identities first', () => {
  const args = inputs(), actual = createWordImageUiCatalog(...args);
  assert.equal(actual.entries.length, 3809);
  assert.deepEqual(actual.entries.slice(0, 20).map(e => e[0]), args[4].entries.map(e => e.entryId));
  assert.deepEqual(actual, json('data/word-image-ui.json'));
  assert.ok(read('data/word-image-ui.json').length < 360_000);
  assert.equal(prepareWordImageUi(true).checked, true);
});

test('an edited textbook cannot reinterpret an approved image as a new meaning or part of speech', () => {
  for (const field of ['meaning', 'pos']) {
    const args = inputs(), index = field === 'meaning' ? 3 : 2, data = JSON.parse(args[index]);
    if (field === 'meaning') data[args[0].entries[0].entryId].meaning = '새 뜻';
    else data[0].pos = 'v.';
    args[index] = Buffer.from(JSON.stringify(data));
    assert.throws(() => createWordImageUiCatalog(...args), /Textbook .* changed/);
  }
});

test('changed source provenance, swapped remote URLs and duplicate identities block publication', () => {
  const mutations = [
    args => { args[0].entries[0].sourceFingerprint = '0'.repeat(64); },
    args => { args[1].entries[0].url = args[1].entries[1].url; },
    args => { args[1].entries[0].entryId = args[1].entries[1].entryId; },
    args => { args[4].entries[0].sha256 = '0'.repeat(64); },
  ];
  for (const mutate of mutations) {
    const args = inputs(); mutate(args);
    assert.throws(() => createWordImageUiCatalog(...args));
  }
});
