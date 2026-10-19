import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveWordIpa } from '../lib/american-ipa.ts';
import { WORDS, cardMeaning } from '../lib/catalog-basics.ts';

test('changed senses and identities never receive the original IPA', () => {
  const word = WORDS.find(word => word.word === 'read');
  const meaning = cardMeaning(word.id);
  assert.equal(resolveWordIpa(word, '別の意味'), undefined);
  for (const changed of [{ personal: true }, { id: 'personal' }, { word: 'Read' }, { headword: 'other' }, { pos: 'n.' }])
    assert.equal(resolveWordIpa({ ...word, ...changed }, meaning), undefined);
  assert.equal(resolveWordIpa(word, ''), undefined);
});

// Previously reviewed fixed expectations: these are guards, not new red/green claims.
test('all catalog entries and the 115 independent dictionary regressions resolve unchanged', () => {
  let variants = 0;
  for (const word of WORDS) {
    const result = resolveWordIpa(word, cardMeaning(word.id));
    assert.ok(result?.length, word.id); variants += result.length;
    assert.deepEqual(resolveWordIpa(word, ` ${cardMeaning(word.id)} `), result);
  }
  assert.equal(variants, 3837);
  const { cases } = JSON.parse(readFileSync('tests/fixtures/american-ipa-regressions.json'));
  assert.equal(cases.length, 115);
  for (const expected of cases) {
    const word = WORDS.find(word => expected.id ? word.id === expected.id : word.word === expected.word && word.pos === expected.pos
      && (!expected.meaning || cardMeaning(word.id) === expected.meaning));
    assert.ok(word, expected.word);
    assert.deepEqual(resolveWordIpa(word, cardMeaning(word.id)).map(([ipa]) => ipa), expected.ipa, `${expected.review} ${expected.word} ${expected.pos}`);
  }
  const read = WORDS.find(word => word.word === 'read');
  assert.deepEqual(resolveWordIpa(read, cardMeaning(read.id)), [['/rid/', '원형·현재'], ['/rɛd/', '과거·과거분사']]);
  const article = WORDS[0];
  assert.equal(resolveWordIpa(article, cardMeaning(article.id).replace(' ', '  ')), undefined);
  const byWord = name => { const word = WORDS.find(word => word.word === name); return resolveWordIpa(word, cardMeaning(word.id)); };
  assert.notDeepEqual(byWord('IT'), byWord('it'));
  assert.equal(byWord('a, an').length, 4);
  assert.equal(resolveWordIpa({ ...read, id: 'constructor' }, cardMeaning(read.id)), undefined);
});
