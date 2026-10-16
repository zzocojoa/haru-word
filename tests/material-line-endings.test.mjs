import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const repo = process.cwd();
const generators = [
  { script: 'prepare-catalog-basics.mjs', output: 'data/catalog-basics.json', source: 'data/content.json' },
  { script: 'prepare-grammar-index.mjs', output: 'data/grammar-index.json', source: 'lib/grammar/content.ts' },
];
const sources = ['data/words.json', 'data/content.json', 'lib/grammar/content.ts'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function command(bin, args, cwd) {
  return spawnSync(bin, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
}
function generate(entry, cwd, check = false) {
  return command(process.execPath, ['--experimental-strip-types', path.join(repo, 'scripts', entry.script), ...(check ? ['--check'] : [])], cwd);
}
function seed(root, eol) {
  for (const file of sources) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), fs.readFileSync(path.join(repo, file), 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, eol));
  }
}
function temporary(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'haru-material-eol-'));
  try { run(root); }
  finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('haru-material-eol-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

for (const entry of generators) test(`${entry.script}: LF and CRLF have the same fingerprint; real changes still fail without rewriting output`, () => temporary(root => {
  const lf = path.join(root, 'lf'), crlf = path.join(root, 'crlf');
  seed(lf, '\n'); seed(crlf, '\r\n');
  for (const cwd of [lf, crlf]) {
    const result = generate(entry, cwd);
    assert.equal(result.status, 0, result.stderr);
  }
  const expected = fs.readFileSync(path.join(lf, entry.output));
  assert.equal(sha(fs.readFileSync(path.join(crlf, entry.output))), sha(expected), 'line ending alone must not change the generated artifact');
  for (const cwd of [lf, crlf]) {
    assert.equal(generate(entry, cwd, true).status, 0, 'both source forms pass --check');
    fs.appendFileSync(path.join(cwd, entry.source), ' ');
    assert.notEqual(generate(entry, cwd, true).status, 0, 'a change beyond line endings remains stale');
    assert.deepEqual(fs.readFileSync(path.join(cwd, entry.output)), expected, 'failed --check never rewrites existing material');
  }
}));

test('Git LF and autocrlf checkouts preserve LF artifacts and pass both material gates', () => temporary(root => {
  const seedRoot = path.join(root, 'seed'); seed(seedRoot, '\n');
  fs.copyFileSync(path.join(repo, '.gitattributes'), path.join(seedRoot, '.gitattributes'));
  for (const entry of generators) assert.equal(generate(entry, seedRoot).status, 0);
  const init = command('git', ['init', '--quiet'], seedRoot); assert.equal(init.status, 0, init.stderr);
  const added = command('git', ['-c', 'core.autocrlf=false', 'add', '--', '.gitattributes', ...sources, ...generators.map(entry => entry.output)], seedRoot);
  assert.equal(added.status, 0, added.stderr);
  for (const autocrlf of ['false', 'true']) {
    const checkout = path.join(root, `checkout-${autocrlf}`); fs.mkdirSync(checkout);
    const result = command('git', ['-c', `core.autocrlf=${autocrlf}`, 'checkout-index', '--all', `--prefix=${checkout.replaceAll('\\', '/')}/`], seedRoot);
    assert.equal(result.status, 0, result.stderr);
    if (autocrlf === 'true') assert.ok(fs.readFileSync(path.join(checkout, 'lib/grammar/content.ts'), 'utf8').includes('\r\n'), 'exercise an actual CRLF checkout');
    for (const entry of generators) {
      assert.equal(fs.readFileSync(path.join(checkout, entry.output), 'utf8').includes('\r\n'), false, 'generated material must stay LF on every checkout');
      const checked = generate(entry, checkout, true); assert.equal(checked.status, 0, checked.stderr);
    }
  }
}));
