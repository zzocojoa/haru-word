import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const APPROVED_SOURCE_COMMIT = '228f8ba9e1594cbcb6286b24559100923eb68f6f';
export const WEB_RECIPE = Object.freeze({ version: 1, width: 640, format: 'webp', quality: 82, effort: 6, withoutEnlargement: true });
const EXCEPTIONS = new Set(['d056f2650b116cba', '49717992a5fb1a1a', '8e5aef6a2138e99b']);
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (code, id = '') => { throw Error(code + (id ? ': ' + id : '')); };

// Reusable metadata validation; the CLI additionally pins the source Git commit.
export function validateOxfordSource(manifest, wordsBytes, contentBytes) {
  const words = JSON.parse(wordsBytes), content = JSON.parse(contentBytes);
  if (manifest.dataset?.wordsSha256 !== sha(wordsBytes) || manifest.dataset?.contentSha256 !== sha(contentBytes) ||
    manifest.dataset.sha256 !== sha(sha(wordsBytes) + ':' + sha(contentBytes))) fail('Textbook fingerprint mismatch');
  if (!words.length || manifest.entries?.length !== words.length || new Set(words.map(w => w.id)).size !== words.length ||
    new Set(manifest.entries.map(e => e.entryId)).size !== words.length) fail('Incomplete or duplicate source identities');
  if (manifest.counts?.total !== words.length || manifest.counts?.approved !== words.length ||
    ['waiting', 'generating', 'generated', 'held', 'failed'].some(key => manifest.counts[key] !== 0)) fail('Approval counts mismatch');
  const byId = new Map(manifest.entries.map(e => [e.entryId, e]));
  const entries = words.map(word => {
    const entry = byId.get(word.id), material = content[word.id];
    if (!entry || !material || !/^[a-f0-9]{16}$/.test(word.id) || entry.word !== word.word || entry.pos !== word.pos ||
      entry.level !== word.level || entry.baseMeaning !== material.meaning ||
      entry.sourceFingerprint !== sha(JSON.stringify({ word, content: material }))) fail('Source identity mismatch', word.id);
    const review = entry.review;
    if (entry.status !== 'approved' || entry.policyHold || review?.entryId !== word.id || review.decision !== 'approve' ||
      !['styleConsistent', 'meaningMatch', 'smallScreenChecked', 'pngDecoded'].every(key => review[key] === true)) fail('Unapproved source', word.id);
    let textPolicy = { textFree: true };
    if (entry.textPolicyException) {
      const approval = manifest.generation?.remainingApproval;
      if (!EXCEPTIONS.has(word.id) || entry.textPolicyException.approvalId !== approval?.approvalId ||
        !approval.textExceptionEntryIds?.includes(word.id) || review.textFree !== false ||
        review.textPolicyExceptionVerified !== true || review.nonAuthorizedTextAbsent !== true ||
        review.textExceptionApprovalId !== approval.approvalId) fail('Invalid letter exception', word.id);
      textPolicy = { textFree: false, allowedSubjectLettersOnly: true, approvalId: approval.approvalId };
    } else if (review.textFree !== true) fail('Missing text-free review', word.id);
    if (typeof entry.file !== 'string' || !entry.file.startsWith(word.id + '-') ||
      !/^[a-f0-9]{16}-[a-z0-9-]+-v[1-9][0-9]*\.png$/.test(entry.file) || !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      ![entry.width, entry.height, entry.bytes].every(n => Number.isSafeInteger(n) && n > 0) ||
      entry.width * entry.height > 16_000_000) fail('Invalid source file metadata', word.id);
    return { entryId: word.id, word: word.word, pos: word.pos, level: word.level, baseMeaning: material.meaning,
      sourceFingerprint: entry.sourceFingerprint, sourceSha256: entry.sha256, sourceFile: entry.file,
      sourceWidth: entry.width, sourceHeight: entry.height, sourceBytes: entry.bytes, textPolicy };
  });
  if (new Set(entries.map(e => e.sourceSha256)).size !== entries.length) fail('Duplicate source image hashes');
  return { dataset: manifest.dataset, entries };
}

