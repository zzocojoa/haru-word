import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from './source-fingerprint.mjs';

const unescape = value => value.replaceAll('&#124;', '|').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

export function americanIpaCatalog(mdBytes, wordsBytes, contentBytes) {
  const md = mdBytes.toString('utf8').replaceAll('\r\n', '\n');
  assert.ok(md.includes('## 전체 사전'), 'Missing IPA dictionary');
  const metadata = md.match(/작성·교열일: (\d{4}-\d{2}-\d{2}) · 문서 버전: 3 · 언어: en-US/);
  assert.ok(metadata, 'Unsupported IPA dictionary version');
  const words = JSON.parse(wordsBytes), content = JSON.parse(contentBytes);
  assert.equal(words.length, 3809, 'Incomplete IPA textbook');
  const dictionary = md.slice(md.indexOf('## 전체 사전')).split('\n## ')[0];
  const rows = dictionary.split('\n').map(line => line.trim())
    .filter(line => line.startsWith('|') && !line.startsWith('| ID |') && !/^\|(?:\s*:?-+:?\s*\|)+$/.test(line))
    .map(line => {
      const row = line.split('|').slice(1, -1).map(cell => unescape(cell.trim()));
      assert.ok(/^[0-9a-f]{16}$/.test(row[0]), 'Invalid IPA row identity');
      return row;
    });
  assert.equal(rows.length, words.length, 'IPA row count mismatch');
  const references = new Map([...md.matchAll(/^\[([^\]]+)\]: (https:\/\/\S+)(?: "([^"]*)")?$/gm)]
    .map(([, id, url, title]) => [id, { id, url, ...(title ? { title } : {}) }]));
  const seen = new Set();
  const entries = [];
  for (const [index, row] of rows.entries()) {
    const word = words[index];
    assert.equal(row.length, 11, 'IPA column count mismatch');
    assert.ok(!seen.has(row[0]), 'Duplicate IPA identity'); seen.add(row[0]);
    assert.deepEqual(row.slice(0, 6), [word.id, word.word, word.headword, word.pos, word.level, content[word.id]?.meaning], 'IPA identity mismatch');
    const sourceIpas = row[7].split('<br>');
    const variants = row[6].split('<br>').map((part, variantIndex) => {
      const match = part.match(/^(\/[^/]+\/) \((.+)\)$/);
      assert.ok(match, 'Invalid IPA variant');
      assert.ok(match[1] === match[1].normalize('NFC') && /^[ /ˈˌɑɔɛæɪʊəʌɝɚiuaeorɡptkbdmfvθðszʃʒhnlŋjw]+$/u.test(match[1]), 'Noncanonical IPA');
      assert.ok((match[1].match(/ˈ/g) || []).length <= 1, 'Multiple IPA primary stresses');
      const nuclei = (match[1].replace(/a[ɪʊ]|eɪ|oʊ|ɔɪ/g, 'V').match(/[Vɑɔɛæɪʊəʌɝɚiu]/g) || []).length;
      if (nuclei > 1 && !match[2].includes('약형')) assert.ok(match[1].includes('ˈ'), 'Missing IPA primary stress');
      return { ipa: match[1], usage: match[2], sourceIpa: sourceIpas[variantIndex] };
    });
    assert.equal(sourceIpas.length, variants.length, 'IPA source count mismatch');
    // Raw evidence also contains narrow [phonetic] forms and combined transcriptions.
    // Preserve them verbatim; only display variants follow our normalized alphabet.
    assert.ok(sourceIpas.every(ipa => ipa.trim().length > 0), 'Invalid source IPA');
    const sourceRefs = [...row[9].matchAll(/\[([^\]]+)\]/g)].map(([, id]) => {
      assert.ok(references.has(id), 'Unknown IPA source: ' + id);
      return references.get(id);
    });
    assert.ok(sourceRefs.length, 'Missing IPA sources');
    entries.push({ ...word, meaning: row[5], variants, note: row[8].replaceAll('<br>', '\n'),
      sourceRefs, sourceUrls: [...new Set(sourceRefs.map(ref => ref.url))], sourceDetail: row[9],
      reviewMethod: row[10].split('<br>')[0], reviewHistory: row[10].replaceAll('<br>', '\n') });
  }
  const noticeStart = md.indexOf('## 출처와 재사용 고지'), noticeEnd = md.indexOf('### v3 재확인 원문 출처'), licensesStart = md.indexOf('## 공개 자료 라이선스 고지');
  assert.ok(noticeStart >= 0 && noticeEnd > noticeStart && licensesStart > noticeEnd, 'Missing IPA attribution');
  const sourceNotice = md.slice(noticeStart, noticeEnd), licenses = md.slice(licensesStart);
  return { schemaVersion: 1, dictionaryVersion: 3, locale: 'en-US', normalization: 'broad-us-v3', reviewedAt: metadata[1],
    inputs: { dictionarySha256: sourceFingerprint(mdBytes), wordsSha256: sourceFingerprint(wordsBytes), contentSha256: sourceFingerprint(contentBytes) },
    attribution: sourceNotice + '\n' + licenses, entries };
}

export function prepareAmericanIpa(check = false) {
  const catalog = americanIpaCatalog(readFileSync('docs/OXFORD_AMERICAN_IPA_DICTIONARY.md'), readFileSync('data/words.json'), readFileSync('data/content.json'));
  const ui = { schemaVersion: catalog.schemaVersion, dictionaryVersion: catalog.dictionaryVersion, inputs: catalog.inputs,
    entries: Object.fromEntries(catalog.entries.map(entry => [entry.id, entry.variants.map(({ ipa, usage }) => [ipa, usage])])) };
  // One source entry per line keeps the public evidence reviewable and scannable.
  const { entries, ...metadata } = catalog;
  const publicBytes = JSON.stringify(metadata).slice(0, -1) + ',"entries":[\n'
    + entries.map(entry => JSON.stringify(entry)).join(',\n') + '\n]}\n';
  const outputs = [['data/american-ipa-ui.json', JSON.stringify(ui) + '\n'], ['public/sources/american-ipa.json', publicBytes]];
  for (const [file, bytes] of outputs) {
    if (check) assert.ok(readFileSync(file, 'utf8') === bytes, `IPA artifact is stale: ${file}; run npm run ipa:prepare`);
    else { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, bytes); }
  }
  return { checked: check, entries: catalog.entries.length, variants: catalog.entries.reduce((sum, entry) => sum + entry.variants.length, 0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every(arg => arg === '--check'), 'Unknown argument');
  console.log(JSON.stringify(prepareAmericanIpa(process.argv.includes('--check'))));
}
