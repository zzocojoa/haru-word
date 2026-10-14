import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { WORD_IMAGES, resolveWordImage } from '../lib/word-image.ts';

const wordsBytes = readFileSync('data/words.json'), contentBytes = readFileSync('data/content.json');
const words = JSON.parse(wordsBytes), content = JSON.parse(contentBytes);
const wordById = new Map(words.map(w => [w.id, w])), sha = v => createHash('sha256').update(v).digest('hex');

// Artifact integrity check: the generated catalog is verified separately from runtime lookup behavior.
test('the small pilot catalog matches the current textbook and excludes generation history', () => {
  const catalog = JSON.parse(readFileSync('data/word-image-pilot.json'));
  assert.equal(catalog.dataset.wordsSha256, sha(wordsBytes)); assert.equal(catalog.dataset.contentSha256, sha(contentBytes));
  assert.equal(WORD_IMAGES.length, 20); assert.equal(new Set(WORD_IMAGES.map(e => e.entryId)).size, 20);
  for (const e of WORD_IMAGES) {
    const word = wordById.get(e.entryId);
    assert.equal(e.sourceFingerprint, sha(JSON.stringify({ word, content: content[e.entryId] })));
    assert.equal(e.pos, word.pos); assert.equal(e.baseMeaning, content[e.entryId].meaning);
    assert.equal(e.url, '/oxford-image-pilot/' + e.sha256 + '.png');
    assert.equal(e.prompt, undefined); assert.equal(e.attempts, undefined);
  }
});

test('same-spelling bank images match only their own ID part of speech and meaning', () => {
  const money = WORD_IMAGES.find(e => e.baseMeaning === '은행'), river = WORD_IMAGES.find(e => e.baseMeaning === '강둑');
  const bank = Object.freeze(wordById.get(money.entryId)), riverBank = Object.freeze(wordById.get(river.entryId));
  assert.equal(bank.word, riverBank.word);
  assert.equal(resolveWordImage(bank, '은행')?.url, money.url);
  assert.equal(resolveWordImage(riverBank, '강둑')?.url, river.url);
  assert.equal(resolveWordImage(bank, '강둑'), undefined);
  assert.equal(resolveWordImage(riverBank, '은행'), undefined);
  assert.equal(resolveWordImage({ ...bank, pos: 'v.' }, '은행'), undefined);
  assert.equal(resolveWordImage({ ...bank, id: 'unsupported' }, '은행'), undefined);
  assert.equal(resolveWordImage(bank, ''), undefined);
});
