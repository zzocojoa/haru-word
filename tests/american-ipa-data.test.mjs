import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { americanIpaCatalog } from '../scripts/prepare-american-ipa.mjs';

const md = readFileSync('docs/OXFORD_AMERICAN_IPA_DICTIONARY.md');
const words = readFileSync('data/words.json');
const content = readFileSync('data/content.json');

test('missing dictionary cannot silently produce an empty IPA catalog', () => {
  assert.throws(() => americanIpaCatalog(Buffer.from(''), words, content), /Missing IPA dictionary/);
});

test('a changed textbook sense cannot reuse the approved IPA row', () => {
  const changed = JSON.parse(content);
  changed[JSON.parse(words)[0].id].meaning = '다른 뜻';
  assert.throws(() => americanIpaCatalog(md, words, Buffer.from(JSON.stringify(changed))), /IPA identity mismatch/);
});

// Existing guards: exercise malformed catalogs without claiming a new red/green step.
test('missing, duplicate and mismatched dictionary identities stop generation', () => {
  const text = md.toString(), rows = text.split('\n').filter(line => /^\| [0-9a-f]{16} \|/.test(line));
  assert.throws(() => americanIpaCatalog(Buffer.from(text.replace(rows[0], '')), words, content), /IPA row count mismatch/);
  assert.throws(() => americanIpaCatalog(Buffer.from(text.replace(rows[1], rows[0])), words, content), /Duplicate IPA identity/);
  for (const field of ['id', 'word', 'headword', 'pos', 'level']) {
    const changed = JSON.parse(words); changed[0][field] = 'different';
    assert.throws(() => americanIpaCatalog(md, Buffer.from(JSON.stringify(changed)), content), /IPA identity mismatch/, field);
  }
});

test('a malformed identity row cannot be silently skipped beside the valid dictionary', () => {
  const text = md.toString(), first = text.split('\n').find(line => /^\| [0-9a-f]{16} \|/.test(line));
  const invalid = first.replace(/^[|] [0-9a-f]{16} [|]/, '| invalid-id |');
  assert.throws(() => americanIpaCatalog(Buffer.from(text.replace(first, first + '\n' + invalid)), words, content), /Invalid IPA row identity/);
});

test('the complete dictionary retains conditional IPA, raw sources and attribution', () => {
  const result = americanIpaCatalog(md, words, content);
  assert.equal(result.entries.length, 3809);
  assert.equal(result.entries.flatMap(entry => entry.variants).length, 3837);
  assert.equal(result.entries.filter(entry => entry.variants.length > 1).length, 26);
  const read = result.entries.find(entry => entry.word === 'read');
  assert.deepEqual(read.variants.map(({ ipa, usage }) => [ipa, usage]), [['/rid/', '원형·현재'], ['/rɛd/', '과거·과거분사']]);
  assert.ok(read.variants.every(variant => variant.sourceIpa));
  assert.ok(read.sourceUrls.some(url => url.includes('dictionary.cambridge.org')));
  assert.equal(result.normalization, 'broad-us-v3');
  assert.equal(result.reviewedAt, '2026-10-19');
  assert.match(result.attribution, /Wiktionary contributors/);
  assert.match(result.attribution, /CC BY-SA 4\.0/);
  assert.match(result.attribution, /Permission is hereby granted/);
  assert.match(result.attribution, /Redistribution and use/);
  for (const hash of Object.values(result.inputs)) assert.match(hash, /^[a-f0-9]{64}$/);
});

test('invalid IPA, missing raw variants and unresolved sources stop generation', () => {
  const first = md.toString().split('\n').find(line => /^\| [0-9a-f]{16} \|/.test(line));
  const change = (column, value) => {
    const cells = first.split('|'); cells[column + 1] = ` ${value} `;
    return Buffer.from(md.toString().replace(first, cells.join('|')));
  };
  for (const [column, value, error] of [
    [6, '/aː/ (약형)', /Noncanonical IPA/],
    [6, '/ə/ ()', /Invalid IPA variant/],
    [7, '/ə/', /IPA source count mismatch/],
    [7, '<br>/eɪ/<br>/ən/<br>/æn/', /Invalid source IPA/],
    [9, '[DOES_NOT_EXIST]', /Unknown IPA source/],
    [9, 'US', /Missing IPA sources/],
  ]) assert.throws(() => americanIpaCatalog(change(column, value), words, content), error);
});

test('generated UI and public evidence are reproducible; check rejects stale files without rewriting', () => {
  mkdirSync('work', { recursive: true });
  const root = mkdtempSync(path.resolve('work/ipa-generator-'));
  const script = path.resolve('scripts/prepare-american-ipa.mjs');
  const run = (cwd, check = false) => spawnSync(process.execPath, [script, ...(check ? ['--check'] : [])], { cwd, encoding: 'utf8', windowsHide: true });
  const outputs = ['data/american-ipa-ui.json', 'public/sources/american-ipa.json'];
  try {
    const generated = [];
    for (const [index, eol] of ['\n', '\r\n'].entries()) {
      const cwd = path.join(root, String(index));
      for (const [file, bytes] of [['docs/OXFORD_AMERICAN_IPA_DICTIONARY.md', md], ['data/words.json', words], ['data/content.json', content]]) {
        mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
        writeFileSync(path.join(cwd, file), bytes.toString().replaceAll('\r\n', '\n').replaceAll('\n', eol));
      }
      const result = run(cwd); assert.equal(result.status, 0, result.stderr);
      assert.ok(outputs.every(file => existsSync(path.join(cwd, file))), 'both IPA artifacts must be generated');
      const bytes = outputs.map(file => readFileSync(path.join(cwd, file), 'utf8')); generated.push(bytes);
      const ui = JSON.parse(bytes[0]), published = JSON.parse(bytes[1]);
      assert.ok(bytes[1].split('\n').every(line => Buffer.byteLength(line) <= 1_048_576), 'public evidence must fit the existing secret-scanner line limit');
      assert.equal(Object.keys(ui.entries).length, 3809);
      assert.deepEqual(ui.entries, Object.fromEntries(published.entries.map(entry => [entry.id, entry.variants.map(({ ipa, usage }) => [ipa, usage])])));
      assert.ok(Buffer.byteLength(bytes[0]) < 230_000, 'only display data belongs in the client index');
      assert.equal(run(cwd, true).status, 0);
      for (const file of outputs) {
        writeFileSync(path.join(cwd, file), 'stale');
        assert.notEqual(run(cwd, true).status, 0);
        assert.equal(readFileSync(path.join(cwd, file), 'utf8'), 'stale', 'check must not rewrite');
        assert.equal(run(cwd).status, 0);
      }
    }
    assert.deepEqual(generated[0], generated[1], 'CRLF and LF generate identical bytes');
  } finally {
    assert.equal(path.dirname(root), path.resolve('work'));
    assert.ok(path.basename(root).startsWith('ipa-generator-'));
    rmSync(root, { recursive: true });
  }
});
