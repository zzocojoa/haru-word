import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmatorySurfaceHashV1, countIndividualConfirmationSlotsV1, screenConfirmatoryFamiliesV1 }
  from './ai-quality-v147-confirmation-preflight-v1.mjs';

const base = { domain: 'word', stratum: 'normal' };
const knownScaffolds = [{ id: 'exposed-scaffold', opening: 'At the morning briefing', closing: 'The handover will include' }];
const screen = (cases, evidence = {}) => screenConfirmatoryFamiliesV1({
  cases, knownSurfaceHashes: [], knownFamilyIds: [], knownScaffolds: [], ...evidence,
});

test('a known surface is excluded even when case, spaces, family and stratum are changed', () => {
  const result = screen([{ id: 'alias', domain: 'grammar', stratum: 'normal', sentence: '  The   HALL opened. ', familyId: 'new-id' }],
    { knownSurfaceHashes: [confirmatorySurfaceHashV1('The hall opened.')] });
  assert.deepEqual(result.rows[0].reasons, ['known-development-surface']);
  assert.equal(result.admittedIndependentFamilies, 0);
});

test('both aliases of an exact duplicate are excluded, including across strata', () => {
  const result = screen([
    { ...base, id: 'first', familyId: 'first-family', sentence: 'The hall opened.' },
    { ...base, id: 'second', familyId: 'second-family', stratum: 'needsCorrection', sentence: 'the hall opened.' },
  ]);
  assert.equal(result.excludedCases, 2);
  assert.ok(result.rows.every(row => row.reasons.includes('duplicate-surface-in-candidates')));
});

test('a known family ID remains excluded even when the surface is new', () => {
  const result = screen([{ ...base, id: 'new-text', familyId: 'public-family', sentence: 'We left the hall.' }],
    { knownFamilyIds: ['public-family'] });
  assert.deepEqual(result.rows[0].reasons, ['known-development-family']);
});

test('new IDs and substituted words do not hide a known two-anchor scaffold', () => {
  const result = screen([{ ...base, id: 'renamed', familyId: 'renamed-family',
    sentence: 'At the morning briefing by the kiosk, we checked the lamps. The handover will include a new photo.' }],
  { knownScaffolds });
  assert.deepEqual(result.rows[0].scaffoldIds, ['exposed-scaffold']);
  assert.deepEqual(result.rows[0].reasons, ['known-development-scaffold']);
});

test('a single anchor or reversed anchors do not match the rule and still require review', () => {
  const result = screen([
    { ...base, id: 'partial', sentence: 'At the morning briefing, we shared the result.' },
    { ...base, id: 'reversed', sentence: 'The handover will include the schedule. At the morning briefing we checked it.' },
  ], { knownScaffolds });
  assert.equal(result.excludedCases, 0);
  assert.equal(result.awaitingReview, 2);
  assert.equal(result.admittedIndependentFamilies, 0);
  assert.equal(result.dispatchAuthorized, false);
});

test('invalid inventory inputs, duplicate case IDs and invalid strata are rejected', () => {
  const row = { ...base, id: 'same', sentence: 'The hall opened.' };
  assert.throws(() => screen([row, row]), /Duplicate or invalid case ID/);
  assert.throws(() => screen([{ ...row, stratum: 'invented' }]), /Invalid stratum/);
  assert.throws(() => screen([row], { knownSurfaceHashes: ['invalid'] }), /Invalid exposure hashes/);
  assert.throws(() => screen([row], { knownScaffolds: [...knownScaffolds, ...knownScaffolds] }), /Invalid scaffold ID/);
  assert.throws(() => screen([row], { knownScaffolds: [{ ...knownScaffolds[0], closing: '' }] }), /scaffold anchors/);
  assert.throws(() => screen([{ ...row, sentence: '   ' }]), /Empty sentence/);
});

test('individual judging reproduces the pilot and preserves the approved independent family minimum', () => {
  const count = (families, repetitions, variantsPerFamily = 1) => countIndividualConfirmationSlotsV1({
    familiesPerStratum: Array(6).fill(families), repetitions, variantsPerFamily,
  });
  const pilot = count(10, 1);
  assert.deepEqual([pilot.familyUnits, pilot.generation, pilot.individualReviews], [60, 360, 1440]);
  const confirmation = count(770, 2);
  assert.deepEqual([confirmation.familyUnits, confirmation.generation, confirmation.individualReviews,
    confirmation.generationAndReviewSlots], [4620, 55440, 221760, 277200]);
  const variants = count(770, 2, 2);
  assert.equal(variants.familyUnits, confirmation.familyUnits);
  assert.equal(variants.generationAndReviewSlots, confirmation.generationAndReviewSlots * 2);
  assert.equal(confirmation.dispatchAuthorized, false);
});
