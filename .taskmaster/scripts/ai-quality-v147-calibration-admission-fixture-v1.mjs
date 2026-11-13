// Current source-qualification profile applied to a synthetic transport fixture.
// This is neither a paid runner nor an approval or a qualified reference set.
import {panelFixtureV3} from './ai-quality-v147-panel-fixture-v3.mjs';
import {withCalibrationAdmissionV1} from './ai-quality-v147-calibration-admission-v1.mjs';
import {collectionPolicyV3} from './ai-quality-v147-panel-report-v3.mjs';
import {sealV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';
import {v3SyntheticApproval} from './ai-quality-v147-budget-v3-fixture.mjs';
export function withCalibrationAdmissionFixtureV1(bundle){
 const b=structuredClone(bundle);b.reportInputs=withCalibrationAdmissionV1(b.reportInputs);b.current.components.rubric=digest(b.reportInputs.contract);b.current.components.collectionPolicy=collectionPolicyV3(b.spec.profile.stage,b.reportInputs);
 const {sourceSeal:_old,...outline}=b.spec;void _old;b.current.components.limits=digest(outline);b.seal=sealV3Wire(b.current);b.spec.sourceSeal=b.seal.hash;b.approval=v3SyntheticApproval(compileBudgetV3(b.spec));return b;
}
export function calibrationAdmissionFixtureV1(options={}){return withCalibrationAdmissionFixtureV1(panelFixtureV3(options));}
