import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PANEL_LAYOUTS } from './ai-quality-v147-ai-panel.mjs';
import { JUDGES } from './ai-quality-v147-calibration.mjs';
import { normalizedExposureSentenceV1 } from './ai-quality-v147-exposure-v1.mjs';
import { CONFIRMATORY_STRATA, confirmationCalls } from './ai-quality-v147-risk-design.mjs';

const isId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function confirmatorySurfaceHashV1(sentence) {
  assert.ok(typeof sentence === 'string' && sentence.isWellFormed() && sentence.length <= 2000, 'Invalid sentence');
  const normalized = normalizedExposureSentenceV1(sentence);
  assert.ok(normalized.length > 0, 'Empty sentence');
  return createHash('sha256').update(normalized).digest('hex');
}

// Known evidence can exclude a case. A clean screen is held for independent family review.
export function screenConfirmatoryFamiliesV1({ cases, knownSurfaceHashes, knownFamilyIds, knownScaffolds }) {
  assert.ok(Array.isArray(cases) && cases.length > 0, 'Missing cases');
  assert.ok(Array.isArray(knownSurfaceHashes) && knownSurfaceHashes.every(isHash), 'Invalid exposure hashes');
  assert.ok(Array.isArray(knownFamilyIds) && knownFamilyIds.every(isId), 'Invalid exposed family IDs');
  assert.ok(Array.isArray(knownScaffolds), 'Missing scaffold rules');
  const scaffoldIds = new Set();
  const scaffolds = knownScaffolds.map(rule => {
    assert.ok(rule && isId(rule.id) && !scaffoldIds.has(rule.id), 'Invalid scaffold ID');
    const { opening, closing } = rule;
    assert.ok([opening, closing].every(text => typeof text === 'string' && text.isWellFormed()), 'Invalid scaffold anchors');
    const first = normalizedExposureSentenceV1(opening), last = normalizedExposureSentenceV1(closing);
    assert.ok(first.length > 0 && last.length > 0 && first !== last, 'Missing or identical scaffold anchors');
    scaffoldIds.add(rule.id);
    return { id: rule.id, opening: first, closing: last };
  });
  const exposedSurfaces = new Set(knownSurfaceHashes), exposedFamilies = new Set(knownFamilyIds);
  const caseIds = new Set(), caseGroups = new Map();
  const input = cases.map(row => {
    assert.ok(row && isId(row.id) && !caseIds.has(row.id), 'Duplicate or invalid case ID');
    const stratum = `${row.domain}.${row.stratum}`;
    assert.ok(CONFIRMATORY_STRATA.includes(stratum), 'Invalid stratum');
    assert.ok(row.familyId === undefined || isId(row.familyId), 'Invalid declared family ID');
    caseIds.add(row.id);
    const surfaceHash = confirmatorySurfaceHashV1(row.sentence);
    caseGroups.set(surfaceHash, (caseGroups.get(surfaceHash) ?? 0) + 1);
    return { ...row, stratum, surfaceHash };
  });
  const rows = input.map(({ id, familyId, sentence, stratum, surfaceHash }) => {
    const normalized = normalizedExposureSentenceV1(sentence);
    const scaffoldIds = scaffolds.filter(({ opening, closing }) => {
      const start = normalized.indexOf(opening);
      return start >= 0 && normalized.indexOf(closing, start + opening.length) >= 0;
    }).map(rule => rule.id);
    const reasons = [];
    if (exposedSurfaces.has(surfaceHash)) reasons.push('known-development-surface');
    if (exposedFamilies.has(familyId)) reasons.push('known-development-family');
    if (caseGroups.get(surfaceHash) > 1) reasons.push('duplicate-surface-in-candidates');
    if (scaffoldIds.length) reasons.push('known-development-scaffold');
    return { id, stratum, surfaceHash, scaffoldIds, reasons,
      status: reasons.length ? 'excluded' : 'awaiting-independent-family-review' };
  });
  return {
    rows, excludedCases: rows.filter(row => row.status === 'excluded').length,
    awaitingReview: rows.filter(row => row.status === 'awaiting-independent-family-review').length,
    admittedIndependentFamilies: 0, independenceVerified: false, dispatchAuthorized: false,
  };
}

export function countIndividualConfirmationSlotsV1({ familiesPerStratum, variantsPerFamily, repetitions }) {
  const design = confirmationCalls({ familiesPerStratum, variantsPerFamily, repetitions, calibrationCalls: 0 });
  assert.equal(JUDGES.length, design.models);
  const reviewsPerGeneration = (JUDGES.length - 1) * PANEL_LAYOUTS.length;
  const individualReviews = design.generation * reviewsPerGeneration;
  const generationAndReviewSlots = design.generation + individualReviews;
  assert.ok(Number.isSafeInteger(generationAndReviewSlots), 'Individual request count overflow');
  return {
    familyUnits: design.independentFamilyUnits, generation: design.generation, reviewsPerGeneration,
    individualReviews, generationAndReviewSlots,
    excludesReferenceReviewCalibrationAndInputCounts: true, dispatchAuthorized: false,
  };
}
