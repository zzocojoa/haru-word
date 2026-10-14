// Read-only source/image checks plus local browser previews. No AI calls or production requests.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const http = require('node:http');
const repo = path.resolve(__dirname, '..');
const assetWorkspace = process.env.OXFORD_ASSET_WORKSPACE || 'C:/Users/user/Documents/ChatGPT/하루단어';
const m = JSON.parse(fs.readFileSync(path.join(repo, 'data/word-image-manifest.json')));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const imageFilename = /^[a-f0-9]{16}-[a-z0-9-]+-v[1-9][0-9]*\.png$/;
const wordsBytes = fs.readFileSync(path.join(repo, 'data/words.json'));
const contentBytes = fs.readFileSync(path.join(repo, 'data/content.json'));
assert.equal(sha(wordsBytes), m.dataset.wordsSha256);
assert.equal(sha(contentBytes), m.dataset.contentSha256);
assert.equal(sha(m.dataset.wordsSha256 + ':' + m.dataset.contentSha256), m.dataset.sha256);
const words = JSON.parse(wordsBytes), content = JSON.parse(contentBytes);
assert.equal(words.length, 3809); assert.equal(m.entries.length, 3809);
const byId = new Map(m.entries.map(e => [e.entryId, e]));
assert.equal(byId.size, 3809);
const counts = { total: 3809, waiting: 0, generating: 0, generated: 0, approved: 0, held: 0, failed: 0 };
for (const w of words) {
  const e = byId.get(w.id);
  assert(e); assert.equal(e.baseMeaning, content[w.id].meaning); assert.equal(e.pos, w.pos);
  assert.equal(e.sourceFingerprint, sha(JSON.stringify({ word: w, content: content[w.id] })));
  if (e.policyHold) {
    assert.equal(e.status, 'held');
    assert.equal(e.policyHold.reason, 'text-policy-meaning-conflict');
    assert(e.policyHold.userDecision?.trim() && e.policyHold.note?.trim());
    assert(Number.isFinite(Date.parse(e.policyHold.recordedAt)));
    assert.equal(e.policyHold.phase, e.attempts.length ? 'after-generation' : 'before-generation');
    if (!e.attempts.length) {
      for (const key of ['file', 'sha256', 'bytes', 'width', 'height', 'review']) assert.equal(e[key], undefined);
    }
  }
  if (e.textPolicyException) {
    const approval = m.generation.remainingApproval;
    assert(approval && approval.textExceptionEntryIds.includes(e.entryId));
    assert.equal(e.textPolicyException.approvalId, approval.approvalId);
    assert(!e.policyHold);
    const history = e.policyHoldHistory?.at(-1);
    assert.equal(history?.releasedByApprovalId, approval.approvalId);
    assert.equal(history.hold.reason, 'text-policy-meaning-conflict');
    if (e.status === 'approved') {
      assert.equal(e.review.textFree, false);
      assert.equal(e.review.textPolicyExceptionVerified, true);
      assert.equal(e.review.nonAuthorizedTextAbsent, true);
      assert.equal(e.review.textExceptionApprovalId, approval.approvalId);
    }
  }
  assert(e.status in counts && e.status !== 'total'); counts[e.status]++;
}
assert.deepEqual(m.counts, counts);
const requested = process.argv.slice(2);
const selected = requested.length ? requested.map(id => byId.get(id)) : m.entries.filter(e => e.file);
assert(selected.length > 0 && selected.every(e => e?.file));
assert.equal(new Set(selected.map(e => e.entryId)).size, selected.length);
const root = path.join(assetWorkspace, m.assetRoot);
for (const e of selected) {
  assert.match(e.file, imageFilename);
  const b = fs.readFileSync(path.join(root, e.file));
  assert.equal(sha(b), e.sha256); assert.equal(b.length, e.bytes);
  assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(b.readUInt32BE(16), e.width); assert.equal(b.readUInt32BE(20), e.height);
  assert(e.width < e.height && Math.abs(e.width / e.height - 0.75) <= 0.05);
  const a = e.attempts.at(-1);
  assert(e.file.endsWith('-v' + a.number + '.png'));
  if (a.number >= 3 || a.recoveryApprovalId) {
    const approval = [m.generation.recoveryApproval, ...(m.generation.recoveryRounds || [])].find(r => r && a.recoveryApprovalId === r.approvalId);
    assert(approval);
    assert(approval.entryIds.includes(e.entryId));
    assert.equal(a.recoveryProposalSha256, approval.proposalSha256);
    assert.equal(approval.proposalPath, approval.round >= 2 ? `docs/oxford-word-image-recovery-round${approval.round}-proposal.json` : 'docs/oxford-word-image-recovery-proposal.json');
    const proposalBytes = fs.readFileSync(path.join(repo, approval.proposalPath));
    assert.equal(sha(proposalBytes), approval.proposalSha256);
    const spec = JSON.parse(proposalBytes).entries.find(s => s.entryId === e.entryId);
    assert(spec); assert.equal(a.number, spec.proposedNextAttemptNumber); assert.equal(a.promptSha256, spec.fullPromptSha256);
    if (approval.round >= 2) {
      assert.equal(a.recoveryRound, approval.round); assert.equal(a.imageMode, spec.mode); assert.deepEqual(a.imageReferences, spec.references);
    }
  }
  assert.equal(a.file, e.file); assert.equal(a.sha256, e.sha256);
  const actualPrompt = a.prompt || e.prompt + (e.slug === 'apple' ? '' : '\n' + m.generation.referenceInstruction);
  assert.equal(a.promptSha256, sha(actualPrompt));
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f5f5ef;font-family:system-ui}article{margin:16px;width:288px;background:white}img{display:block;width:288px;height:auto;aspect-ratio:3/4}p{margin:0;padding:10px;font-size:14px}</style>' + selected.map(e => '<article data-id="' + e.entryId + '"><img src="/' + encodeURIComponent(e.file) + '" alt="' + escape(e.baseMeaning) + '"><p>' + escape((e.headword || e.word) + ' · ' + e.pos + ' · ' + e.baseMeaning) + '</p></article>').join('');
async function main() {
  let playwright;
  try { playwright = require('playwright'); }
  catch { playwright = require(process.env.OXFORD_PLAYWRIGHT_MODULE || 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
  const server = http.createServer((req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html); }
    const name = decodeURIComponent(req.url.slice(1));
    if (!imageFilename.test(name) || !selected.some(e => e.file === name)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'image/png' }); fs.createReadStream(path.join(root, name)).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'networkidle' });
    await page.locator('img').evaluateAll(async images => { for (const img of images) await img.decode(); });
    const renders = await page.locator('img').evaluateAll(images => images.map(img => ({ entryId: img.closest('article').dataset.id, decoded: img.complete && img.naturalWidth > 0, width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height })));
    assert.equal(renders.length, selected.length);
    assert(renders.every(r => r.decoded && r.width === 288 && Math.abs(r.width / r.height - 0.75) <= 0.05));
    const out = path.join(root, 'qa'); fs.mkdirSync(out, { recursive: true });
    for (const e of selected) await page.locator('article[data-id="' + e.entryId + '"]').screenshot({ path: path.join(out, e.entryId + '-v' + e.attempts.at(-1).number + '-320.png') });
    const evidence = { checkedAt: new Date().toISOString(), datasetSha256: m.dataset.sha256, metadata: 'pass', counts, viewport: 320,
      network: 'loopback only', entries: selected.map(e => ({ entryId: e.entryId, file: e.file, sha256: e.sha256, bytes: e.bytes, pngDecoded: true, smallScreenRendered: true, screenshot: path.join(out, e.entryId + '-v' + e.attempts.at(-1).number + '-320.png') })) };
    const evidencePath = path.join(repo, 'work/oxford-images-verification-' + Date.now() + '.json');
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
    fs.writeFileSync(path.join(repo, 'work/oxford-images-latest-verification.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify({ result: 'pass', verifiedImages: selected.length, viewport: 320, evidencePath, counts }));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
