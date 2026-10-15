import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareOxfordWebImages, validateOxfordSource } from '../scripts/prepare-oxford-web-images.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
async function fixture(t) {
  const sharp = (await import('sharp')).default;
  const tempRoot = realpathSync(tmpdir()), root = mkdtempSync(path.join(tempRoot, 'oxford-web-test-'));
  t.after(() => { assert.equal(path.dirname(realpathSync(root)), tempRoot); rmSync(root, { recursive: true, force: true }); });
  const projectRoot = path.join(root, 'project'), assetRoot = path.join(root, 'originals'), outputRoot = path.join(projectRoot, 'outputs/web/test');
  mkdirSync(path.join(projectRoot, 'data'), { recursive: true }); mkdirSync(assetRoot);
  const words = [0, 1, 2].map((n) => ({ id: (n + 1).toString(16).padStart(16, '0'), word: n === 2 ? 'other' : 'bank', pos: 'n.', level: n === 2 ? 'B2' : 'A1' }));
  const content = Object.fromEntries(words.map((w, n) => [w.id, { meaning: ['은행', '강둑', '다른 뜻'][n] }]));
  const entries = [];
  for (const [n, word] of words.entries()) {
    const width = n === 2 ? 1087 : 1086, height = n === 2 ? 1447 : 1448;
    const png = await sharp({ create: { width, height, channels: 3, background: ['red', 'green', 'blue'][n] } }).png().toBuffer();
    const file = word.id + '-fixture-v1.png'; writeFileSync(path.join(assetRoot, file), png);
    entries.push({ entryId: word.id, word: word.word, pos: word.pos, level: word.level, baseMeaning: content[word.id].meaning,
      sourceFingerprint: sha(JSON.stringify({ word, content: content[word.id] })), file, sha256: sha(png), bytes: png.length,
      width, height, status: 'approved', review: { entryId: word.id, decision: 'approve', textFree: true, styleConsistent: true, meaningMatch: true, smallScreenChecked: true, pngDecoded: true } });
  }
  const wordsBytes = Buffer.from(JSON.stringify(words)), contentBytes = Buffer.from(JSON.stringify(content));
  const manifest = { dataset: { wordsSha256: sha(wordsBytes), contentSha256: sha(contentBytes), sha256: sha(sha(wordsBytes) + ':' + sha(contentBytes)) },
    counts: { total: 3, approved: 3, waiting: 0, generating: 0, generated: 0, held: 0, failed: 0 }, entries };
  const plan = () => ({ ...validateOxfordSource(manifest, wordsBytes, contentBytes), source: { commit: 'fixture', manifestSha256: sha(JSON.stringify(manifest)) } });
  const options = () => ({ projectRoot, outputRoot, assetRoot, plan: plan() });
  return { root, projectRoot, outputRoot, assetRoot, wordsBytes, contentBytes, manifest, plan, options };
}

test('source validation rejects missing IDs, wrong meanings, held images and absent review evidence', async t => {
  const f = await fixture(t);
  for (const mode of ['duplicate', 'meaning', 'held', 'review', 'counts', 'path']) {
    const copy = structuredClone(f.manifest);
    if (mode === 'duplicate') copy.entries[1].entryId = copy.entries[0].entryId;
    if (mode === 'meaning') copy.entries[0].baseMeaning = '다른 뜻';
    if (mode === 'held') copy.entries[0].status = 'held';
    if (mode === 'review') copy.entries[0].review.smallScreenChecked = false;
    if (mode === 'counts') copy.counts.failed = 1;
    if (mode === 'path') copy.entries[0].file = '../outside.png';
    assert.throws(() => validateOxfordSource(copy, f.wordsBytes, f.contentBytes), undefined, mode);
  }
  assert.throws(() => validateOxfordSource(f.manifest, Buffer.from('[]'), f.contentBytes), /fingerprint/);
});

test('only the three approved subject-letter exceptions pass and retain their approval', async t => {
  const f = await fixture(t), manifest = structuredClone(f.manifest);
  manifest.generation = { remainingApproval: { approvalId: 'approval', textExceptionEntryIds: [manifest.entries[0].entryId] } };
  manifest.entries[0].textPolicyException = { approvalId: 'approval' };
  Object.assign(manifest.entries[0].review, { textFree: false, textPolicyExceptionVerified: true, nonAuthorizedTextAbsent: true, textExceptionApprovalId: 'approval' });
  assert.throws(() => validateOxfordSource(manifest, f.wordsBytes, f.contentBytes), /Invalid letter exception/);
  const words = JSON.parse(f.wordsBytes), content = JSON.parse(f.contentBytes), oldId = words[0].id, id = 'd056f2650b116cba';
  words[0] = { ...words[0], id, word: 'capital', pos: 'adj.' }; content[id] = content[oldId]; delete content[oldId];
  const wb = Buffer.from(JSON.stringify(words)), cb = Buffer.from(JSON.stringify(content));
  manifest.dataset = { wordsSha256: sha(wb), contentSha256: sha(cb), sha256: sha(sha(wb) + ':' + sha(cb)) };
  Object.assign(manifest.entries[0], { entryId: id, word: 'capital', pos: 'adj.', file: id + '-fixture-v1.png', sourceFingerprint: sha(JSON.stringify({ word: words[0], content: content[id] })) });
  manifest.entries[0].review.entryId = id; manifest.generation.remainingApproval.textExceptionEntryIds = [id];
  assert.deepEqual(validateOxfordSource(manifest, wb, cb).entries[0].textPolicy, { textFree: false, allowedSubjectLettersOnly: true, approvalId: 'approval' });
});

