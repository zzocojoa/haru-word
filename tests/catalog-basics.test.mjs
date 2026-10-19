import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { catalogBasics, prepareCatalogBasics } from '../scripts/prepare-catalog-basics.mjs';
import { WORDS, cardMeaning, dictionaryUrl } from '../lib/catalog-basics.ts';
import { staticModuleUrls } from '../lib/deferred-assets.ts';

test('material cache recovery fetches only unique same-origin static JavaScript', () => {
  const origin = 'https://study.example', allowed = origin + '/_next/static/chunks/catalog-abc.js';
  assert.deepEqual(staticModuleUrls([allowed, allowed, 'bad URL', origin + '/api/state',
    origin + '/word-images/v1/a.js', 'https://other.example/_next/static/chunks/a.js',
    'https://name:password@study.example/_next/static/chunks/a.js'], origin), [allowed]);
  const shared = origin + '/_next/static/chunks/learning-shared~learning-app~word-editor-abc.js';
  assert.deepEqual(staticModuleUrls([shared], origin), [shared]);
});

test('the compact catalog exactly preserves every default meaning and source fingerprint', () => {
  assert.equal(prepareCatalogBasics(true).entries, 3809);
  const content = JSON.parse(readFileSync('data/content.json'));
  assert.equal(WORDS.length, 3809);
  for (const word of WORDS) assert.equal(cardMeaning(word.id), content[word.id].meaning, word.id);
  const a = catalogBasics(Buffer.from('[{"id":"a"}]'), Buffer.from('{"a":{"meaning":"뜻"}}'));
  const b = catalogBasics(Buffer.from('[{"id":"a"}]'), Buffer.from('{"a":{"meaning":"수정"}}'));
  assert.notEqual(a.contentSha256, b.contentSha256);
  assert.throws(() => catalogBasics(Buffer.from('[{"id":"a"},{"id":"a"}]'), Buffer.from('{"a":{"meaning":"뜻"}}')));
});

test('initial meaning lookup retains edited, empty and personal senses without touching their material', () => {
  const word = WORDS[0];
  for (const meaning of ['', '다른 뜻', '  내가 저장한 뜻  ']) {
    const progress = { meaning, example: 'My saved example.', notes: 'saved' }, before = structuredClone(progress);
    assert.equal(cardMeaning(word.id, progress), meaning);
    assert.deepEqual(progress, before);
  }
  assert.equal(cardMeaning('personal_test', { meaning: '나만의 뜻' }), '나만의 뜻');
  assert.equal(cardMeaning('personal_test'), '');
  assert.equal(cardMeaning('constructor'), '');
  assert.ok(dictionaryUrl('a, an').endsWith('?q=a'));
});

test('initial learning graph excludes full examples and image index while deferred views retain them', async () => {
  const result = await build({ entryPoints: ['app/learning-app.tsx', 'app/word-library.tsx'], outdir: 'work/catalog-basics-test', write: false,
    bundle: true, splitting: true, format: 'esm', platform: 'browser', metafile: true, logLevel: 'silent',
    external: ['react', 'react-dom', 'react/jsx-runtime', 'next/navigation', 'lucide-react', 'radix-ui', '@base-ui/react', '@base-ui/react/*', '*?worker'] });
  const outputs = result.metafile.outputs;
  const entry = Object.keys(outputs).find(file => outputs[file].entryPoint === 'app/learning-app.tsx');
  assert.ok(entry);
  const visited = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    for (const dependency of outputs[file].imports) if (dependency.kind !== 'dynamic-import' && outputs[dependency.path]) visit(dependency.path);
  }
  visit(entry);
  const inputs = new Set([...visited].flatMap(file => Object.keys(outputs[file].inputs)));
  assert.ok(inputs.has('data/catalog-basics.json'));
  assert.equal(inputs.has('data/content.json'), false);
  assert.equal(inputs.has('data/word-image-ui.json'), false);
  assert.equal(inputs.has('data/american-ipa-ui.json'), false);
  assert.equal(inputs.has('lib/grammar/content.ts'), false);
  assert.equal(inputs.has('lib/grammar/content-v4.ts'), false);
  assert.ok(Object.values(outputs).some(output => Object.hasOwn(output.inputs, 'data/content.json')));
  assert.ok(Object.values(outputs).some(output => Object.hasOwn(output.inputs, 'data/word-image-ui.json')));
  assert.ok(Object.values(outputs).some(output => Object.hasOwn(output.inputs, 'data/american-ipa-ui.json')));
  visited.clear();
  visit(Object.keys(outputs).find(file => outputs[file].entryPoint === 'app/word-library.tsx'));
  const libraryInputs = new Set([...visited].flatMap(file => Object.keys(outputs[file].inputs)));
  assert.equal(libraryInputs.has('data/content.json'), false);
  assert.equal(libraryInputs.has('data/word-image-ui.json'), false);
  assert.equal(libraryInputs.has('data/american-ipa-ui.json'), false);
  assert.equal(libraryInputs.has('lib/grammar/content-v4.ts'), false);
  assert.ok(libraryInputs.has('data/grammar-index.json'));
});
