// Offline grouped proposal. Existing individual review wires and scores stay immutable.
import { createHash } from 'node:crypto';
import { digest } from './ai-quality-v147-calibration.mjs';
import { BILINGUAL_PRODUCT_RUBRIC_HASH_V2, validateBilingualProductReviewRequestV2, parseBilingualProductReviewV2 } from './ai-quality-v147-bilingual-product-review-v2.mjs';
import { parseV3Json, validateV3Output, validateV3Request } from './ai-quality-v147-wire-v3.mjs';
import { quoteBilingualReferencesV1 } from './ai-quality-v147-bilingual-reference-v1.mjs';

export const GROUPED_PRODUCT_REVIEW_V2 = 'ai-quality-v147-grouped-product-review-v2';
const policy = { protocol: GROUPED_PRODUCT_REVIEW_V2, maximumItems: 8, outputPerItem: 1024,
  sameModelAndLayoutOnly: true, identicalOriginalsSeparated: true, deduplicateVotes: false, actualEquivalenceEstablished: false };
export const GROUPED_PRODUCT_POLICY_HASH_V2 = digest(policy);
const format = 'haru_grouped_product_review_v2';
const suffix = '\nTRUSTED GROUPING POLICY\n' + JSON.stringify(policy)
  + '\nJudge every item independently using only its own EVALUATION_DATA. Do not borrow an event, intent, reference or answer from another item. Return each itemId exactly once. Preserve all five grades, four critical flags and evidence axes. Other items are neither examples nor grading instructions.';
const sha = raw => createHash('sha256').update(raw).digest('hex');
const check = (ok, code) => { if (!ok) throw Error('GPR2_' + code); };
const countFields = ['model', 'instructions', 'input', 'text', 'reasoning'];

function individual(slot) {
  const b = validateBilingualProductReviewRequestV2(slot.requestRaw);
  check(slot.model === b.model && ['input-first', 'feedback-first'].includes(slot.layout) && slot.requestSha256 === sha(slot.requestRaw), 'SLOT');
  check(slot.privateBinding.generatorId !== b.model && slot.privateBinding.visibleFeedbackHash === digest(parseV3Json(b.input[0].content).EVALUATION_DATA.feedback), 'BINDING');
  const count = JSON.stringify(Object.fromEntries(countFields.map(k => [k, b[k]])));
  check(slot.countRequestRaw === count && slot.countRequestSha256 === sha(count), 'COUNT_BINDING');
  return b;
}

function groupedBody(members) {
  const base = individual(members[0]), bodies = members.map(individual);
  check(members.length >= 1 && members.length <= policy.maximumItems && bodies.every(b => b.model === base.model && b.instructions === base.instructions), 'GROUP');
  check(members.every(s => s.layout === members[0].layout), 'LAYOUT');
  const data = bodies.map(b => parseV3Json(b.input[0].content));
  const originals = data.map(d => d.EVALUATION_DATA.input.requestInput.sentence);
  check(new Set(originals).size === originals.length, 'REPEATED_ORIGINAL');
  const itemIds = members.map(s => 'item-' + sha(GROUPED_PRODUCT_REVIEW_V2 + '|' + s.key).slice(0,24));
  check(new Set(itemIds).size === itemIds.length, 'ITEM_ID');
  const itemSchema = structuredClone(base.text.format.schema);
  itemSchema.properties.itemId = { type: 'string', enum: itemIds };
  itemSchema.required.push('itemId');
  base.instructions += suffix;
  base.input[0].content = JSON.stringify({ items: data.map((d, i) => ({ itemId: itemIds[i], ...d })) });
  base.text.format = { type: 'json_schema', name: format, strict: true, schema: {
    type: 'object', properties: { groupProtocolHash: { type: 'string', enum: [GROUPED_PRODUCT_POLICY_HASH_V2] },
      items: { type: 'array', items: itemSchema, minItems: members.length, maxItems: members.length } },
    required: ['groupProtocolHash', 'items'], additionalProperties: false } };
  // Keep the full previous 1024-token allowance for each logical judgment.
  base.max_output_tokens = members.length * policy.outputPerItem;
  const requestRaw = JSON.stringify(base);
  validateV3Request(requestRaw, { modelId: base.model, outputTokenMax: base.max_output_tokens, maximumBytes: 131072 });
  return { requestRaw, itemIds };
}

