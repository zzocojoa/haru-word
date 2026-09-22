import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as learning from '../lib/learning.ts';
import { stateDelta } from '../lib/state-delta.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const words = JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url)));
const material = () => ({ meaning: '선택한 뜻', expression: '', example: '', translation: '', source: 'test' });
const fresh = () => structuredClone(learning.EMPTY);
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};

test('learning facade retains the pre-refactor public runtime API', () => {
  const expected = `EMPTY FAMILIARITY_TEXT KIND_TEXT LEVELS MAX_DAILY_GOAL POS RESULT_TEXT SENTENCE_TEXT allSenses applyRecord assessmentAdvice assessmentSample confirmFamiliarity continueBatch currentId dailyAssignedIds dailyMeaning dailyReplaySources emptyRecord ensureCarryover entryIdFor exportLog exportTutor extendReviewSession hasReviewWork isComplete learningMetrics missingReviewTargets needsInitialAssessment newSession nextAction pendingReviews periodKey pickDaily practiceIds practiceTargets recordFamiliarity repeatDailySession revealFamiliarity reviewBatchEnd reviewIds reviewRemaining reviewTargets selectSense senseProgress sessionRecordComplete sessionRecordMeasured stepSession storeSense targetIdentity today weekStart`.split(' ');
  assert.deepEqual(Object.keys(learning).sort(), expected.sort());
});

test('learning modules have direct acyclic runtime dependencies and no UI or persistence imports', () => {
  const dir = path.join(root, 'lib/learning');
  const graph = new Map();
  for (const name of readdirSync(dir).filter(name => name.endsWith('.ts'))) {
    const file = path.join(dir, name);
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const dependencies = [];
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      const named = clause?.namedBindings;
      if (named && ts.isNamedImports(named) && named.elements.every(item => item.isTypeOnly)) continue;
      const specifier = statement.moduleSpecifier.text;
      assert.match(specifier, /^\.\/[^/]+\.ts$/, `${name}: direct domain modules only (${specifier})`);
      const dependency = path.resolve(dir, specifier);
      assert.ok(existsSync(dependency));
      dependencies.push(dependency);
    }
    graph.set(file, dependencies);
  }
  const visited = new Set();
  const visit = (file, stack = []) => {
    assert.ok(!stack.includes(file), `Runtime cycle: ${[...stack, file].map(file => path.basename(file)).join(' -> ')}`);
    if (visited.has(file)) return;
    for (const dependency of graph.get(file) || []) visit(dependency, [...stack, file]);
    visited.add(file);
  };
  for (const file of graph.keys()) visit(file);
});

test('record updates preserve untouched references used by delta persistence', () => {
  const state = fresh();
  const selected = words.slice(0, 3);
  const session = learning.newSession(state, selected, material, 'daily', '2026-09-21');
  const historical = { ...session, id: 'historical', date: '2026-09-20' };
  state.sessions = { [session.id]: session, [historical.id]: historical };
  state.progress[selected[1].id] = { familiarity: 'new' };
  freeze(state);
  const next = learning.applyRecord(state, session, session.ids[0], { meaning: '오늘 공부한 뜻' }, true, '2026-09-21');
  assert.equal(next.settings, state.settings);
  assert.equal(next.sessions.historical, historical);
  assert.equal(next.progress[selected[1].id], state.progress[selected[1].id]);
  assert.equal(next.sessions[session.id].records[session.ids[1]], session.records[session.ids[1]]);
  assert.notEqual(next.sessions[session.id], session);
  const delta = stateDelta(state, next);
  assert.deepEqual(Object.keys(delta.sessions), [session.id]);
  assert.deepEqual(Object.keys(delta.progress), [session.ids[0]]);
  assert.equal(session.records[session.ids[0]].meaning, '선택한 뜻');
});

test('resuming an unchanged review and pausing optional practice preserve no-op identity', () => {
  const state = fresh();
  const daily = learning.newSession(state, words.slice(0, 3), material, 'daily', '2026-09-21');
  state.sessions[daily.id] = daily;
  const review = learning.newSession(state, words, material, 'weekly', '2026-09-21');
  state.sessions[review.id] = review;
  freeze(state);
  assert.equal(learning.extendReviewSession(state, words, review, material), review);
  assert.equal(learning.ensureCarryover(state, { ...review, kind: 'practice', practiceMode: 'known' }), state);
  assert.deepEqual(stateDelta(state, state), { settings: undefined, progress: {}, sessions: {} });
});
