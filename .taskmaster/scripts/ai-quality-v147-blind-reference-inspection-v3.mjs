import assert from 'node:assert/strict';
import { validateV3Output } from './ai-quality-v147-wire-v3.mjs';

export const contextReviewInstruction = 'Judge ORIGINAL grammar independently of correction context. Keep natural for grammatical originals, needs_work for visible defects, and uncertain only when original grammaticality cannot be judged. An unresolved time, quantity, message or relationship prohibits choosing a correction; known grammar defects can leave edits empty with any needed context kind. Target-only uncertainty may accompany an independently justified grammar correction. Natural grammar originals stay unchanged. With enough context, give exact minimal edits for grammar needs_work.';

export function inspectBlindReferenceV3(slot, response) {
  const wire = validateV3Output(slot.requestRaw, JSON.stringify(response));
  const { assignment, sources } = JSON.parse(JSON.parse(slot.requestRaw).input[0].content);
  const sourceIds = sources.map(source => source.id);
  assert.deepEqual(slot.sourceIds, sourceIds);
  assert.equal(new Set(wire.sourcesUsed).size, wire.sourcesUsed.length);
  assert.ok(wire.sourcesUsed.every(id => sourceIds.includes(id)));
  if (wire.sourceCoverage === 'sufficient') assert.ok(wire.sourcesUsed.length);

  const needsContext = wire.contextNeeded !== 'none';
  const uncertain = wire.grammar === 'uncertain' || wire.meaningUsage === 'uncertain';
  assert.ok(!uncertain || needsContext);
  if (wire.grammar === 'uncertain' || wire.grammar === 'natural') assert.equal(wire.edits.length, 0);
  const withheld = wire.grammar === 'needs_work' && needsContext && wire.edits.length === 0;
  if (wire.grammar === 'needs_work') assert.ok(wire.edits.length > 0 || withheld);
  if (wire.edits.length) assert.ok(!needsContext || wire.contextNeeded === 'target_meaning', 'edits with unresolved intent');

  const sentence = assignment.sentence;
  const spans = wire.edits.map(({ before, after }) => {
    const start = sentence.indexOf(before);
    assert.ok(start >= 0 && sentence.indexOf(before, start + 1) < 0 && before !== after);
    return { start, end: start + before.length, after };
  }).sort((a, b) => a.start - b.start);
  assert.ok(spans.every((span, index) => index === 0 || spans[index - 1].end <= span.start));
  let correction = sentence;
  for (const span of spans.reverse()) {
    correction = correction.slice(0, span.start) + span.after + correction.slice(span.end);
  }
  assert.ok(correction.length <= 2000 && (needsContext || correction.trim().length > 0));
  return { ...wire, correction: wire.grammar === 'uncertain' || withheld ? '' : correction };
}

export function compareBlindReferencesV3(leftSlot, rightSlot, responses) {
  assert.equal(leftSlot.caseId, rightSlot.caseId);
  assert.notEqual(leftSlot.reviewer, rightSlot.reviewer);
  if (responses.length !== 2 || responses.some(response => response === null)) return 'held-missing';
  const left = inspectBlindReferenceV3(leftSlot, responses[0]);
  const right = inspectBlindReferenceV3(rightSlot, responses[1]);
  if (left.sourceCoverage !== 'sufficient' || right.sourceCoverage !== 'sufficient') return 'held-source';
  const axes = ['grammar', 'meaningUsage', 'contextNeeded', 'correction'];
  return axes.every(axis => left[axis] === right[axis]) ? 'agreement-needs-admission' : 'held-disagreement';
}