function git(root, ...args) { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function sourceSnapshot(sourceRoot, projectRoot) {
  if (git(sourceRoot, 'rev-parse', 'HEAD') !== APPROVED_SOURCE_COMMIT) fail('Expected approved image source commit 228f8ba');
  git(sourceRoot, 'diff', '--quiet', 'HEAD', '--', 'data/words.json', 'data/content.json', 'data/word-image-manifest.json');
  const manifestBytes = readFileSync(path.join(sourceRoot, 'data/word-image-manifest.json'));
  const words = readFileSync(path.join(projectRoot, 'data/words.json')), content = readFileSync(path.join(projectRoot, 'data/content.json'));
  for (const [name, bytes] of [['words', words], ['content', content]]) {
    if (sha(readFileSync(path.join(sourceRoot, 'data', name + '.json'))) !== sha(bytes)) fail('Source and app textbook differ');
  }
  const manifest = JSON.parse(manifestBytes), validated = validateOxfordSource(manifest, words, content);
  if (validated.entries.length !== 3809) fail('Expected all 3809 Oxford entries');
  return { ...validated, assetRoot: manifest.assetRoot, source: { commit: APPROVED_SOURCE_COMMIT, manifestSha256: sha(manifestBytes) } };
}

function regularFile(filename) { if (!lstatSync(filename).isFile()) fail('Expected a regular file'); return readFileSync(filename); }
function inside(root, filename) {
  const relative = path.relative(root, filename);
  if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) fail('Output must stay inside outputs');
}
function safeOutput(projectRoot, outputRoot) {
  inside(path.resolve(projectRoot, 'outputs'), outputRoot);
  let current = outputRoot;
  while (current !== path.dirname(current)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) fail('Output paths cannot contain symbolic links');
    if (current === path.resolve(projectRoot)) break;
    current = path.dirname(current);
  }
}
function noLinks(filename) {
  let current = path.resolve(filename);
  while (current !== path.dirname(current)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) fail('Output paths cannot contain symbolic links');
    current = path.dirname(current);
  }
}

