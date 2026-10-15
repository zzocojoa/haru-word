import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sha = value => createHash('sha256').update(value).digest('hex');
const wordsBytes = readFileSync('data/words.json'), contentBytes = readFileSync('data/content.json');
const words = JSON.parse(wordsBytes), content = JSON.parse(contentBytes);

test('the deployment metadata covers every Oxford identity and retains its reviewed meaning and part of speech', () => {
  const catalog = JSON.parse(readFileSync('data/word-image-web-manifest.json'));
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.source.commit, '228f8ba9e1594cbcb6286b24559100923eb68f6f');
  assert.equal(catalog.source.manifestSha256, '6fb25a00648949bbb776f71bd876bf11ec3fcacd2d73645d2e23677c8d13c97c');
  assert.equal(catalog.dataset.wordsSha256, sha(wordsBytes)); assert.equal(catalog.dataset.contentSha256, sha(contentBytes));
  assert.equal(catalog.entries.length, 3809);
  assert.deepEqual(catalog.entries.map(e => e.entryId), words.map(w => w.id));
  assert.equal(new Set(catalog.entries.map(e => e.sha256)).size, 3809);
  for (const [index, e] of catalog.entries.entries()) {
    const word = words[index];
    assert.equal(e.word, word.word); assert.equal(e.pos, word.pos); assert.equal(e.level, word.level);
    assert.equal(e.baseMeaning, content[word.id].meaning);
    assert.equal(e.sourceFingerprint, sha(JSON.stringify({ word, content: content[word.id] })));
    assert.match(e.sourceSha256, /^[a-f0-9]{64}$/); assert.match(e.sha256, /^[a-f0-9]{64}$/);
    assert.equal(e.objectKey, 'oxford-images/v1/' + e.sha256 + '.webp'); assert.equal(e.contentType, 'image/webp');
    assert.equal(e.width, 640); assert.equal(e.height, Math.round(e.sourceHeight * 640 / e.sourceWidth));
    assert.ok(e.bytes > 0 && e.bytes <= 200_000);
    for (const forbidden of ['prompt', 'attempts', 'review', 'sourceFile', 'url']) assert.equal(e[forbidden], undefined);
  }
});

test('full metadata preserves every shipped pilot image byte identity and the three explicit letter exceptions', () => {
  const catalog = JSON.parse(readFileSync('data/word-image-web-manifest.json'));
  const byId = new Map(catalog.entries.map(e => [e.entryId, e]));
  const pilot = JSON.parse(readFileSync('data/word-image-pilot-web.json'));
  for (const entry of pilot.entries) {
    const e = byId.get(entry.entryId);
    for (const field of ['sha256', 'sourceSha256', 'sourceFingerprint', 'baseMeaning', 'pos', 'width', 'height', 'bytes']) assert.equal(e[field], entry[field], entry.entryId + ':' + field);
  }
  const exceptions = catalog.entries.filter(e => !e.textPolicy.textFree);
  assert.deepEqual(exceptions.map(e => e.entryId).sort(), ['d056f2650b116cba', '49717992a5fb1a1a', '8e5aef6a2138e99b'].sort());
  for (const e of exceptions) {
    assert.equal(e.textPolicy.allowedSubjectLettersOnly, true);
    assert.equal(e.textPolicy.approvalId, 'c57e8ae4-175e-49f9-be9b-cfd66bbe72c5');
  }
});
