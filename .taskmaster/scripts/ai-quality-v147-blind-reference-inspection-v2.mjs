import assert from 'node:assert/strict';
import { validateV3Output } from './ai-quality-v147-wire-v3.mjs';

export const contextReviewInstruction = 'Judge original grammar separately from whether a repair is possible. If a visible grammar error or incomplete sentence is certain, use grammar needs_work even when context is needed to repair it. If an axis cannot be judged or the exercise explicitly withholds that judgment for incomplete input, mark it uncertain. Name the missing context and leave edits empty whenever context is needed. With enough context, give exact edits for grammar needs_work.';

export function inspectBlindReferenceV2(slot, response) {
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
  assert.ok(!needsContext || uncertain || wire.grammar === 'needs_work');
  assert.equal(wire.edits.length > 0, wire.grammar === 'needs_work' && !needsContext);

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
  return { ...wire, correction: needsContext ? '' : correction };
}

export function compareBlindReferencesV2(leftSlot, rightSlot, responses) {
  assert.equal(leftSlot.caseId, rightSlot.caseId);
  assert.notEqual(leftSlot.reviewer, rightSlot.reviewer);
  if (responses.length !== 2 || responses.some(response => response === null)) return 'held-missing';
  const left = inspectBlindReferenceV2(leftSlot, responses[0]);
  const right = inspectBlindReferenceV2(rightSlot, responses[1]);
  if (left.sourceCoverage !== 'sufficient' || right.sourceCoverage !== 'sufficient') return 'held-source';
  const axes = ['grammar', 'meaningUsage', 'contextNeeded', 'correction'];
  return axes.every(axis => left[axis] === right[axis]) ? 'agreement-needs-admission' : 'held-disagreement';
}
