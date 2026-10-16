import test from 'node:test';
import assert from 'node:assert/strict';
import { staticDependencies, learningChunks } from '../build/learning-chunks.ts';
import { prepareGrammarIndex } from '../scripts/prepare-grammar-index.mjs';
import { GRAMMAR_LESSONS } from '../lib/grammar/content.ts';
import index from '../data/grammar-index.json' with { type: 'json' };

test('small grammar help index preserves all lesson identities, labels, roles and first examples', () => {
  assert.equal(prepareGrammarIndex(true).entries, 15);
  assert.deepEqual(index.entries, GRAMMAR_LESSONS.map(({ id, pos, title, role, examples }) => ({ id, pos, title, role, example: examples[0] })));
});
test('initial chunk closure follows static edges and preserves dynamic material boundaries', () => {
  const graph = { root: { importedIds: ['shared', 'words'], dynamicallyImportedIds: ['editor'] },
    shared: { importedIds: ['root', 'react'] }, words: { importedIds: [] }, react: { importedIds: [] }, editor: { importedIds: ['content'] } };
  assert.deepEqual([...staticDependencies('root', id => graph[id] ?? null)].sort(), ['react', 'root', 'shared', 'words']);
  assert.throws(() => staticDependencies('missing', () => null));
  const plugin = learningChunks();
  assert.equal(plugin.applyToEnvironment({ name: 'client' }), true);
  for (const name of ['ssr', 'rsc']) assert.equal(plugin.applyToEnvironment({ name }), false);
});
