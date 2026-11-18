import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { JUDGES, digest } from './ai-quality-v147-calibration.mjs';
import { normalizeCapturedAssessmentInputV1 } from './ai-quality-v147-assessment-context-v1.mjs';
import { parseV3Json } from './ai-quality-v147-wire-v3.mjs';

// This handoff reads frozen v8 templates without rebuilding the historical rubric from mutable product files.
const MAIN_RUBRIC_HASH_V8 = 'bbb3f66845b43403d7b404e7c7b3df86e119ec448c066150fdfb68fe6062d5f0';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const profiles = ['baseline', 'candidate'];
const feedbackFields = ['original', 'meaningUsage', 'grammar', 'correctedSentence', 'explanation'];
const countFields = ['model', 'instructions', 'input', 'text', 'reasoning'];
export const pilotGenerationIdV1 = slot => [slot.caseId, slot.phase, slot.model].join('/');

function reviewRequestId(binding, requestSha256) {
  const bytes = Buffer.from(hash(`${binding}/${requestSha256}`).slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = bytes.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function visibleEvidence(feedback, screen, input) {
  assert.deepEqual(Object.keys(screen).sort(), ['correctedSentence', 'explanation', 'headings']);
  assert.ok(Array.isArray(screen.headings) && screen.headings.length >= 2 && screen.headings.every(s => typeof s === 'string' && s.length > 0));
  assert.equal(typeof screen.explanation, 'string');
  assert.ok(screen.explanation.length > 0);
  const correction = feedback.correctedSentence;
  if (screen.correctedSentence === null) {
    assert.ok(!correction || correction.trim() === input.sentence.trim(), 'A changed repair disappeared');
  } else assert.equal(screen.correctedSentence, correction, 'Visible repair differs from the app receipt');
  return screen;
}

function previewReference(note, requestInput) {
  if (!note) return { level: 'unresolved', criterion: 'Evaluate the shown feedback and supplied assignment under the rubric.', sources: [] };
  assert.equal(note.requestInputHash, digest(requestInput), 'Reference notes belong to a different assignment');
  assert.ok(typeof note.criterion === 'string' && note.criterion.trim().length > 0 && note.criterion.length <= 2000);
  assert.ok(Array.isArray(note.sources) && note.sources.length > 0 && note.sources.length <= 4);
  for (const source of note.sources) {
    assert.deepEqual(Object.keys(source).sort(), ['checkedAt', 'contentSha256', 'excerpt', 'url']);
    assert.match(source.url, /^https:\/\//);
    assert.match(source.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(source.contentSha256, /^[a-f0-9]{64}$/);
    assert.ok(typeof source.excerpt === 'string' && source.excerpt.trim().length > 0 && source.excerpt.length <= 800);
    assert.equal(source.contentSha256, digest({ url: source.url, excerpt: source.excerpt, checkedAt: source.checkedAt,
      digestScope: 'checked-source-paraphrase' }), 'Reference source note changed');
  }
  return { level: 'source-supported', criterion: note.criterion, sources: note.sources };
}

// This prepares exact review/count bodies only. A caller-supplied record is
// never treated as authenticated paid usage or as reference qualification.
export function compilePilotReviewHandoffV1({ slots, bank, calibrationTemplates, captures, rendered, runId, salt, referenceNotes = new Map() }) {
  assert.match(runId, /^[a-f0-9-]{36}$/);
  assert.ok(Buffer.isBuffer(salt) && salt.length >= 32);
  assert.equal(calibrationTemplates.length, 72);
  const staticTemplates = new Map();
  let rubricDigest;
  for (const slot of calibrationTemplates) {
    assert.equal(slot.kind, 'calibration');
    assert.equal(hash(slot.requestRaw), slot.requestSha256);
    assert.ok(JUDGES.includes(slot.model) && ['input-first', 'feedback-first'].includes(slot.layout));
    const { model, input, ...template } = parseV3Json(slot.requestRaw, 131072);
    assert.equal(model, slot.model);
    assert.ok(input.length === 1 && input[0].role === 'user');
    assert.equal(template.max_output_tokens, 1024);
    assert.equal(template.text.format.name, 'haru_assessment_boundaries_v1');
    assert.deepEqual(template.text.format.schema.properties.productRubricHash.enum, [MAIN_RUBRIC_HASH_V8]);
    const fingerprint = digest(template);
    rubricDigest ??= fingerprint;
    assert.equal(rubricDigest, fingerprint, 'Static calibration templates differ');
    staticTemplates.set(`${model}/${slot.layout}`, template);
  }
  assert.equal(staticTemplates.size, 6);
  const cases = new Map(bank.map(row => [row.id, row]));
  assert.equal(bank.length, 60);
  assert.equal(cases.size, bank.length);
  assert.ok(referenceNotes instanceof Map && [...referenceNotes.keys()].every(id => cases.has(id)), 'Unplanned reference note');
  assert.equal(slots.length, 360);
  const byId = new Map(slots.map(slot => [pilotGenerationIdV1(slot), slot]));
  assert.equal(byId.size, slots.length);
  for (const id of cases.keys()) for (const phase of profiles) for (const model of JUDGES) {
    assert.ok(byId.has([id, phase, model].join('/')), 'A planned generation is missing');
  }
  const byCapture = new Map(captures.map(c => [c.id, c]));
  assert.equal(byCapture.size, captures.length, 'Duplicate parent capture');
  assert.ok(captures.every(c => byId.has(c.id)), 'Unplanned parent capture');
  const usedScreens = new Set();
  const observations = slots.map(slot => {
    const id = pilotGenerationIdV1(slot), row = cases.get(slot.caseId), parent = byCapture.get(id);
    const body = parseV3Json(slot.requestRaw);
    const requestInput = parseV3Json(body.input[0].content);
    assert.equal(hash(slot.requestRaw), slot.requestSha256);
    assert.equal(body.model, slot.model);
    assert.deepEqual(requestInput, slot.actualInput);
    assert.equal(row.domain, slot.domain);
    assert.equal(requestInput.sentence, row.input.sentence);
    if (parent) {
      assert.equal(parent.requestSha256, slot.requestSha256, 'Parent request does not match the frozen body');
      assert.equal(parent.model, slot.model);
      assert.equal(parent.caseId, slot.caseId);
      assert.equal(parent.phase, slot.phase);
      assert.ok(parent.dataClass === 'synthetic' && /^[a-f0-9]{64}$/.test(parent.providerResponseSha256));
      assert.ok(parent.receipt?.persisted === true && parent.receipt.requestId === parent.requestId);
      assert.deepEqual(parent.readbackReceipt, parent.receipt);
      assert.ok(parent.duplicateSuppressed === true && parent.otherOwnerHeld === true);
      assert.ok(parent.state === 'completed' || parent.state === 'failed');
      assert.equal(parent.receipt.state, parent.state);
    }
    const available = parent?.state === 'completed';
    let feedback = null;
    if (available) {
      const record = parent.feedback;
      assert.deepEqual(record, parent.readbackFeedback);
      assert.equal(record.original, requestInput.sentence);
      assert.equal(record.requestedModel, slot.model);
      assert.equal(record.promptVersion, slot.productPromptVersion);
      assert.equal(record.validationVersion, slot.productValidationVersion);
      assert.equal(record.provider, 'openai');
      assert.match(record.contextFingerprint, /^[a-f0-9]{64}$/);
      feedback = Object.fromEntries(feedbackFields.map(k => [k, record[k]]));
      visibleEvidence(feedback, rendered.get(id), requestInput);
      usedScreens.add(id);
    } else if (parent) assert.ok(parent.feedback === null && parent.readbackFeedback === null);
    // The panel headline is bounded; the full criterion remains in requestInput.
    const target = slot.domain === 'word' ? `${requestInput.word} ${requestInput.pos} ${requestInput.meaning}` : requestInput.target;
    return { id, generatorId: slot.model, phase: slot.phase, caseId: slot.caseId, familyId: slot.caseId, domain: slot.domain,
      stratum: row.proposedStratum, requestInput, feedback,
      input: { sentence: requestInput.sentence, target, contextKind: requestInput.contextKind ?? 'sentence',
        ...(requestInput.contextNote ? { contextNote: requestInput.contextNote } : {}) },
      parentReceiptHash: digest(parent ?? { missing: true, id, requestSha256: slot.requestSha256 }),
      reference: previewReference(referenceNotes.get(row.id), requestInput) };
  });
  assert.equal(rendered.size, usedScreens.size, 'An unattached screen cannot be reviewed');
  const reviewSlots = observations.flatMap(parent => {
    const input = normalizeCapturedAssessmentInputV1(parent.input, { domain: parent.domain, requestInput: parent.requestInput });
    const { reference } = parent;
    const feedback = parent.feedback === null ? null : rendered.get(parent.id);
    const privateBinding = { sourceId: parent.id, generatorId: parent.generatorId, phase: parent.phase, caseId: parent.caseId,
      parentReceiptHash: parent.parentReceiptHash };
    return JUDGES.filter(judge => judge !== parent.generatorId).flatMap(model => ['input-first', 'feedback-first'].map(layout => {
      const data = layout === 'input-first' ? { input, feedback, reference } : { feedback, reference, input };
      const evidenceHash = digest(data), content = JSON.stringify({ EVALUATION_DATA: data });
      const template = staticTemplates.get(`${model}/${layout}`);
      const { instructions, ...options } = template;
      const body = { model, instructions: instructions + '\nThe feedback contains only learner-visible headings, a displayed correction or null, and an explanation. Interpret those visible fields. Null correction means that no replacement is shown.',
        input: [{ role: 'user', content }], ...options };
      const requestRaw = JSON.stringify(body), requestSha256 = hash(requestRaw);
      const countRequestRaw = JSON.stringify(Object.fromEntries(countFields.map(k => [k, body[k]])));
      assert.ok(Buffer.byteLength(requestRaw) <= 131072);
      assert.ok(!content.includes(parent.id) && !content.includes(parent.parentReceiptHash));
      const blind = createHmac('sha256', salt).update(`${parent.id}/${evidenceHash}`).digest('hex').slice(0, 24);
      const key = `review/${blind}/${model}/${layout}`;
      return { key, requestId: reviewRequestId(`${runId}/${key}`, requestSha256), layout, model, privateBinding,
        evidenceHash, requestRaw, requestSha256, countRequestRaw, countRequestSha256: hash(countRequestRaw),
        readyForRehearsal: feedback !== null, dispatchEligible: false };
    }));
  });
  assert.equal(reviewSlots.length, 1440);
  assert.equal(new Set(reviewSlots.map(s => s.requestId)).size, reviewSlots.length);
  const summary = { plannedGenerations: observations.length, completedLocalParents: usedScreens.size,
    failedLocalParents: captures.filter(c => c.state === 'failed').length, missingLocalParents: slots.length - captures.length,
    plannedReviews: reviewSlots.length, rehearsalReviewBodies: reviewSlots.filter(s => s.readyForRehearsal).length,
    heldReviews: reviewSlots.filter(s => !s.readyForRehearsal).length, calibrationSlotsPreserved: calibrationTemplates.length,
    actualProviderCalls: 0, actualInputCountCalls: 0, referenceQualified: false, calibrationAcceptanceAllowed: false, mainDispatchAuthorized: false };
  return { protocol: 'ai-quality-v147-pilot-review-handoff-v1', summary, reviewSlots,
    planHash: digest({ runId, reviewSlots, summary }) };
}
