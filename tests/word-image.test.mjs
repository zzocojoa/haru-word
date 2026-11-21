import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { WORD_IMAGES, resolveWordImage } from '../lib/word-image.ts';
import { resolveWordIpa } from '../lib/american-ipa.ts';
import { imageSourceContent } from '../scripts/prepare-word-image-ui.mjs';

const wordsBytes = readFileSync('data/words.json'), contentBytes = readFileSync('data/content.json');
const words = JSON.parse(wordsBytes), content = JSON.parse(contentBytes);
const revisions = JSON.parse(readFileSync('data/catalog-content-revisions.json'));
const imageContent = imageSourceContent(contentBytes, revisions);
const original = JSON.parse(imageContent);
const wordById = new Map(words.map(w => [w.id, w])), sha = v => createHash('sha256').update(v).digest('hex');

// Artifact integrity check: the generated catalog is verified separately from runtime lookup behavior.
test('all 3809 runtime images match the reviewed textbook and hosted files without generation history', () => {
  const catalog = JSON.parse(readFileSync('data/word-image-web-manifest.json'));
  const hosted = JSON.parse(readFileSync('data/word-image-hosted-manifest.json'));
  const byId = new Map(catalog.entries.map(e => [e.entryId, e]));
  const remote = new Map(hosted.entries.map(e => [e.entryId, e]));
  assert.equal(catalog.dataset.wordsSha256, sha(wordsBytes)); assert.equal(catalog.dataset.contentSha256, sha(imageContent));
  assert.equal(WORD_IMAGES.length, 3809); assert.equal(new Set(WORD_IMAGES.map(e => e.entryId)).size, 3809);
  for (const e of WORD_IMAGES) {
    const word = wordById.get(e.entryId);
    const source = byId.get(e.entryId);
    assert.equal(source.sourceFingerprint, sha(JSON.stringify({ word, content: original[e.entryId] })));
    assert.equal(e.pos, word.pos);
    assert.equal(e.baseMeaning, (revisions[e.entryId]?.imageForPreviousMeaningOnly ? original : content)[e.entryId].meaning);
    assert.equal(e.sha256, source.sha256);
    assert.equal(e.width, source.width); assert.equal(e.height, source.height);
    assert.equal(e.url, '/word-images/v1/' + e.sha256 + '.webp');
    assert.equal(hosted.origin + e.url, remote.get(e.entryId).url);
    assert.equal(resolveWordImage(word, e.baseMeaning), e);
    assert.equal(e.prompt, undefined); assert.equal(e.attempts, undefined);
  }
});

test('revised meanings keep their prior image and pronunciation and skip two mismatched default images', () => {
  const changed = Object.keys(revisions).filter(id => original[id].meaning !== content[id].meaning);
  assert.equal(changed.length, 11);
  assert.deepEqual(changed.filter(id => revisions[id].imageForPreviousMeaningOnly).sort(),
    ['79275bfe73b7b5cd', '8ff89bc3e38fc80c']);
  for (const id of changed) {
    const word = wordById.get(id);
    const previous = resolveWordImage(word, original[id].meaning);
    const current = resolveWordImage(word, content[id].meaning);
    assert.equal(previous?.baseMeaning, original[id].meaning);
    if (revisions[id].imageForPreviousMeaningOnly) assert.equal(current, undefined);
    else assert.equal(current?.sha256, previous.sha256);
    assert.ok(resolveWordIpa(word, original[id].meaning)?.length);
    assert.deepEqual(resolveWordIpa(word, original[id].meaning), resolveWordIpa(word, content[id].meaning));
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
  assert.equal(resolveWordImage({ ...bank, word: 'different' }, '은행'), undefined);
  assert.equal(resolveWordImage({ ...bank, id: 'unsupported' }, '은행'), undefined);
  assert.equal(resolveWordImage(bank, ''), undefined);
});

test('personal additions never receive the default Oxford image', () => {
  const image = WORD_IMAGES[0], word = wordById.get(image.entryId);
  assert.equal(resolveWordImage({ ...word, personal: true }, image.baseMeaning), undefined);
  assert.equal(resolveWordImage({ ...word, id: 'personal_sample', personal: true }, image.baseMeaning), undefined);
});