// Atomic, create-only publication. A concurrent or altered existing file is never overwritten.
function writeOnce(filename, bytes) {
  noLinks(filename);
  if (existsSync(filename)) { if (!regularFile(filename).equals(bytes)) fail('Existing output differs'); return false; }
  mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = filename + '.tmp-' + randomUUID();
  let fd;
  try {
    fd = openSync(temporary, 'wx'); writeFileSync(fd, bytes); fsyncSync(fd); closeSync(fd); fd = undefined;
    try { linkSync(temporary, filename); }
    catch (error) { if (error.code !== 'EEXIST' || !regularFile(filename).equals(bytes)) throw error; }
  } finally { if (fd !== undefined) closeSync(fd); if (existsSync(temporary)) unlinkSync(temporary); }
  return true;
}
function acquireLock(root) {
  mkdirSync(root, { recursive: true });
  const filename = path.join(root, '.prepare.lock'), bytes = json({ pid: process.pid, runId: randomUUID() });
  if (existsSync(filename)) {
    const previous = regularFile(filename), lock = JSON.parse(previous);
    if (!Number.isSafeInteger(lock.pid) || lock.pid <= 0) fail('Invalid preparation lock');
    try { process.kill(lock.pid, 0); fail('Preparation is already running'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    if (!regularFile(filename).equals(previous)) fail('Preparation lock changed');
    unlinkSync(filename);
  }
  const fd = openSync(filename, 'wx'); writeFileSync(fd, bytes); fsyncSync(fd); closeSync(fd);
  return () => { if (existsSync(filename) && regularFile(filename).equals(bytes)) unlinkSync(filename); };
}

function receiptMetadata(entry, result) {
  const keys = ['entryId', 'word', 'pos', 'level', 'baseMeaning', 'sourceFingerprint', 'sourceSha256', 'sourceWidth', 'sourceHeight', 'sourceBytes', 'textPolicy'];
  for (const key of keys) if (!same(entry[key], result[key])) fail('Receipt identity mismatch', entry.entryId);
  const width = Math.min(WEB_RECIPE.width, entry.sourceWidth), height = Math.round(entry.sourceHeight * width / entry.sourceWidth);
  if (!/^[a-f0-9]{64}$/.test(result.sha256) || result.width !== width || result.height !== height ||
    !Number.isSafeInteger(result.bytes) || result.bytes <= 0 || result.bytes > 200_000 ||
    result.objectKey !== 'oxford-images/v1/' + result.sha256 + '.webp' || result.contentType !== 'image/webp') fail('Invalid web receipt', entry.entryId);
}
async function decode(sharp, bytes, width, height, format) {
  if (format === 'png' && (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height)) fail('Invalid PNG header');
  if (format === 'webp' && (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP')) fail('Invalid WebP header');
  const { data, info } = await sharp(bytes, { failOn: 'warning', limitInputPixels: 16_000_000 }).raw({ depth: 'uchar' }).toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height || data.length !== width * height * info.channels) fail('Decoded dimensions differ');
}

export async function prepareOxfordWebImages({ plan, assetRoot, outputRoot, projectRoot, verify = false, signal, onProgress = () => {} }) {
  outputRoot = path.resolve(outputRoot); safeOutput(projectRoot, outputRoot);
  const sharp = (await import('sharp')).default;
  sharp.cache(false); sharp.concurrency(1);
  const job = { schemaVersion: 1, dataset: plan.dataset, source: plan.source, recipe: WEB_RECIPE,
    encoder: { sharp: sharp.versions.sharp, vips: sharp.versions.vips, platform: process.platform, arch: process.arch } };
  const release = acquireLock(outputRoot), started = new Date().toISOString(), entries = new Array(plan.entries.length);
  let index = 0, completed = 0, converted = 0, reused = 0, stopped;
  try {
    writeOnce(path.join(outputRoot, 'job.json'), json(job));
    const canonicalAssetRoot = realpathSync(assetRoot);
    async function worker() {
      while (!stopped && index < plan.entries.length) {
        if (signal?.aborted) throw signal.reason || Error('Preparation interrupted');
        const i = index++, entry = plan.entries[i];
        try {
          const sourceFile = path.join(assetRoot, entry.sourceFile);
          inside(canonicalAssetRoot, realpathSync(sourceFile));
          const original = regularFile(sourceFile);
          if (sha(original) !== entry.sourceSha256 || original.length !== entry.sourceBytes) fail('Original hash or bytes mismatch', entry.entryId);
          await decode(sharp, original, entry.sourceWidth, entry.sourceHeight, 'png');
          const receiptFile = path.join(outputRoot, 'receipts', entry.entryId + '.json');
          let result;
          if (existsSync(receiptFile)) {
            result = JSON.parse(regularFile(receiptFile)); receiptMetadata(entry, result);
            const file = path.join(outputRoot, 'assets', result.sha256 + '.webp'), bytes = regularFile(file);
            if (sha(bytes) !== result.sha256 || bytes.length !== result.bytes) fail('Existing web image differs', entry.entryId);
            await decode(sharp, bytes, result.width, result.height, 'webp'); reused++;
          } else {
            if (verify) fail('Missing prepared receipt', entry.entryId);
            const { data, info } = await sharp(original, { failOn: 'warning', limitInputPixels: 16_000_000 })
              .resize({ width: WEB_RECIPE.width, withoutEnlargement: true })
              .webp({ quality: WEB_RECIPE.quality, effort: WEB_RECIPE.effort }).toBuffer({ resolveWithObject: true });
            const { sourceFile: omittedSourceFile, ...identity } = entry;
            void omittedSourceFile;
            const hash = sha(data);
            result = { ...identity, sha256: hash, width: info.width, height: info.height, bytes: data.length,
              objectKey: 'oxford-images/v1/' + hash + '.webp', contentType: 'image/webp' };
            receiptMetadata(entry, result); await decode(sharp, data, info.width, info.height, 'webp');
            writeOnce(path.join(outputRoot, 'assets', hash + '.webp'), data);
            writeOnce(receiptFile, json(result)); converted++;
          }
          entries[i] = result; completed++;
          onProgress({ completed, total: plan.entries.length, converted, reused });
        } catch (error) { stopped = error; throw error; }
      }
    }
    const results = await Promise.allSettled([worker(), worker()]);
    const rejected = results.find(result => result.status === 'rejected');
    if (rejected) throw rejected.reason;
    if (signal?.aborted) throw signal.reason || Error('Preparation interrupted');
    if (entries.some(e => !e) || completed !== plan.entries.length) fail('Incomplete prepared images');
    if (new Set(entries.map(e => e.sha256)).size !== entries.length) fail('Duplicate converted image hashes');
    const assets = readdirSync(path.join(outputRoot, 'assets')).filter(name => name.endsWith('.webp')).sort();
    if (!same(assets, entries.map(e => e.sha256 + '.webp').sort())) fail('Unexpected prepared assets');
    const catalog = { ...job, entries };
    const uploads = { schemaVersion: 1, catalogSha256: sha(json(catalog)), files: entries.map(e => ({ entryId: e.entryId,
      file: 'assets/' + e.sha256 + '.webp', objectKey: e.objectKey, sha256: e.sha256, bytes: e.bytes,
      contentType: e.contentType, cacheControl: 'public, max-age=31536000, immutable' })) };
    if (plan.assertUnchanged) plan.assertUnchanged();
    // Final catalogs are published only after every source and encoded file passes.
    const finalFiles = [[path.join(outputRoot, 'catalog.json'), catalog], [path.join(outputRoot, 'upload-manifest.json'), uploads],
      [path.join(projectRoot, 'data/word-image-web-manifest.json'), catalog]];
    for (const [filename, value] of finalFiles) {
      if (existsSync(filename)) { if (!same(JSON.parse(regularFile(filename)), value)) fail('Existing deployment catalog differs'); }
      else if (verify) fail('Missing deployment catalog');
    }
    for (const [filename, value] of finalFiles) if (!existsSync(filename)) writeOnce(filename, json(value));
    const originalBytes = entries.reduce((sum, e) => sum + e.sourceBytes, 0), webBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
    const report = { passed: true, started, finished: new Date().toISOString(), source: plan.source, recipe: WEB_RECIPE, encoder: job.encoder,
      count: entries.length, converted, reused, originalBytes, webBytes, maxWebBytes: Math.max(...entries.map(e => e.bytes)),
      levels: Object.fromEntries(['A1', 'A2', 'B1', 'B2'].map(level => [level, entries.filter(e => e.level === level).length])),
      sourcePixelDecodes: completed, webPixelDecodes: completed, textExceptions: entries.filter(e => !e.textPolicy.textFree).map(e => e.entryId),
      uniqueSourceImages: new Set(entries.map(e => e.sourceSha256)).size, uniqueWebImages: new Set(entries.map(e => e.sha256)).size,
      catalogSha256: sha(json(catalog)), uploadManifestSha256: sha(json(uploads)), hosted: false, generatedWithAI: 0 };
    const reportFile = path.join(outputRoot, 'reports', randomUUID() + '.json');
    writeOnce(reportFile, json(report));
    return { ...report, outputRoot, reportFile };
  } finally { release(); }
}

async function main() {
  const { values } = parseArgs({ options: { source: { type: 'string' }, assets: { type: 'string' }, output: { type: 'string' }, verify: { type: 'boolean' } } });
  const projectRoot = process.cwd(), sourceRoot = path.resolve(values.source || path.join(homedir(), '.codex/worktrees/oxford-word-images/하루단어'));
  const plan = sourceSnapshot(sourceRoot, projectRoot);
  const snapshot = json({ dataset: plan.dataset, source: plan.source });
  plan.assertUnchanged = () => {
    const current = sourceSnapshot(sourceRoot, projectRoot);
    if (!snapshot.equals(json({ dataset: current.dataset, source: current.source }))) fail('Source changed during preparation');
  };
  const assetRoot = path.resolve(values.assets || path.join(homedir(), 'Documents/ChatGPT/하루단어', plan.assetRoot));
  const outputRoot = path.resolve(values.output || path.join(projectRoot, 'outputs/oxford-web', plan.dataset.sha256, 'webp-640-q82-v1'));
  const controller = new AbortController();
  const stop = () => controller.abort(Error('Preparation interrupted; verified receipts can be resumed'));
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    console.log(JSON.stringify({ phase: 'validated-metadata', count: plan.entries.length, sourceCommit: plan.source.commit, outputRoot }));
    const result = await prepareOxfordWebImages({ plan, assetRoot, outputRoot, projectRoot, verify: !!values.verify, signal: controller.signal,
      onProgress: progress => { if (progress.completed % 25 === 0 || progress.completed === progress.total) console.log(JSON.stringify({ phase: values.verify ? 'verify' : 'convert', ...progress })); } });
    console.log(JSON.stringify(result));
  } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