test('conversion preserves two bank meanings and aspect ratios, decodes every file and verifies without re-encoding', async t => {
  const f = await fixture(t), result = await prepareOxfordWebImages(f.options());
  assert.equal(result.count, 3); assert.equal(result.converted, 3); assert.equal(result.reused, 0);
  const file = path.join(f.projectRoot, 'data/word-image-web-manifest.json'), before = readFileSync(file), catalog = JSON.parse(before);
  assert.deepEqual(catalog.entries.map(e => e.baseMeaning), ['은행', '강둑', '다른 뜻']);
  assert.deepEqual(catalog.entries.map(e => [e.width, e.height]), [[640, 853], [640, 853], [640, 852]]);
  assert.equal(new Set(catalog.entries.map(e => e.objectKey)).size, 3);
  const uploads = JSON.parse(readFileSync(path.join(f.outputRoot, 'upload-manifest.json')));
  assert.equal(uploads.catalogSha256, sha(before));
  for (const entry of uploads.files) {
    assert.match(entry.file, /^assets\/[a-f0-9]{64}\.webp$/);
    assert.match(entry.objectKey, /^oxford-images\/v1\/[a-f0-9]{64}\.webp$/);
    assert.equal(entry.contentType, 'image/webp');
    assert.equal(sha(readFileSync(path.join(f.outputRoot, entry.file))), entry.sha256);
  }
  const again = await prepareOxfordWebImages({ ...f.options(), verify: true });
  assert.equal(again.converted, 0); assert.equal(again.reused, 3);
  assert.deepEqual(readFileSync(file), before);
  assert.notEqual(again.reportFile, result.reportFile);
});

test('altered originals fail without publishing a final catalog or changing source bytes', async t => {
  const f = await fixture(t), originalFile = path.join(f.assetRoot, f.manifest.entries[0].file), bad = Buffer.from('keep this changed original');
  writeFileSync(originalFile, bad);
  await assert.rejects(prepareOxfordWebImages(f.options()), /Original hash or bytes mismatch/);
  assert.deepEqual(readFileSync(originalFile), bad);
  assert.equal(existsSync(path.join(f.outputRoot, 'catalog.json')), false);
  assert.equal(existsSync(path.join(f.projectRoot, 'data/word-image-web-manifest.json')), false);
  assert.equal(existsSync(path.join(f.outputRoot, '.prepare.lock')), false);
});

test('a corrupt existing WebP is rejected rather than overwritten on resume', async t => {
  const f = await fixture(t); await prepareOxfordWebImages(f.options());
  const catalogFile = path.join(f.outputRoot, 'catalog.json'), catalogBytes = readFileSync(catalogFile), catalog = JSON.parse(catalogBytes);
  const image = path.join(f.outputRoot, 'assets', catalog.entries[0].sha256 + '.webp'), bad = Buffer.from('keep existing web bytes');
  writeFileSync(image, bad);
  await assert.rejects(prepareOxfordWebImages(f.options()), /Existing web image differs/);
  assert.deepEqual(readFileSync(image), bad); assert.deepEqual(readFileSync(catalogFile), catalogBytes);
});

test('interrupted processing preserves receipts and resumes to a complete identical catalog', async t => {
  const f = await fixture(t), controller = new AbortController();
  await assert.rejects(prepareOxfordWebImages({ ...f.options(), signal: controller.signal,
    onProgress: () => controller.abort(Error('test interruption')) }), /test interruption/);
  assert.equal(existsSync(path.join(f.outputRoot, 'catalog.json')), false);
  const result = await prepareOxfordWebImages(f.options());
  assert.equal(result.count, 3); assert.ok(result.reused > 0 && result.reused < 3);
  assert.equal(result.converted + result.reused, 3);
});

test('final catalog conflicts and missing verify inputs never silently replace or regenerate metadata', async t => {
  const f = await fixture(t), target = path.join(f.projectRoot, 'data/word-image-web-manifest.json');
  writeFileSync(target, '{"preserve":true}\n');
  await assert.rejects(prepareOxfordWebImages(f.options()), /Existing deployment catalog differs/);
  assert.equal(readFileSync(target, 'utf8'), '{"preserve":true}\n');
  assert.equal(existsSync(path.join(f.outputRoot, 'catalog.json')), false);
  const other = await fixture(t);
  await assert.rejects(prepareOxfordWebImages({ ...other.options(), verify: true }), /Missing prepared receipt/);
  assert.equal(existsSync(path.join(other.projectRoot, 'data/word-image-web-manifest.json')), false);
});

test('a live preparation lock and an output outside project outputs are rejected', async t => {
  const f = await fixture(t);
  mkdirSync(f.outputRoot, { recursive: true });
  const lock = path.join(f.outputRoot, '.prepare.lock'), bytes = Buffer.from(JSON.stringify({ pid: process.pid, runId: 'other-run' }));
  writeFileSync(lock, bytes);
  await assert.rejects(prepareOxfordWebImages(f.options()), /already running/);
  assert.deepEqual(readFileSync(lock), bytes);
  await assert.rejects(prepareOxfordWebImages({ ...f.options(), outputRoot: f.assetRoot }), /inside outputs/);
});
