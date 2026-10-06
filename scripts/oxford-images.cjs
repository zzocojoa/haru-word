// Local production bookkeeping only. Image calls remain in the built-in image_gen tool.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '..');
const file = path.join(repo, 'data/word-image-manifest.json');
const progressFile = path.join(repo, 'work/oxford-images-progress.json');
const journalFile = path.join(repo, 'work/oxford-images-pending.json');
const assetWorkspace = process.env.OXFORD_ASSET_WORKSPACE || 'C:/Users/user/Documents/ChatGPT/하루단어';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const serializeManifest = value => {
  const { entries, ...header } = value;
  // One entry per line keeps large inventories compact and changed entries reviewable.
  return JSON.stringify(header, null, 2).slice(0, -2) + ',\n  "entries": [\n' +
    entries.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ]\n}\n';
};
const writeAtomic = (target, value) => {
  const temporary = target + '.tmp';
  fs.writeFileSync(temporary, target === file ? serializeManifest(value) : JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temporary, target);
};
fs.mkdirSync(path.join(repo, 'work'), { recursive: true });
// Replay a recorded metadata transaction after an interrupted file write, never an image call.
if (fs.existsSync(journalFile)) {
  const pending = JSON.parse(fs.readFileSync(journalFile));
  writeAtomic(file, pending.manifest);
  writeAtomic(progressFile, pending.progress);
  fs.unlinkSync(journalFile);
}
const m = JSON.parse(fs.readFileSync(file));
const wordsBytes = fs.readFileSync(path.join(repo, 'data/words.json'));
const contentBytes = fs.readFileSync(path.join(repo, 'data/content.json'));
assert.equal(sha(wordsBytes), m.dataset.wordsSha256, 'Word dataset changed');
assert.equal(sha(contentBytes), m.dataset.contentSha256, 'Content dataset changed');
const words = JSON.parse(wordsBytes), content = JSON.parse(contentBytes);
assert.equal(m.entries.length, 3809);
assert.equal(new Set(m.entries.map(e => e.entryId)).size, 3809);
const unresolved = m.entries.filter(e => e.status === 'generating');
assert(unresolved.length <= 1, 'Resolve inconsistent concurrent image calls manually');
const slotCount = m.entries.reduce((sum, e) => sum + e.attempts.length, 0);
const interrupted = unresolved[0];
const p = fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile)) : {
  dataset: m.dataset.sha256, assetWorkspace, generationCalls: slotCount,
  current: interrupted ? {
    entryId: interrupted.entryId, attempt: interrupted.attempts.at(-1).number,
    slug: interrupted.slug, startedAt: interrupted.attempts.at(-1).startedAt,
    outcome: 'awaiting-tool-result'
  } : null,
  history: [], startedAt: new Date().toISOString()
};
assert.equal(p.dataset, m.dataset.sha256);
assert.equal(p.generationCalls, slotCount, 'Call ledger and manifest differ; do not retry blindly');
assert.equal(p.current?.entryId ?? null, interrupted?.entryId ?? null, 'Unresolved image call differs from ledger');
const root = path.join(assetWorkspace, m.assetRoot);
const find = id => {
  const e = m.entries.find(e => e.entryId === id || e.slug === id);
  if (!e) throw Error('Unknown entry: ' + id);
  const w = words.find(w => w.id === e.entryId);
  assert.equal(e.sourceFingerprint, sha(JSON.stringify({ word: w, content: content[e.entryId] })), 'Entry source changed');
  return e;
};
function save() {
  m.counts = { total: m.entries.length, waiting: 0, generating: 0, generated: 0, approved: 0, held: 0, failed: 0 };
  for (const e of m.entries) {
    if (!(e.status in m.counts) || e.status === 'total') throw Error('Unknown entry status');
    m.counts[e.status]++;
  }
  p.updatedAt = new Date().toISOString();
  p.counts = m.counts;
  writeAtomic(journalFile, { manifest: m, progress: p });
  writeAtomic(file, m);
  writeAtomic(progressFile, p);
  fs.unlinkSync(journalFile);
}
function consent() {
  assert.equal(p.current, null);
  m.generation.userApproval = 'style-approved-continue';
  m.generation.styleApproval = {
    recordedAt: new Date().toISOString(),
    instruction: '지금과 같은 생성 방식을 유지하여 나머지도 진행해라.',
    scope: 'Same built-in generation method and pilot style; every image still requires individual quality review.'
  };
  p.history.push({ action: 'style-approved-continue', at: new Date().toISOString() });
  save(); console.log(JSON.stringify({ counts: m.counts, generationCalls: p.generationCalls }));
}
function prepare(sceneFile) {
  assert.equal(p.current, null, 'Resolve the current call before preparing new work');
  for (const spec of JSON.parse(fs.readFileSync(sceneFile))) {
    const e = find(spec.entryId);
    assert.equal(e.status, 'waiting');
    assert(spec.scene?.trim() && /^[a-z0-9-]+$/.test(spec.slug));
    e.slug = spec.slug; e.scene = spec.scene;
    e.promptVersion = m.generation.promptVersion;
    e.prompt = m.generation.stylePrompt + '\nSubject and meaning: ' + spec.scene;
  }
  save(); console.log('Prepared static entry-specific scenes');
}
function start(id, correctionFile) {
  assert.equal(m.generation.userApproval, 'style-approved-continue');
  assert.equal(p.current, null, 'Previous image call is unresolved; do not retry blindly');
  const e = find(id);
  assert(!e.policyHold, 'Explicit policy hold must be resolved before generation');
  if (correctionFile) {
    assert(['generated', 'held'].includes(e.status));
    assert.equal(e.attempts.length, 1, 'Only one quality correction is allowed');
    const correction = JSON.parse(fs.readFileSync(correctionFile));
    assert.equal(correction.entryId, e.entryId);
    assert(correction.prompt?.trim() && correction.defect?.trim());
    e.pendingCorrection = correction;
  } else {
    assert.equal(e.status, 'waiting', 'Completed entries must not be generated again');
    const next = m.entries.find(entry => entry.status === 'waiting');
    assert.equal(e.entryId, next.entryId, 'Keep A1/A2/B1/B2 textbook order');
    assert(e.prompt && e.slug, 'Prepare the reviewed scene first');
  }
  const prompt = correctionFile ? e.pendingCorrection.prompt : e.prompt + '\n' + m.generation.referenceInstruction;
  const attempt = {
    number: e.attempts.length + 1, startedAt: new Date().toISOString(), status: 'generating',
    prompt, promptSha256: sha(prompt), promptVersion: m.generation.promptVersion,
    referenceEntryId: m.generation.styleReferenceEntryId,
    ...(correctionFile ? { correctionDefect: e.pendingCorrection.defect } : {})
  };
  const references = [path.join(root, find(m.generation.styleReferenceEntryId).file)];
  if (correctionFile) references.unshift(path.join(root, e.file));
  for (const reference of references) assert(fs.existsSync(reference));
  e.attempts.push(attempt); e.status = 'generating';
  p.generationCalls++;
  p.current = { entryId: e.entryId, attempt: attempt.number, slug: e.slug, startedAt: attempt.startedAt, outcome: 'awaiting-tool-result' };
  save(); console.log(JSON.stringify({ entryId: e.entryId, slug: e.slug, prompt, references, attempt: attempt.number }));
}
function capture(id, source) {
  const e = find(id), a = e.attempts.at(-1);
  assert.equal(p.current?.entryId, e.entryId); assert.equal(e.status, 'generating');
  assert(fs.existsSync(source), 'Tool result file must exist');
  p.current.source = path.resolve(source); p.current.outcome = 'result-file-found';
  save();
  const filename = `${e.entryId}-${e.slug}-v${a.number}.png`, target = path.join(root, filename);
  const bytes = fs.readFileSync(source);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), hash = sha(bytes);
  assert(width < height && Math.abs(width / height - 0.75) <= 0.05);
  if (fs.existsSync(target)) assert.equal(sha(fs.readFileSync(target)), hash, 'Never overwrite a different image');
  else fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  Object.assign(a, { status: 'generated', finishedAt: new Date().toISOString(), file: filename, sha256: hash, width, height, bytes: bytes.length });
  Object.assign(e, { status: 'generated', file: filename, sha256: hash, width, height, bytes: bytes.length });
  delete e.pendingCorrection;
  p.current = null;
  p.history.push({ action: 'captured', entryId: e.entryId, attempt: a.number, at: a.finishedAt });
  save(); console.log(JSON.stringify({ entryId: e.entryId, target, counts: m.counts, generationCalls: p.generationCalls }));
}
function review(reviewFile) {
  assert.equal(p.current, null);
  for (const input of JSON.parse(fs.readFileSync(reviewFile))) {
    const e = find(input.entryId);
    assert(!e.policyHold, 'Explicit policy hold must be resolved before review');
    assert(['generated', 'approved', 'held'].includes(e.status));
    assert(['approve', 'hold'].includes(input.decision));
    assert(input.note?.trim());
    if (input.decision === 'approve') {
      assert(input.textFree === true && input.styleConsistent === true && input.meaningMatch === true && input.smallScreenChecked === true && input.pngDecoded === true);
      const bytes = fs.readFileSync(path.join(root, e.file));
      assert.equal(sha(bytes), e.sha256);
      assert.equal(bytes.length, e.bytes);
    }
    e.status = input.decision === 'approve' ? 'approved' : 'held';
    e.review = { ...input, reviewer: 'Codex', reviewedAt: new Date().toISOString(),
      userApproval: 'style-approved', caveat: 'An image is a mnemonic; it does not uniquely identify an English word or explain every use.' };
  }
  save(); console.log(JSON.stringify({ counts: m.counts, generationCalls: p.generationCalls }));
}
function holdPolicy(decisionFile) {
  assert.equal(m.generation.userApproval, 'style-approved-continue');
  assert.equal(p.current, null, 'Resolve the current image call before recording policy holds');
  const decision = JSON.parse(fs.readFileSync(decisionFile));
  assert(Array.isArray(decision.entryIds) && decision.entryIds.length > 0);
  assert.equal(new Set(decision.entryIds).size, decision.entryIds.length);
  assert.equal(decision.reason, 'text-policy-meaning-conflict');
  assert(decision.userDecision?.trim() && decision.note?.trim());
  // Validate every entry before changing any state; no image slot or file is fabricated.
  const entries = decision.entryIds.map(find);
  for (const e of entries) {
    assert(['waiting', 'held'].includes(e.status), 'Policy holds cannot replace generated or approved work');
    if (e.status === 'waiting') {
      assert.equal(e.attempts.length, 0);
      assert(!e.file, 'Waiting policy hold must not have an image');
    }
    if (e.policyHold) {
      assert.equal(e.policyHold.reason, decision.reason);
      assert.equal(e.policyHold.userDecision, decision.userDecision);
      assert.equal(e.policyHold.note, decision.note);
    }
  }
  const changed = entries.filter(e => !e.policyHold);
  if (changed.length) {
    const recordedAt = new Date().toISOString();
    for (const e of changed) {
      e.status = 'held';
      e.policyHold = { reason: decision.reason, userDecision: decision.userDecision, note: decision.note,
        phase: e.attempts.length ? 'after-generation' : 'before-generation', recordedAt };
    }
    p.history.push({ action: 'policy-held', entryIds: changed.map(e => e.entryId), reason: decision.reason, at: recordedAt });
    save();
  }
  console.log(JSON.stringify({ counts: m.counts, generationCalls: p.generationCalls, policyHeld: entries.map(e => e.entryId), changed: changed.length }));
}
function status() {
  console.log(JSON.stringify({ counts: m.counts, generationCalls: p.generationCalls, current: p.current,
    next: m.entries.filter(e => e.status === 'waiting').slice(0, 10).map(e => ({ id: e.entryId, word: e.headword || e.word, pos: e.pos, meaning: e.baseMeaning, prepared: Boolean(e.prompt) })) }));
}
const [command, ...args] = process.argv.slice(2);
if (command === 'consent') consent();
else if (command === 'prepare') prepare(args[0]);
else if (command === 'start') start(args[0], args[1]);
else if (command === 'capture') capture(args[0], args[1]);
else if (command === 'review') review(args[0]);
else if (command === 'hold-policy') holdPolicy(args[0]);
else if (command === 'status') status();
else throw Error('Use consent / prepare / start / capture / review / hold-policy / status');
