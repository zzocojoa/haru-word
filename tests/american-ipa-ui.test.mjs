import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WORDS, cardMeaning } from '../lib/catalog-basics.ts';

mkdirSync('work/tests', { recursive: true });
await build({ stdin: { contents: "export * from './app/word-pronunciation.tsx'; export { LearnStage } from './app/study/learn-stage.tsx'; export { SentenceStage } from './app/study/sentence-stage.tsx'; export { WordEditor } from './app/library/word-editor.tsx'; export { Dialog } from './components/ui/dialog.tsx';", resolveDir: process.cwd(), loader: 'tsx' }, outfile: 'work/tests/american-ipa-ui.mjs', bundle: true,
  platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external' });
const { WordPronunciation, WordIpa, LearnStage, WordEditor, Dialog, SentenceStage } = await import('../work/tests/american-ipa-ui.mjs');
const word = name => WORDS.find(word => word.word === name);

test('ordinary words show US IPA without removing device speech', () => {
  const quickly = word('quickly');
  const html = renderToStaticMarkup(React.createElement(WordPronunciation, { word: quickly, meaning: cardMeaning(quickly.id) }));
  assert.match(html, /class="phonetic"/);
  assert.ok(html.includes('/ˈkwɪkli/'));
  assert.ok(html.includes('기기 음성 듣기'));
  assert.ok(html.includes('사전 발음'));
});

test('learning IPA follows the word before its image preview and appears only once', () => {
  const quickly = word('quickly'), content = JSON.parse(readFileSync('data/content.json'))[quickly.id];
  const noop = () => {};
  const html = renderToStaticMarkup(React.createElement(LearnStage, { word: quickly, content, ...content, imagePilotEnabled: true,
    setMeaning: noop, setExpression: noop, setExpressionTranslation: noop, setExample: noop, setTranslation: noop, learn: noop }));
  const imageIndex = html.indexOf('class="word-image-learn"');
  assert.ok(imageIndex >= 0, 'real learning image must be rendered');
  assert.ok(html.indexOf('class="word-ipa"') < imageIndex, 'IPA must precede the image preview');
  assert.equal((html.match(/class="word-ipa"/g) || []).length, 1);
});

// Existing dictionary/audio policy remains a guard while the display uses v3.
test('conditional variants retain labels; text-only mode has no interactive descendants', () => {
  const read = word('read'), props = { word: read, meaning: cardMeaning(read.id) };
  const html = renderToStaticMarkup(React.createElement(WordPronunciation, props));
  for (const text of ['/rid/', '/rɛd/', '원형·현재', '과거·과거분사', '미국식 사전 발음 듣기']) assert.ok(html.includes(text));
  assert.equal(html.includes('/riːd/'), false);
  assert.equal(html.includes('기기 음성 듣기'), false);
  const plain = renderToStaticMarkup(React.createElement(WordIpa, props));
  assert.doesNotMatch(plain, /<(?:a|button|input|details)\b/);
  assert.equal(renderToStaticMarkup(React.createElement(WordIpa, { ...props, meaning: '다른 뜻' })), '');
  assert.equal(renderToStaticMarkup(React.createElement(WordPronunciation, { ...props, showIpa: false })).includes('class="word-ipa"'), false);
});

test('editor places IPA below its title before the selected word metadata', () => {
  const read = word('read');
  const html = renderToStaticMarkup(React.createElement(Dialog, { open: true }, React.createElement(WordEditor,
    { word: read, activityDate: () => '2026-10-19', onSave: async () => true, busy: false, retryBlocked: false })));
  const ipa = html.indexOf('class="word-ipa"');
  assert.ok(ipa > html.indexOf('</h2>') && ipa < html.indexOf('data-slot="dialog-description"'), 'IPA must be directly below the editor title');
  assert.equal((html.match(/class="word-ipa"/g) || []).length, 1);
});

test('sentence target displays IPA between its word and selected meaning', () => {
  const read = word('read'), content = JSON.parse(readFileSync('data/content.json'))[read.id], noop = () => {};
  const html = renderToStaticMarkup(React.createElement(SentenceStage, { word: read, content, id: read.id,
    s: { id: 'fixture', records: { [read.id]: { meaning: content.meaning } } }, sentence: '', notes: '',
    setSentence: noop, setNotes: noop, setSpoken: noop, setAiPending: noop, storeFeedback: noop, sentenceDone: noop }));
  const headingEnd = html.indexOf('</h3>');
  assert.ok(html.indexOf('class="word-ipa"') > headingEnd && html.indexOf('class="word-ipa"') < html.indexOf('읽다'), 'IPA must precede the selected sentence meaning');
  assert.equal((html.match(/class="word-ipa"/g) || []).length, 1);
});

test('sentence IPA does not replace an explicitly empty recorded meaning with the textbook sense', () => {
  const read = word('read'), content = JSON.parse(readFileSync('data/content.json'))[read.id], noop = () => {};
  const html = renderToStaticMarkup(React.createElement(SentenceStage, { word: read, content, id: read.id,
    s: { id: 'fixture', records: { [read.id]: { meaning: '' } } }, sentence: '', notes: '',
    setSentence: noop, setNotes: noop, setSpoken: noop, setAiPending: noop, storeFeedback: noop, sentenceDone: noop }));
  assert.equal(html.includes('class="word-ipa"'), false, 'an explicit empty meaning must not receive fallback IPA');
  assert.ok(html.includes('사전에서 발음 확인'), 'unconfirmed sense keeps dictionary fallback');
});
