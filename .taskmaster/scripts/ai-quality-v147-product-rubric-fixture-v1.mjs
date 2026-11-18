// Owned synthetic fixture only. Existing source references/expectations are not qualified here.
import {createHash} from 'node:crypto';
import {countedFixtureV1} from './ai-quality-v147-input-count-fixture-v1.mjs';
import {compileAiPanel} from './ai-quality-v147-ai-panel.mjs';
import {productRubricPolicyV1,productRubricComponentV1,PRODUCT_RUBRIC_HASH_V1} from './ai-quality-v147-product-rubric-v1.mjs';
import {withCalibrationAdmissionV1} from './ai-quality-v147-calibration-admission-v1.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {digest,compileBudgetV3} from './ai-quality-v147-budget-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
export function productPanelFixtureV1({caseCount = 1, requireCurrentQualification = false} = {}) {
  const b = countedFixtureV1({stage: 'pilot-panel', caseCount});
  b.reportInputs.contract.productOperationalRubric = productRubricPolicyV1();
  if (requireCurrentQualification) b.reportInputs = withCalibrationAdmissionV1(b.reportInputs);
  const inputs = b.reportInputs;
  const plan = compileAiPanel({runId: b.spec.runId, observations: b.spec.requests.filter(d => d.role === 'generation').map(d => {
    const c = inputs.cases.find(c => c.id === d.caseId);
    return {id: d.key, generatorId: d.generatorId, phase: d.phase, caseId: c.id, familyId: c.familyId, domain: c.domain, stratum: c.stratum,
      input: c.input, reference: c.reference, feedback: null, parentReceiptHash: digest('synthetic-future-capture')};
  }), witnesses: inputs.witnesses, contract: inputs.contract});
  for (const d of b.spec.requests) {
    if (!['review', 'calibration'].includes(d.role)) continue;
    const slot = plan.slots.find(s => d.role === 'review'
      ? s.kind === 'review' && s.privateBinding.sourceId === d.parentKey && s.judgeId === d.modelId && s.layout === d.layout
      : s.kind === 'calibration' && s.privateBinding.witnessId === d.caseId && s.judgeId === d.modelId && s.layout === d.layout);
    b.wires[d.key] = d.bodyKind === 'static' ? {raw: slot.raw} : {templateRaw: slot.raw}; d.bodyHash = sha(slot.raw);
    const v = JSON.parse(b.responses[d.key]); v.productRubricHash = PRODUCT_RUBRIC_HASH_V1; b.responses[d.key] = JSON.stringify(v);
  }
  b.current.components.rubric = digest(inputs.contract);
  b.current.components.aiPanelPolicy = productRubricComponentV1();
  b.current.components.requestBuilder = digest({base: b.current.components.requestBuilder, productOperationalRubric: productRubricPolicyV1()});
  b.current.components.collectionPolicy = collectionPolicyV3(b.spec.profile.stage, inputs);
  const {sourceSeal: _oldSeal, ...outline} = b.spec; void _oldSeal;
  b.current.components.limits = digest(outline);
  b.seal = sealV3Wire(b.current); b.spec.sourceSeal = b.seal.hash;
  b.approval = v3SyntheticApproval(compileBudgetV3(b.spec)); return b;
}