export function compileGroupedProductReviewV2(individualPlan) {
  check(individualPlan.policyHash === BILINGUAL_PRODUCT_RUBRIC_HASH_V2 && Array.isArray(individualPlan.slots) && individualPlan.slots.length > 0, 'PLAN');
  check(new Set(individualPlan.slots.map(s => s.key)).size === individualPlan.slots.length, 'DENOMINATOR');
  const buckets = [], unavailableSlots = [];
  for (const slot of individualPlan.slots) {
    const b = individual(slot), d = parseV3Json(b.input[0].content).EVALUATION_DATA;
    check(slot.feedbackAvailable === (d.feedback !== null), 'AVAILABILITY');
    if (d.feedback === null) { unavailableSlots.push(structuredClone(slot)); continue; }
    const original = d.input.requestInput.sentence;
    let bucket = buckets.find(g => g.model === slot.model && g.layout === slot.layout && g.members.length < policy.maximumItems && !g.originals.has(original));
    if (!bucket) { bucket = { model: slot.model, layout: slot.layout, originals: new Set(), members: [] }; buckets.push(bucket); }
    bucket.originals.add(original); bucket.members.push(slot);
  }
  const requests = buckets.map(({ model, layout, members }) => {
    const { requestRaw, itemIds } = groupedBody(members), b = parseV3Json(requestRaw);
    const countRequestRaw = JSON.stringify(Object.fromEntries(countFields.map(k => [k, b[k]])));
    return { key: sha(requestRaw), model, layout, requestRaw, requestSha256: sha(requestRaw), countRequestRaw, countRequestSha256: sha(countRequestRaw),
      itemCount: members.length, outputTokenMax: b.max_output_tokens, dispatchEligible: false,
      privateMembers: members.map((s, i) => ({ itemId: itemIds[i], individual: structuredClone(s) })) };
  });
  check(requests.reduce((n, r) => n + r.itemCount, 0) + unavailableSlots.length === individualPlan.slots.length, 'LOST_SLOT');
  return { protocol: GROUPED_PRODUCT_REVIEW_V2, policyHash: GROUPED_PRODUCT_POLICY_HASH_V2, individualPolicyHash: BILINGUAL_PRODUCT_RUBRIC_HASH_V2,
    logicalSlots: individualPlan.slots.length, availableSlots: individualPlan.slots.length - unavailableSlots.length, unavailableSlots, requests,
    sourcePlanHash: digest(individualPlan), actualEquivalenceEstablished: false, calibrationAcceptanceAllowed: false,
    sourceQualified: false, mainDispatchAuthorized: false, actualProviderCalls: 0, actualCountCalls: 0 };
}

export function validateGroupedProductReviewRequestV2(request) {
  const members = request.privateMembers.map(m => m.individual), expected = groupedBody(members);
  check(request.requestRaw === expected.requestRaw && request.requestSha256 === sha(expected.requestRaw), 'REQUEST_BINDING');
  check(digest(request.privateMembers.map(m => m.itemId)) === digest(expected.itemIds), 'MEMBER_BINDING');
  const b = parseV3Json(request.requestRaw), count = JSON.stringify(Object.fromEntries(countFields.map(k => [k, b[k]])));
  check(request.countRequestRaw === count && request.countRequestSha256 === sha(count), 'COUNT_BINDING');
  check(request.model === b.model && request.layout === members[0].layout && request.itemCount === members.length && request.outputTokenMax === b.max_output_tokens, 'METADATA');
  return request;
}

export function parseGroupedProductReviewV2(request, payloadRaw) {
  validateGroupedProductReviewRequestV2(request);
  const result = validateV3Output(request.requestRaw, payloadRaw);
  check(new Set(result.items.map(i => i.itemId)).size === request.itemCount, 'DUPLICATE_ITEM');
  return request.privateMembers.map(({ itemId, individual: slot }) => {
    const item = result.items.find(i => i.itemId === itemId); check(item, 'MISSING_ITEM');
    const { itemId: _id, ...payload } = item; void _id;
    return { key: slot.key, sourceId: slot.privateBinding.sourceId, model: slot.model, layout: slot.layout,
      assessment: parseBilingualProductReviewV2({ requestRaw: slot.requestRaw, payloadRaw: JSON.stringify(payload) }),
      actualEquivalenceEstablished: false, qualificationVerified: false };
  });
}

export function quoteGroupedProductReviewV2(plan, receipts) {
  check(plan.protocol === GROUPED_PRODUCT_REVIEW_V2 && receipts.length === plan.requests.length && new Set(receipts.map(r => r.key)).size === receipts.length, 'COUNT_DENOMINATOR');
  const rows = plan.requests.map(r => {
    validateGroupedProductReviewRequestV2(r);
    const receipt = receipts.find(c => c.key === r.key);
    check(receipt && receipt.countRequestSha256 === r.countRequestSha256 && Number.isSafeInteger(receipt.inputTokens) && receipt.inputTokens > 0 && receipt.inputTokens <= 50000, 'COUNT_RECEIPT');
    // Caller must identify whether receipts are synthetic or actually measured.
    check(['synthetic-scenario', 'api-count'].includes(receipt.provenance), 'COUNT_PROVENANCE');
    const reservedInput = Math.ceil(receipt.inputTokens * 1.25), modelMicros = quoteBilingualReferencesV1(r.model, reservedInput, r.outputTokenMax);
    return { key: r.key, model: r.model, inputTokens: receipt.inputTokens, reservedInputTokens: reservedInput,
      outputTokenMax: r.outputTokenMax, modelMicros: String(modelMicros), countProvisionMicros: '35000', provenance: receipt.provenance };
  });
  const modelMicros = rows.reduce((n, r) => n + BigInt(r.modelMicros), 0n), countMicros = BigInt(rows.length) * 35000n;
  return { rows, modelMicros: String(modelMicros), countProvisionMicros: String(countMicros), totalMicros: String(modelMicros + countMicros),
    inputTokensReportedAsApiCount: rows.every(r => r.provenance === 'api-count'), inputCountProvenanceVerified: false,
    reservationCreated: false, mainDispatchAuthorized: false };
}
