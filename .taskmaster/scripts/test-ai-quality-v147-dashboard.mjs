import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,copyFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {PROJECT_ROOT,readDashboardSnapshot} from './openai-dashboard-data.mjs';
import {createDashboardServer} from './serve-openai-dashboard.mjs';

const TAG='ai-quality-v147',PLAN='ai-quality-v147-2026-11-06';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const manifest=await json(resolve(PROJECT_ROOT,`.taskmaster/docs/${TAG}-manifest.json`));
const root=resolve(manifest.baseline.existingDashboardRoot),out=resolve(process.env.QA_OUTPUT_DIR||resolve(root,'outputs/ai-quality-v147-implementation-20261106/dashboard'));
const fixedReview=manifest.actualAppProductReviewExecutionFile?await json(resolve(root,manifest.actualAppProductReviewExecutionFile)):null;
const negativeControls=manifest.negativeControlsExecutionFile?await json(resolve(root,manifest.negativeControlsExecutionFile)):null;
const calibrationRemainder=manifest.calibrationRemainderExecutionFile?await json(resolve(root,manifest.calibrationRemainderExecutionFile)):null;
const withholdingReview=manifest.withholdingReviewPreparationFile?await json(resolve(root,manifest.withholdingReviewPreparationFile)):null;
const v10Live=manifest.v10LiveExecutionFile?await json(resolve(root,manifest.v10LiveExecutionFile)):null;
const v10Rebind=manifest.productReviewV10RebindFile?await json(resolve(root,manifest.productReviewV10RebindFile)):null;
const v10Sources=manifest.sourceReviewV10ExecutionFile?await json(resolve(root,manifest.sourceReviewV10ExecutionFile)):null;
const v10Acceptance=manifest.currentCalibrationAcceptanceFile?await json(resolve(root,manifest.currentCalibrationAcceptanceFile)):null;
const bilingualReferenceRecords=manifest.bilingualReferenceRecordPreparationFile?await json(resolve(root,manifest.bilingualReferenceRecordPreparationFile)):null;
const currentExposureSources=manifest.currentExposureSourcePreparationFile?await json(resolve(root,manifest.currentExposureSourcePreparationFile)):null;
const referenceRoleCalibration=manifest.referenceRoleCalibrationExecutionFile?await json(resolve(root,manifest.referenceRoleCalibrationExecutionFile)):null;
const referenceRoleCompact=manifest.referenceRoleCompactExecutionFile?await json(resolve(root,manifest.referenceRoleCompactExecutionFile)):null;
const currentProgramTemplates=manifest.currentProgramTemplatesPreparationFile?await json(resolve(root,manifest.currentProgramTemplatesPreparationFile)):null;
const developmentFamilies=manifest.developmentFamilyPreparationFile?await json(resolve(root,manifest.developmentFamilyPreparationFile)):null;
const postJointDraft=manifest.postJointCohortDraftPreparationFile?await json(resolve(root,manifest.postJointCohortDraftPreparationFile)):null;
const postJointCapture=manifest.postJointBodyCaptureFile?await json(resolve(root,manifest.postJointBodyCaptureFile)):null;
const postJointLanguage=manifest.postJointLanguageReviewPreparationFile?await json(resolve(root,manifest.postJointLanguageReviewPreparationFile)):null;
const postJointWord=manifest.postJointWordLanguageExecutionFile?await json(resolve(root,manifest.postJointWordLanguageExecutionFile)):null;
const postJointGrammar=manifest.postJointGrammarLanguageExecutionFile?await json(resolve(root,manifest.postJointGrammarLanguageExecutionFile)):null;
const postJointSources=manifest.postJointSourceSupplementPreparationFile?await json(resolve(root,manifest.postJointSourceSupplementPreparationFile)):null;
const postJointRecheck=manifest.postJointSourceRecheckExecutionFile?await json(resolve(root,manifest.postJointSourceRecheckExecutionFile)):null;
const postJointCandidates=manifest.postJointReferenceCandidatePreparationFile?await json(resolve(root,manifest.postJointReferenceCandidatePreparationFile)):null;
const postJointFamily=manifest.postJointStructuralFamilyReviewExecutionFile?await json(resolve(root,manifest.postJointStructuralFamilyReviewExecutionFile)):null;
const currentManagementRecord=manifest.currentManagementEvidenceFile?await json(resolve(root,manifest.currentManagementEvidenceFile)):null;
const contextCandidateHistory=manifest.practical100PreviousDevelopmentCandidate??manifest.currentDevelopmentCandidate;
const dataOnly=process.env.QA_DATA_ONLY==='1';
const url='http://127.0.0.1:4318',require=createRequire(import.meta.url),pw=dataOnly?null:require(process.env.QA_PLAYWRIGHT_PATH||'playwright');
await mkdir(out,{recursive:true});await mkdir(resolve(PROJECT_ROOT,'.sites-runtime'),{recursive:true});
const registry=await json(resolve(root,'.taskmaster/docs/dashboard-plans.json'));
const expectedParents=manifest.registration.tasks,expectedChildren=manifest.registration.subtasks,expectedPlans=registry.plans.length;
const paths=['.taskmaster/tasks/tasks.json','.taskmaster/docs/dashboard-plans.json',...registry.plans.map(p=>p.manifest),'.taskmaster/dashboard/dashboard.js','.taskmaster/dashboard/dashboard.css','.taskmaster/scripts/openai-dashboard-data.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(resolve(root,p))).digest('hex')])));
const before=await hashes(),source=await json(resolve(root,paths[0]));
const expectedTasks=source[TAG].tasks,expectedDone=expectedTasks.flatMap(t=>t.subtasks).filter(t=>t.status==='done').length,expectedPercent=Math.round(expectedDone/expectedChildren*100);
const fixture=await mkdtemp(join(resolve(PROJECT_ROOT,'.sites-runtime'),'ai-quality-plan-dashboard-'));
for(const p of paths){await mkdir(dirname(resolve(fixture,p)),{recursive:true});await copyFile(resolve(root,p),resolve(fixture,p));}
const {server}=createDashboardServer({projectRoot:fixture});await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
const local='http://127.0.0.1:'+server.address().port,checks=[],browsers=[];
const write=async(p,value)=>writeFile(resolve(fixture,p),JSON.stringify(value));
const pass=name=>{checks.push({name,passed:true});console.log('PASS '+name);};
try{
 const live=await(await fetch(url+'/api/tasks')).json(),direct=await readDashboardSnapshot(root);
 assert.equal(live.source.hash,direct.source.hash);assert.equal(live.plan.id,PLAN);assert.equal(live.catalog.plans.length,expectedPlans);
 assert.equal(live.tasks.length,expectedParents);assert.equal(live.tasks.flatMap(t=>t.subtasks).length,expectedChildren);assert.deepEqual(live.tasks.map(t=>[Number(t.id),t.status]),expectedTasks.map(t=>[Number(t.id),t.status]));
 assert.equal(live.plan.gates.find(g=>g.id==='AQ-G3').result.status,'held');assert.equal(live.plan.budget,manifest.execution.dashboardBudget);
 if(manifest.labelStudyExecutionFile){
  const actual=await json(resolve(root,manifest.labelStudyExecutionFile)),ledger=await json(resolve(root,manifest.currentSupplementalLedgerFile||actual.ledgerFile));
  const supplement = manifest.referenceSupplementExecutionFile
    ? await json(resolve(root, manifest.referenceSupplementExecutionFile)) : null;
  const productDiagnostic = manifest.productCorrectionDiagnosticFile
    ? await json(resolve(root, manifest.productCorrectionDiagnosticFile)) : null;
  const completeCorrection = manifest.completeCorrectionLiveFile
    ? await json(resolve(root, manifest.completeCorrectionLiveFile)) : null;
  const firstReferenceWave = manifest.firstReferenceWaveExecutionFile
    ? await json(resolve(root, manifest.firstReferenceWaveExecutionFile)) : null;
  const noorMc12 = manifest.noorMc12ExecutionFile
    ? await json(resolve(root, manifest.noorMc12ExecutionFile)) : null;
  const continuation = manifest.currentContinuationExecutionFile
    ? await json(resolve(root, manifest.currentContinuationExecutionFile)) : null;
  const groupedActual = manifest.blindReferenceGroupsExecutionFile
    ? await json(resolve(root, manifest.blindReferenceGroupsExecutionFile)) : null;
  const bilingualActual = manifest.bilingualReferenceExecutionFile
    ? await json(resolve(root, manifest.bilingualReferenceExecutionFile)) : null;
  const wordAppActual = manifest.wordAppDiagnosticExecutionFile
    ? await json(resolve(root, manifest.wordAppDiagnosticExecutionFile)) : null;
  const availableBeforeSupplement = supplement?.beforeAvailableMicros ?? ledger.availableMicros;
  assert.equal(actual.summary.actualProviderCalls,84);assert.equal(actual.summary.actualCountApiCalls,84);assert.equal(actual.summary.actualKeyReads,1);
  assert.equal(actual.primary.denominator,72);assert.equal(actual.falseClaimTraps.denominator,12);assert.equal(actual.oldMatched,63);assert.equal(actual.oldAxesMatched,71);
  assert.equal(actual.sourceQualified,false);assert.equal(actual.mainDispatchAuthorized,false);assert.equal(actual.englishTruthCertified,false);
  assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,Number(ledger.usedUpperMicros)/1e6);
  assert.match(live.plan.context,/phase78/);assert.match(live.plan.context,/영어정답률아님/);assert.match(live.plan.context,/24\/40/);
  for(const value of ['US$5','US$4.471863','US$0.528137','US$35','US$40'])assert.ok(live.plan.budget.includes(value));
  assert.ok(live.plan.budget.includes('US$'+(Number(ledger.availableMicros)/1e6).toFixed(6)));
  assert.equal(ledger.reservedMicros,'0');assert.equal(ledger.oldLedgersClosed,true);assert.equal(ledger.newGrantCreated,false);
  if(manifest.referenceInterpretationExecutionFile){const ref=await json(resolve(root,manifest.referenceInterpretationExecutionFile));assert.deepEqual([ref.actualProviderCalls,ref.actualCountApiCalls,ref.actualKeyReads],[6,6,1]);assert.equal(ref.fullPilotDenominator,60);assert.equal(ref.substitutesForReferencePipeline,false);assert.equal(ref.sourceQualified,false);assert.equal(ref.mainDispatchAuthorized,false);if(manifest.fixedReferenceExecutionFile){assert.equal(ref.additionalAvailableMicros,'21294801');}else{assert.equal(ref.additionalAvailableMicros,ledger.availableMicros);assert.match(live.plan.context,/phase84/);assert.ok(live.plan.budget.includes('US$'+(Number(ref.stageUsedUpperMicros)/1e6).toFixed(6)));}}
  if(manifest.fixedReferenceExecutionFile){const ref=await json(resolve(root,manifest.fixedReferenceExecutionFile));assert.deepEqual([ref.actualProviderCalls,ref.actualCountApiCalls,ref.actualKeyReads],[55,55,2]);assert.deepEqual([ref.referenceCases,ref.authorRecords,ref.peerReviews],[18,18,36]);assert.equal(ref.referenceDenominator,180);assert.equal(ref.referenceQualified,false);assert.equal(ref.mainDispatchAuthorized,false);if(manifest.fixedReferenceFollowupExecutionFile){assert.equal(ref.additionalAvailableMicros,'15371095');}else{assert.equal(ref.additionalAvailableMicros,ledger.availableMicros);assert.match(live.plan.context,/phase85/);assert.ok(live.plan.budget.includes('US$'+(Number(ref.stageUsedUpperMicros)/1e6).toFixed(6)));}assert.equal(ref.englishTruthCertified,false);}
  if(manifest.fixedReferenceFollowupExecutionFile){const ref=await json(resolve(root,manifest.fixedReferenceFollowupExecutionFile));assert.deepEqual([ref.actualProviderCalls,ref.actualCountApiCalls,ref.actualKeyReads],[161,161,5]);assert.deepEqual([ref.referenceCases,ref.authorRecords,ref.inheritedAuthorRecords,ref.newAuthorRecords,ref.peerReviews],[60,60,19,41,120]);assert.equal(ref.validReviews+ref.invalidReviews,120);assert.equal(ref.priorPeerReviewsPooled,0);assert.equal(ref.referenceQualified,false);assert.equal(ref.mainDispatchAuthorized,false);assert.equal(ref.additionalAvailableMicros,manifest.budgetReconciliationFollowupFile?'3748893':ledger.availableMicros);assert.equal(ref.englishTruthCertified,false);assert.match(live.plan.context,/phase86/);assert.ok(live.plan.budget.includes('US$'+(Number(ref.stageUsedUpperMicros)/1e6).toFixed(6)));}
  if(manifest.budgetReconciliationFollowupFile){const current=await json(resolve(root,manifest.budgetReconciliationFollowupFile)),old=await json(resolve(root,current.oldLedgerFile));assert.equal(current.currentLedgerFile,manifest.currentSupplementalLedgerFile);if(manifest.targetMeaningRerunExecutionFile){assert.equal(current.additionalAvailableMicros,'12828893');assert.equal(current.additionalUsedUpperMicros,'22171107');}else{assert.equal(current.additionalAvailableMicros,ledger.availableMicros);assert.equal(current.additionalUsedUpperMicros,ledger.usedUpperMicros);}assert.deepEqual([current.actualProviderCalls,current.actualCountApiCalls,current.actualKeyReads],[0,0,0]);assert.equal(current.adjustedPriorCountProvisionMicros,'9080000');assert.equal(current.unreleasedNew161CountProvisionMicros,'5635000');assert.equal(current.oldInternalEscrowIsLiveJob,false);assert.equal(old.availableMicros,'0');assert.equal(old.reservedMicros,'3748893');assert.equal(old.allocations.length,13);assert.equal(ledger.protocol,'ai-quality-v147-evaluation-budget-v3');assert.equal(current.mainDispatchAuthorized,false);assert.equal(current.newGrantCreated,false);assert.equal(current.originalFiveDollarReopened,false);assert.match(live.plan.context,manifest.targetMeaningRerunExecutionFile?/phase88/:/phase87/);}
  if(manifest.targetMeaningRerunExecutionFile){const current=await json(resolve(root,manifest.targetMeaningRerunExecutionFile));assert.deepEqual([current.actualProviderCalls,current.actualCountApiCalls,current.actualKeyReads],[84,84,1]);assert.deepEqual([current.primary.denominator,current.primary.matched,current.primary.axesMatched,current.primary.criticalMissVotes],[72,66,72,0]);assert.deepEqual([current.traps.denominator,current.traps.matched],[12,12]);assert.equal(current.primaryRuleSatisfied,false);assert.equal(current.sourceGroundedCriterionConflict,true);assert.equal(current.referenceFiveFlagCalibrationSubstituted,false);assert.equal(current.oldExpectedGradesChanged,false);assert.equal(current.oldCapturedResponsesRegraded,false);assert.equal(current.mainDispatchAuthorized,false);assert.equal(current.englishTruthCertified,false);assert.equal(current.additionalUsedUpperMicros,manifest.meaningContrastExecutionFile?'26421533':ledger.usedUpperMicros);assert.equal(current.additionalAvailableMicros,manifest.meaningContrastExecutionFile?'8578467':ledger.availableMicros);assert.equal(current.reservedMicros,'0');const task=live.tasks.find(x=>x.id==='34');assert.equal(task.status,'in-progress');assert.equal(task.subtasks.find(x=>x.id==='4').status,'in-progress');assert.match(live.plan.context,/66\/72/);assert.match(live.plan.context,/T34.4/);}
  if (manifest.meaningContrastExecutionFile) {
    const current = await json(resolve(root, manifest.meaningContrastExecutionFile));
    assert.equal(current.additionalUsedUpperMicros, manifest.witnessSourceReviewExecutionFile ? '28584154' : ledger.usedUpperMicros);
    assert.equal(current.additionalAvailableMicros, manifest.witnessSourceReviewExecutionFile ? '6415846' : ledger.availableMicros);
    assert.equal(current.reservedMicros, '0');
    assert.equal(current.mainDispatchAuthorized, false);
    assert.equal(current.englishTruthCertified, false);
    assert.match(live.plan.context, /phase91/);
    assert.ok(live.plan.budget.includes('US$' + (Number(current.stageUsedUpperMicros) / 1e6).toFixed(6)));
    if (current.status === 'collected-meaning-contrast') {
      assert.deepEqual([current.actualProviderCalls, current.actualCountApiCalls, current.actualKeyReads], [36, 36, 1]);
      assert.equal(current.pairedDenominator, 18);
      assert.ok(live.plan.context.includes(current.baselineMatched + '/18'));
      assert.ok(live.plan.context.includes(current.candidateMatched + '/18'));
    } else {
      assert.equal(current.status, 'held');
      assert.equal(current.localMeaningRuleMet, false);
      assert.ok(current.actualProviderCalls <= 36 && current.actualCountApiCalls <= 36);
    }
  }
  if (manifest.witnessSourceReviewExecutionFile) {
    const current = await json(resolve(root, manifest.witnessSourceReviewExecutionFile));
    assert.equal(current.status, 'collected-witness-source-review');
    assert.deepEqual([current.actualProviderCalls, current.actualCountApiCalls, current.actualKeyReads], [3, 3, 1]);
    assert.deepEqual([current.candidateDenominator, current.supportedCases, current.controlDenominator, current.controlsPassed], [12, 9, 6, 6]);
    assert.deepEqual(current.disputedCases, ['MC02', 'MC05', 'MC08']);
    assert.equal(current.additionalUsedUpperMicros, manifest.assessmentBoundaryExecutionFile ? '29064247' : ledger.usedUpperMicros);
    assert.equal(current.additionalAvailableMicros, manifest.assessmentBoundaryExecutionFile ? '5935753' : ledger.availableMicros);
    assert.equal(current.reservedMicros, ledger.reservedMicros);
    assert.equal(current.sourceQualified, false);
    assert.equal(current.mainDispatchAuthorized, false);
    assert.match(live.plan.context, /phase95.*9\/12/);
    assert.ok(live.plan.budget.includes('US$' + (Number(current.stageUsedUpperMicros) / 1e6).toFixed(6)));
  }
  if (manifest.assessmentBoundaryPreparationFile) {
    const preparation = await json(resolve(root, manifest.assessmentBoundaryPreparationFile));
    assert.deepEqual([preparation.developmentFamilies, preparation.cases, preparation.pairedSlots], [3, 6, 18]);
    assert.deepEqual([preparation.preparedModelRequests, preparation.preparedCountRequests], [36, 36]);
    assert.deepEqual([preparation.actualProviderCalls, preparation.actualCountApiCalls, preparation.actualReservedMicros], [0, 0, '0']);
    assert.equal(preparation.sourceQualified, false);
    assert.equal(preparation.mainDispatchAuthorized, false);
    assert.match(live.plan.context, /phase96.*v8.*36개 요청 준비/);
  }
  if (manifest.assessmentBoundaryExecutionFile) {
    const current = await json(resolve(root, manifest.assessmentBoundaryExecutionFile));
    assert.deepEqual([current.actualProviderCalls, current.actualCountApiCalls, current.actualKeyReads], [36, 36, 1]);
    assert.deepEqual([current.baselineMatched, current.candidateMatched, current.improvements, current.regressions], [15, 18, 3, 0]);
    assert.equal(current.diagnosticImprovement, true);
    assert.equal(current.sourceQualified, false);
    assert.equal(current.mainDispatchAuthorized, false);
    assert.equal(current.additionalUsedUpperMicros, manifest.mainSourceV8ExecutionFile ? '30884499' : ledger.usedUpperMicros);
    assert.equal(current.additionalAvailableMicros, manifest.mainSourceV8ExecutionFile ? '4115501' : ledger.availableMicros);
    assert.equal(current.reservedMicros, ledger.reservedMicros);
    assert.match(live.plan.context, /phase97.*v7 15\/18.*v8 18\/18/);
    assert.ok(live.plan.budget.includes('US$1.820252'));
  }
  if (manifest.mainPanelV8PreparationFile) {
    const preparation = await json(resolve(root, manifest.mainPanelV8PreparationFile));
    assert.deepEqual([preparation.witnesses, preparation.requests, preparation.waves, preparation.priorV7Supported], [12, 72, 12, 9]);
    assert.equal(preparation.fullReservationUpperMicros, '8567184');
    assert.equal(preparation.waveReservationUpperMicros, '713932');
    assert.equal(preparation.calibrationAcceptanceAllowed, false);
    assert.equal(preparation.mainDispatchAuthorized, false);
    assert.match(live.plan.context, /phase98.*v8.*72개/);
  }
  if (manifest.mainSourceV8ExecutionFile) {
    const current = await json(resolve(root, manifest.mainSourceV8ExecutionFile));
    assert.deepEqual([current.actualProviderCalls, current.actualCountApiCalls, current.actualKeyReads], [3, 3, 1]);
    assert.deepEqual([current.supportedCases.length, current.caseDenominator, current.controlsPassed, current.controlDenominator], [10, 12, 9, 9]);
    assert.deepEqual(current.heldCases, ['MC01', 'MC03']);
    assert.equal(current.sourceQualified, false);
    assert.equal(current.mainDispatchAuthorized, false);
    assert.equal(current.additionalUsedUpperMicros, manifest.renderedReviewExecutionFile ? '31279588' : ledger.usedUpperMicros);
    assert.equal(current.additionalAvailableMicros, manifest.renderedReviewExecutionFile ? '3720412' : ledger.availableMicros);
    assert.equal(current.reservedMicros, ledger.reservedMicros);
    assert.match(live.plan.context, /phase99.*10\/12.*9\/9/);
    assert.ok(live.plan.budget.includes('US$0.395089'));
  }
  if (manifest.withheldGrammarProductEvidenceFile) {
    const product = await json(resolve(root, manifest.withheldGrammarProductEvidenceFile));
    assert.deepEqual([product.pairedRequests, product.savedAndReread, product.builtBrowserChecks, product.legacyRecordsReread], [5, 10, 12, 2]);
    assert.deepEqual([product.unitTests, product.actualProviderCalls, product.productionWrites], [883, 0, 0]);
    assert.equal(product.newModelQualityVerified, false);
    assert.equal(product.releaseVerdict, 'held');
    assert.match(live.plan.context, /phase100.*형태 오류.*브라우저 12/);
  }
  if (manifest.renderedReviewExecutionFile) {
    const current = await json(resolve(root, manifest.renderedReviewExecutionFile));
    assert.deepEqual([current.actualProviderCalls, current.actualCountApiCalls, current.actualKeyReads], [3, 3, 1]);
    assert.deepEqual([current.grammarImprovements, current.safePairs, current.pairsImproved, current.onlyTargetOpinionFailures, current.controlsPassed], [6, 6, 2, 4, 6]);
    assert.equal(current.pairedCriterionMet, false);
    assert.equal(current.newModelGenerationMeasured, false);
    assert.equal(current.mainDispatchAuthorized, false);
    assert.equal(current.additionalUsedUpperMicros, manifest.renderedPanelReviewExecutionFile ? '31541842' : ledger.usedUpperMicros);
    assert.equal(current.additionalAvailableMicros, manifest.renderedPanelReviewExecutionFile ? '3458158' : ledger.availableMicros);
    assert.match(live.plan.context, /phase101.*문법 개선 6\/6.*전체 조건 2\/6/);
    assert.ok(live.plan.budget.includes('US$0.262254'));
  }
  if (manifest.targetDisplayProductEvidenceFile) {
    const product = await json(resolve(root, manifest.targetDisplayProductEvidenceFile));
    assert.deepEqual([product.pairedRequests, product.savedAndReread, product.builtBrowserChecks, product.legacyRecordsReread], [7, 14, 16, 2]);
    assert.deepEqual([product.unitTests, product.actualProviderCalls, product.productionWrites], [885, 0, 0]);
    assert.equal(product.newModelQualityVerified, false);
    assert.equal(product.releaseVerdict, 'held');
    assert.match(live.plan.context, /phase102.*보완 필요.*브라우저 16/);
  }
  if (manifest.renderedPanelReviewExecutionFile) {
    const panel = await json(resolve(root, manifest.renderedPanelReviewExecutionFile));
    assert.deepEqual([panel.actualProviderCalls, panel.actualCountApiCalls, panel.actualKeyReads], [3, 3, 1]);
    assert.deepEqual([panel.pairedDenominator, panel.pairsImproved, panel.candidateMatches, panel.safePairs, panel.controlsPassed], [6, 6, 6, 6, 6]);
    assert.equal(panel.pairedCriterionMet, true);
    assert.equal(panel.supportedCases.length, panel.candidateDenominator);
    assert.equal(panel.candidateDenominator, 12);
    assert.deepEqual([panel.disagreements, panel.malformed], [[], []]);
    assert.equal(panel.sourceQualified, false);
    assert.equal(panel.mainDispatchAuthorized, false);
    assert.equal(panel.newModelGenerationMeasured, false);
    assert.equal(panel.releaseVerdict, 'held');
    assert.equal(panel.additionalUsedUpperMicros, supplement?.beforeUsedUpperMicros ?? ledger.usedUpperMicros);
    assert.equal(panel.additionalAvailableMicros, availableBeforeSupplement);
    assert.equal(panel.reservedMicros, ledger.reservedMicros);
    assert.ok(live.plan.budget.includes('US$' + (Number(panel.stageUsedUpperMicros) / 1e6).toFixed(6)));
    assert.match(live.plan.context, /phase103.*목표 개선 6\/6.*수정판 전체 조건 6\/6.*보정 후보 12\/12.*통제 6\/6/);
  }
  if (manifest.renderedCalibrationPreparationFile) {
    const calibration = await json(resolve(root, manifest.renderedCalibrationPreparationFile));
    assert.deepEqual([calibration.preparedRequests, calibration.sourceExcerptCases, calibration.missingFeedbackControls], [72, 11, 1]);
    assert.deepEqual([calibration.actualProviderCalls, calibration.actualCountApiCalls, calibration.actualKeyReads], [0, 0, 0]);
    assert.deepEqual([calibration.minimumReservationMicros, calibration.maximumReservationMicros, calibration.shortfallAtMinimumMicros],
      ['4278072', '8567184', '1238292']);
    assert.equal(calibration.availableMicros, availableBeforeSupplement);
    assert.equal(calibration.reservationCreated, false);
    assert.equal(calibration.sourceQualified, false);
    assert.equal(calibration.calibrationAcceptanceAllowed, false);
    assert.equal(calibration.mainDispatchAuthorized, false);
    assert.equal(calibration.releaseVerdict, 'held');
    assert.match(live.plan.context, /phase104.*보정 72개.*실제 0\/72.*US\$4\.278072.*US\$3\.039780/);
  }
  if (manifest.closedDayCostPreparationFile) {
    const costs = await json(resolve(root, manifest.closedDayCostPreparationFile));
    assert.equal(costs.dayUtc, '2026-11-08');
    assert.deepEqual([costs.matchedCountReceipts, costs.nonoverlappingRuns], [245, 6]);
    assert.deepEqual([costs.candidateReleaseMicros, costs.candidateAvailableMicros, costs.retainedFollowingDayMicros],
      ['8575000', '11614780', '2940000']);
    assert.equal(costs.currentAvailableMicros, availableBeforeSupplement);
    assert.deepEqual([costs.reconciliationApplied, costs.newGrantCreated, costs.mainDispatchAuthorized], [false, false, false]);
    assert.deepEqual([costs.actualProviderCalls, costs.actualCountApiCalls, costs.actualKeyReads], [0, 0, 0]);
    assert.match(live.plan.context, /phase105.*245회.*US\$8\.575000.*US\$3\.039780.*US\$11\.614780.*0\/72/);
  }
  if (manifest.closedDayCalibrationEarmarkFile) {
    const earmark = await json(resolve(root, manifest.closedDayCalibrationEarmarkFile));
    assert.equal(earmark.status, 'earmarked');
    assert.deepEqual([earmark.modelRequests, earmark.countRequests], [72, 72]);
    assert.deepEqual([earmark.earmarkMicros, earmark.unassignedHeldMicros, earmark.existingCapMicros], ['8567184', '7816', '35000000']);
    assert.equal(earmark.generalV3AvailableMicros, availableBeforeSupplement);
    assert.deepEqual([earmark.providerDispatchAuthorized, earmark.newGrantCreated, earmark.sourceQualified, earmark.mainDispatchAuthorized],
      [false, false, false, false]);
    assert.deepEqual([earmark.actualProviderCalls, earmark.actualCountApiCalls, earmark.actualKeyReads], [0, 0, 0]);
    assert.match(live.plan.context, /phase106.*보정 72개.*US\$8\.567184.*US\$35.*0\/72/);
  }
  if (manifest.renderedCalibrationExecutionFile) {
    const calibration = await json(resolve(root, manifest.renderedCalibrationExecutionFile));
    assert.equal(calibration.status, 'collected-rendered-calibration');
    assert.deepEqual([calibration.actualProviderCalls, calibration.actualCountApiCalls, calibration.actualKeyReads], [72, 72, 1]);
    assert.deepEqual([calibration.admittedPublicCases, calibration.capturedModelUsage, calibration.arithmeticMatches, calibration.criticalFlagMisses],
      [12, 72, 71, 0]);
    assert.equal(calibration.differenceRows.length, 1);
    const [difference] = calibration.differenceRows;
    assert.deepEqual([difference.caseId, difference.model, difference.layout, difference.differentDimensions, difference.differentAxes],
      ['MC12', 'gpt-6.1-sol', 'feedback-first', ['grammar'], []]);
    assert.equal(calibration.stageUsedUpperMicros, '3488388');
    assert.equal(calibration.generalV3AvailableMicros, availableBeforeSupplement);
    assert.equal(calibration.mainDispatchAuthorized, false);
    assert.equal(calibration.releaseVerdict, 'held');
    assert.match(live.plan.context, /phase107.*실제 응답 72\/72.*기대 판정 71\/72.*중대 표시 누락 0/);
  }
  if (manifest.pilotReferenceTriageFile) {
    const triage = await json(resolve(root, manifest.pilotReferenceTriageFile));
    assert.deepEqual([triage.cases, triage.peerReviewsReplayed, triage.currentGenerationBodies, triage.identicalPriorBodies], [60, 120, 360, 360]);
    assert.deepEqual([triage.sourceSupplementsPrepared, triage.explicitInsufficientSourceCases, triage.ambiguityCases], [12, 6, 7]);
    assert.deepEqual([triage.qualifiedReferences, triage.familyIndependenceVerified, triage.mainDispatchAuthorized], [0, false, false]);
    assert.deepEqual([triage.actualProviderCalls, triage.actualCountApiCalls, triage.actualKeyReads], [0, 0, 0]);
    assert.deepEqual([triage.fullPilotModelCallsRemaining, triage.countAllowanceForFullPilotMicros], [1800, '63000000']);
    assert.equal(triage.generalV3AvailableMicros, availableBeforeSupplement);
    assert.match(live.plan.context, /phase108.*본문 360\/360.*120건.*12문항.*7문항.*0\/360/);
  }
  if (supplement) {
    assert.equal(supplement.status, 'collected-reference-supplement');
    assert.deepEqual([supplement.actualProviderCalls, supplement.actualCountApiCalls, supplement.actualKeyReads], [24, 24, 1]);
    assert.deepEqual([supplement.supportedCases.length, supplement.heldCases.length, supplement.pilotGenerationsCompleted], [8, 4, 0]);
    assert.deepEqual([supplement.beforeUsedUpperMicros, supplement.beforeAvailableMicros, supplement.stageUsedUpperMicros],
      ['31960220', '3039780', '1023236']);
    assert.deepEqual([supplement.additionalUsedUpperMicros, supplement.additionalAvailableMicros, supplement.reservedMicros],
      [productDiagnostic?.beforeUsedUpperMicros ?? ledger.usedUpperMicros,
        productDiagnostic?.beforeAvailableMicros ?? ledger.availableMicros, ledger.reservedMicros]);
    assert.deepEqual([supplement.referenceQualified, supplement.mainDispatchAuthorized, supplement.releaseVerdict], [false, false, 'held']);
    assert.match(live.plan.context, /phase109.*24\/24.*8\/12.*4문항.*0\/360/);
    assert.ok(live.plan.budget.includes('US$1.023236'));
  }
  if (productDiagnostic) {
    assert.deepEqual([productDiagnostic.actualProviderCalls, productDiagnostic.actualCountApiCalls, productDiagnostic.savedAndReread], [6, 6, 6]);
    assert.deepEqual([productDiagnostic.reproducedNormalEchoes, productDiagnostic.browserChecksAfter, productDiagnostic.normalEchoesAfter], [2, 6, 0]);
    assert.deepEqual([productDiagnostic.stageUsedUpperMicros, productDiagnostic.additionalUsedUpperMicros, productDiagnostic.additionalAvailableMicros],
      ['246257', completeCorrection?.beforeUsedUpperMicros ?? ledger.usedUpperMicros,
        completeCorrection?.beforeAvailableMicros ?? ledger.availableMicros]);
    assert.deepEqual([productDiagnostic.pilotGenerationsCompleted, productDiagnostic.mainDispatchAuthorized, productDiagnostic.releaseVerdict],
      [0, false, 'held']);
    assert.match(live.plan.context, /phase110.*실제 6\/6.*정상 문장.*0\/360/);
    assert.ok(live.plan.budget.includes('US$0.246257'));
  }
  if (manifest.correctionExplanationRebindFile) {
    const rebind = await json(resolve(root, manifest.correctionExplanationRebindFile));
    assert.deepEqual([rebind.savedResponsesReplayed, rebind.browserChecks, rebind.unchangedPilotRequestBodies], [3, 6, 360]);
    assert.deepEqual([rebind.changedScreens, rebind.changedCalibrationRequests, rebind.identicalCalibrationRequests], [9, 54, 18]);
    assert.deepEqual([rebind.actualProviderCalls, rebind.actualCountApiCalls, rebind.mainDispatchAuthorized], [0, 0, false]);
    assert.equal(rebind.availableMicros, completeCorrection?.beforeAvailableMicros ?? ledger.availableMicros);
    assert.ok(BigInt(rebind.changedCountAllowanceMicros) > BigInt(ledger.availableMicros));
    assert.match(live.plan.context, /phase111.*교정 이유.*보정 화면 9\/12.*54\/72.*0\/360/);
  }
  if (manifest.pilotWorkerPreflightFile) {
    const preflight = await json(resolve(root, manifest.pilotWorkerPreflightFile));
    assert.deepEqual([preflight.cases, preflight.verifiedWorkerRequests, preflight.grammarLessons], [60, 360, 15]);
    assert.deepEqual([preflight.pilotGenerationsCompleted, preflight.pilotReviewsCompleted, preflight.providerCalls, preflight.tokenCountCalls], [0, 0, 0, 0]);
    assert.equal(preflight.realMainIntegrated, false);
    assert.equal(preflight.mainDispatchAuthorized, false);
    assert.equal(preflight.currentAvailableMicros, completeCorrection?.beforeAvailableMicros ?? ledger.availableMicros);
    assert.match(live.plan.context, /phase112.*로컬 앱 요청 360\/360.*실제 생성 0\/360/);
  }
  if (manifest.pilotReviewHandoffFile) {
    const handoff = await json(resolve(root, manifest.pilotReviewHandoffFile));
    assert.deepEqual([handoff.plannedGenerations, handoff.completedLocalParents, handoff.plannedReviews], [360, 318, 1440]);
    assert.deepEqual([handoff.rehearsalReviewBodies, handoff.heldReviews, handoff.browserMatches], [1272, 168, 318]);
    assert.deepEqual([handoff.actualProviderCalls, handoff.actualInputCountCalls, handoff.mainDispatchAuthorized], [0, 0, false]);
    assert.match(live.plan.context, /phase113.*화면 318.*1,272.*168.*실제 생성 0\/360/);
  }
  if (manifest.grammarRepairGuardFile) {
    const repair = await json(resolve(root, manifest.grammarRepairGuardFile));
    assert.deepEqual([repair.replayed, repair.accepted, repair.ambiguousHeld, repair.adverseControlsBlocked, repair.browserChecks], [15, 12, 3, 4, 8]);
    assert.equal(repair.unchangedGenerationBodies, 360);
    assert.equal(repair.actualProviderCalls, 0);
    assert.match(live.plan.context, /phase114.*교정 12건.*3건 보류.*실제 생성 0\/360/);
  }
  if (completeCorrection) {
    assert.deepEqual([completeCorrection.actualProviderCalls, completeCorrection.actualCountApiCalls,
      completeCorrection.savedAndReread, completeCorrection.browserChecks], [3, 3, 3, 6]);
    assert.deepEqual([completeCorrection.additionalUsedUpperMicros, completeCorrection.additionalAvailableMicros],
      [firstReferenceWave?.beforeUsedUpperMicros ?? ledger.usedUpperMicros,
        firstReferenceWave?.beforeAvailableMicros ?? ledger.availableMicros]);
    assert.deepEqual([completeCorrection.pilotGenerationsCompleted, completeCorrection.mainDispatchAuthorized], [0, false]);
    assert.match(live.plan.context, /phase117.*실제 3\/3.*정식 예비평가 0\/360/);
  }
  if (firstReferenceWave) {
    assert.deepEqual([firstReferenceWave.actualProviderCalls, firstReferenceWave.actualCountCalls, firstReferenceWave.validReviews], [12, 12, 10]);
    assert.deepEqual([firstReferenceWave.agreementCases, firstReferenceWave.heldCases, firstReferenceWave.referencesQualified], [4, 2, 0]);
    assert.deepEqual([firstReferenceWave.additionalUsedUpperMicros, firstReferenceWave.additionalAvailableMicros],
      [noorMc12?.beforeUsedUpperMicros ?? ledger.usedUpperMicros,
        noorMc12?.beforeAvailableMicros ?? ledger.availableMicros]);
    assert.equal(firstReferenceWave.mainDispatchAuthorized, false);
    assert.match(live.plan.context, /phase126.*12\/12.*4문항 일치.*2문항 보류/);
  }
  if (manifest.blindReferenceFollowupFile) {
    const followup = await json(resolve(root, manifest.blindReferenceFollowupFile));
    assert.deepEqual([followup.originalValidReviews, followup.replayValidReviews, followup.replayAgreements,
      followup.replayHeldSource, followup.preparedReviews], [10, 12, 5, 1, 110]);
    assert.deepEqual([followup.actualProviderCalls, followup.actualCountCalls, followup.referencesQualified], [0, 0, 0]);
    assert.equal(followup.mainDispatchAuthorized, false);
    assert.match(live.plan.context, /phase127.*재검사 12\/12.*5문항 일치.*1문항 출처 보류/);
  }
  if (manifest.quotedCorrectionGuardFile) {
    const quoteGuard = await json(resolve(root, manifest.quotedCorrectionGuardFile));
    assert.deepEqual([quoteGuard.localBlocked, quoteGuard.localAccepted, quoteGuard.routeChecks,
      quoteGuard.regressionReplays, quoteGuard.actualProviderCalls, quoteGuard.productionWrites], [6, 6, 4, 180, 0, 0]);
    assert.equal(quoteGuard.frozenCandidateUnchanged, true);
    assert.match(live.plan.context, /phase128.*인용문 변경 6건 차단.*정상 대조 6건 수용.*단어·문법 API 4건/);
  }
  if (manifest.suggestSourceFollowupReadyFile) {
    const followup = await json(resolve(root, manifest.suggestSourceFollowupReadyFile));
    assert.deepEqual([followup.cases, followup.reviewRequests, followup.countRequests,
      followup.reserveMicros, followup.syntheticChecks], [1, 2, 2, 97209, 11]);
    assert.deepEqual([followup.actualProviderCalls, followup.actualCountCalls, followup.actualKeyReads], [0, 0, 0]);
    assert.equal(followup.liveScopeApproved, false);
    assert.match(live.plan.context, /phase129.*출처 보류 1문항.*검토 2회.*토큰 계산 2회.*US\$0\.097209/);
  }
  if (manifest.pilotReferenceAdmissionAuditFile) {
    const audit = await json(resolve(root, manifest.pilotReferenceAdmissionAuditFile));
    assert.deepEqual([audit.cases, audit.generationBodiesReadBack, audit.pilotLanguageEvidenceCandidates,
      audit.exactSurfaceCollisions, audit.referencesQualified], [60, 360, 3, 0, 0]);
    assert.deepEqual(audit.longScaffoldSizes, [6, 6]);
    assert.equal(audit.mainDispatchAuthorized, false);
    assert.match(live.plan.context, /phase130.*참조 근거 3문항.*작성 기준 차이 2문항.*공통 틀 2개/);
  }
  if (manifest.withheldResponseCompatibilityFile) {
    const withheld = await json(resolve(root, manifest.withheldResponseCompatibilityFile));
    assert.deepEqual([withheld.browserChecks, withheld.syntheticProviderRequests, withheld.actualProviderCalls,
      withheld.productionWrites, withheld.unitTests], [4, 4, 0, 0, 898]);
    assert.equal(withheld.frozenCandidateUnchanged, true);
    assert.match(live.plan.context, /phase131.*교정 보류.*단어·문법 화면 4\/4.*새로고침 후 추가 요청 0/);
  }
  if (manifest.actualResponseReplayFile) {
    const replay = await json(resolve(root, manifest.actualResponseReplayFile));
    assert.deepEqual([replay.historicalProviderResponses, replay.browserChecks, replay.applyAndUndoChecks,
      replay.olderGrammarResponsesExcludedFromExactReplay, replay.actualProviderCalls], [3, 6, 4, 6, 0]);
    assert.match(live.plan.context, /phase132.*실제 단어 응답 3건.*화면 6\/6.*적용·되돌리기 4\/4/);
  }
  if (manifest.sourceIntegrationFile) {
    const integrated = await json(resolve(root, manifest.sourceIntegrationFile));
    assert.deepEqual([integrated.productFiles, integrated.testFiles, integrated.unitTests,
      integrated.syntheticReplays, integrated.browserChecks, integrated.actualProviderCalls], [7, 17, 898, 180, 14, 0]);
    assert.equal(integrated.branch, 'codex/ai-quality-v147');
    assert.equal(integrated.mainDispatchAuthorized, false);
    assert.match(live.plan.context, /phase133.*구현 브랜치.*제품 7개·검사 17개.*단위 898\/898.*브라우저 14\/14/);
  }
  if (manifest.currentCostReadbackFile) {
    const costs = await json(resolve(root, manifest.currentCostReadbackFile));
    assert.deepEqual([costs.newCapturedModelResponses, costs.newCapturedCountResponses], [117, 117]);
    assert.deepEqual([costs.actualProviderCalls, costs.actualCountCalls, costs.actualKeyReads], [0, 0, 0]);
    assert.deepEqual([costs.countFeeLineItemObserved, costs.ledgerAdjusted, costs.invoiceVerified], [false, false, false]);
    assert.match(live.plan.context, /phase134.*추가 응답 117건.*기존 차이 US\$0\.012527.*가용 US\$1\.152100/);
  }
  if (manifest.currentScreenCalibrationFile) {
    const screens = await json(resolve(root, manifest.currentScreenCalibrationFile));
    assert.deepEqual([screens.browserScreens, screens.changedCases, screens.changedDraftBodies,
      screens.historicalMatches, screens.handoffArchivedBodyMatches], [44, 9, 54, 71, 1440]);
    assert.deepEqual([screens.actualProviderCalls, screens.currentScreensRated, screens.mainDispatchAuthorized], [0, false, false]);
    assert.match(live.plan.context, /phase135.*보정 화면 44건.*표시 차이 9개.*새 초안 54개.*편성 1,440개/);
  }
  if (manifest.confirmationPreflightFile) {
    const preflight = await json(resolve(root, manifest.confirmationPreflightFile));
    assert.deepEqual([preflight.knownScaffoldCases, preflight.exposedPilotCases, preflight.heldGenerationBodies,
      preflight.heldReviewBodies, preflight.admittedIndependentFamilies], [12, 2, 12, 4, 0]);
    assert.deepEqual([preflight.volume.familyUnits, preflight.volume.generation, preflight.volume.individualReviews],
      [4620, 55440, 221760]);
    assert.equal(preflight.mainDispatchAuthorized, false);
    assert.match(live.plan.context, /phase136.*공통 틀 12문항.*테스트 노출 2문항.*개별 요청 277,200회/);
  }
  if (manifest.pilotReplacementDraftFile) {
    const replacements = await json(resolve(root, manifest.pilotReplacementDraftFile));
    assert.deepEqual([replacements.replacementDrafts, replacements.retainedCases, replacements.receiptReadbacks,
      replacements.newReviewBodies, replacements.referencesQualified], [2, 58, 12, 4, 0]);
    assert.equal(replacements.mainDispatchAuthorized, false);
    assert.match(live.plan.context, /phase137.*대체 초안 2문항.*합성 저장·재조회 12\/12.*가린 검토 요청 4개/);
  }
  if (manifest.revisedPilotRehearsalFile) {
    const rehearsal = await json(resolve(root, manifest.revisedPilotRehearsalFile));
    assert.deepEqual([rehearsal.readbackReceipts, rehearsal.browserMatches, rehearsal.reviewBodies,
      rehearsal.linkedReviews, rehearsal.heldReviews, rehearsal.replacementReviews], [360, 357, 1440, 1428, 12, 48]);
    assert.deepEqual([rehearsal.actualProviderCalls, rehearsal.actualCountCalls, rehearsal.mainDispatchAuthorized],
      [0, 0, false]);
    assert.match(live.plan.context, /phase138.*저장 결과 357건.*채점 1,428\/1,440 연결.*12개 보류/);
  }
  if (manifest.revisedPilotDispatchPreflightFile) {
    const preflight = await json(resolve(root, manifest.revisedPilotDispatchPreflightFile));
    assert.deepEqual([preflight.plannedGenerations, preflight.plannedReviews,
      preflight.negativeSourceCollectorChecks, preflight.actualKeyReads], [360, 1440, 2, 0]);
    assert.equal(preflight.mainDispatchAuthorized, false);
    assert.equal(preflight.reviewShortfallMicros, '273628');
    assert.match(live.plan.context, /phase139.*전송 전 검사.*360개.*1,440개.*US\$0\.273628/);
  }
  if (manifest.revisedPilotRecoveryFile) {
    const recovery = await json(resolve(root, manifest.revisedPilotRecoveryFile));
    assert.deepEqual([recovery.profileCount, recovery.completedReceiptsRecovered, recovery.failedReceiptsRecovered,
      recovery.pendingToUnknownPreserved, recovery.actualProviderCalls], [2, 2, 2, 2, 0]);
    assert.equal(recovery.noDuplicateProviderCallbacks, true);
    assert.match(live.plan.context, /phase140.*완료 2건·실패 2건 복구.*결과 미확인 2건.*재전송 0/);
  }
  if (manifest.revisedPilotReportFile) {
    const report = await json(resolve(root, manifest.revisedPilotReportFile));
    assert.deepEqual([report.plannedParents, report.plannedReviews, report.qualifiedPasses,
      report.heldParents, report.unmeasuredComparisons, report.actualProviderCalls], [360, 1440, 0, 360, 180, 0]);
    assert.deepEqual(report.unsubmittedReviewStates, { missing: 1428, 'no-screen': 12 });
    assert.deepEqual(report.pairedVisibility, { both: 177, 'candidate-only': 3 });
    assert.deepEqual([report.mainDispatchAuthorized, report.releaseVerdict], [false, 'held']);
    assert.match(live.plan.context, /phase141.*채점 없음 1,428개·화면 없음 12개.*비교 180쌍 미측정.*정식 통과 0/);
  }
  if (manifest.screenReplayCompatibilityFile) {
    const replay = await json(resolve(root, manifest.screenReplayCompatibilityFile));
    assert.deepEqual([replay.historicalPanelRequests, replay.historicalCalibrationMatches,
      replay.historicalCalibrationRequests, replay.identicalCurrentBodies, replay.changedCurrentBodies], [3, 71, 72, 18, 54]);
    assert.deepEqual([replay.oldVotesRejectedOnChangedBodies, replay.currentCalibrationQualified,
      replay.mainDispatchAuthorized, replay.actualProviderCalls], [true, false, false, 0]);
    assert.match(live.plan.context, /phase142.*과거 보정 71\/72 재현.*현재 변경 본문 54개에 과거 응답 차단/);
  }
  if (manifest.countedRepairFollowupFile) {
    const repair = await json(resolve(root, manifest.countedRepairFollowupFile));
    assert.deepEqual([repair.frozenCandidateRejected, repair.currentBrowserAccepted, repair.changedOrIncompleteBlocked,
      repair.actualProviderCalls, repair.pilotCandidateRebound], [4, 10, 6, 0, false]);
    assert.match(live.plan.context, /phase143.*정상 교정 4종 복구.*저장·재조회 10건.*잘못된 교정 6건 차단/);
  }
  const countedRepairRebindFile = manifest.countedRepairPilotRebindFile ?? manifest.currentPilotCandidateRebindFile;
  if (countedRepairRebindFile) {
    const rebind = await json(resolve(root, countedRepairRebindFile));
    assert.deepEqual([rebind.candidateServerFiles, rebind.candidateClientFiles, rebind.generationBodiesMatched,
      rebind.browserScreensMatched, rebind.reviewBodiesMatched, rebind.heldReviews], [289, 100, 360, 357, 1440, 12]);
    assert.deepEqual([rebind.actualProviderCalls, rebind.referencesQualified, rebind.mainDispatchAuthorized], [0, 0, false]);
    assert.notEqual(rebind.candidateFreezeSha256, rebind.previousFreezeSha256);
    assert.match(live.plan.context, /phase144.*후보 고정.*생성 360건·화면 357건·채점 본문 1,440건.*12건 보류/);
  }
  if (manifest.sequentialBudgetAuditFile) {
    const serial = await json(resolve(root, manifest.sequentialBudgetAuditFile));
    assert.deepEqual([serial.observedCalibrationCalls, serial.changedCalibrationCountBodies,
      serial.historical72SerialSimulation.complete, serial.changedCalibrationAllowanceShortfallMicros,
      serial.sourceFollowupReserveMicros], [72, 54, 17, 737900, 97209]);
    assert.deepEqual([serial.countFeeEstablished, serial.sourceFollowupApproved, serial.actualProviderCalls,
      serial.mainDispatchAuthorized], [false, false, 0, false]);
    assert.match(live.plan.context, /phase145.*순차 17\/72.*변경 54건 계산료 여유.*US\$0\.737900 부족/);
  }
  if (manifest.pilotReferenceSourceRefinementFile) {
    const source = await json(resolve(root, manifest.pilotReferenceSourceRefinementFile));
    assert.deepEqual([source.originalSourceLinkedCases, source.refinedSourceCases, source.updatedReviewBodies,
      source.retainedReviewBodies, source.referencesQualified, source.actualProviderCalls], [60, 16, 32, 78, 0, 0]);
    assert.equal(source.mainDispatchAuthorized, false);
    assert.match(live.plan.context, /phase146.*출처 16문항 보완.*검토 본문 32건.*정식 참조 0\/60/);
  }
  if (manifest.countUnitExplanationFile) {
    const explanation = await json(resolve(root, manifest.countUnitExplanationFile));
    assert.deepEqual([explanation.historicalProviderResponses, explanation.browserChecks, explanation.newlyExplainedScreens,
      explanation.replayedPilotCandidatePayloads, explanation.changedPilotExplanations, explanation.actualProviderCalls],
    [3, 6, 2, 180, 0, 0]);
    assert.deepEqual([explanation.explanationCandidateRebound, explanation.learnerEfficacyMeasured], [false, false]);
    assert.match(live.plan.context, /phase147.*수량 교정 이유.*화면 2건.*예비 합성 180건 설명 일치/);
  }
  if (manifest.countedRepairPilotRebindFile) {
    const prior = await json(resolve(root, manifest.countedRepairPilotRebindFile));
    const current = await json(resolve(root, manifest.countUnitPilotRebindFile ?? manifest.currentPilotCandidateRebindFile));
    const explanation = await json(resolve(root, manifest.countUnitExplanationFile));
    assert.equal(current.predecessorFreezeSha256, prior.candidateFreezeSha256);
    assert.equal(current.verifiedServerBuildSha256, explanation.currentBuildSha256);
    assert.notEqual(current.runtimeScopeSha256, prior.runtimeScopeSha256);
    assert.deepEqual([current.generationBodiesMatched, current.browserScreensMatched, current.reviewBodiesMatched,
      current.heldReviews, current.actualProviderCalls, current.actualCountCalls, current.referencesQualified,
      current.mainDispatchAuthorized], [360, 357, 1440, 12, 0, 0, 0, false]);
    assert.match(live.plan.context, /phase148.*설명 반영 빌드.*생성 360건·화면 357건·채점 1,440건/);
  }
  if (manifest.frozenGrammarProtectionFile) {
    const protection = await json(resolve(root, manifest.frozenGrammarProtectionFile));
    const candidate = await json(resolve(root, manifest.countUnitPilotRebindFile ?? manifest.currentPilotCandidateRebindFile));
    assert.equal(protection.candidateFreezeSha256, candidate.candidateFreezeSha256);
    assert.deepEqual([protection.browserChecks, protection.countedExplanationChecks,
      protection.firstAnswerProtectionChecks, protection.actualProviderCalls, protection.productionWrites], [4, 2, 4, 0, 0]);
    assert.equal(protection.workerStopped, true);
    assert.match(live.plan.context, /phase149.*첫 답안·독립 복습.*두 엔진 4건.*Node24 899/);
  }
  if (manifest.frozenCalibrationReuseFile) {
    const reuse = await json(resolve(root, manifest.frozenCalibrationReuseFile));
    const candidate = await json(resolve(root, manifest.countUnitPilotRebindFile ?? manifest.currentPilotCandidateRebindFile));
    assert.equal(reuse.candidateFreezeSha256, candidate.candidateFreezeSha256);
    assert.deepEqual([reuse.archivedEvidenceSlots, reuse.changedRequests, reuse.negativeControls,
      reuse.savedAllowanceMicros, reuse.countAllowanceShortfallMicros], [18, 54, 8, 630000, 737900]);
    assert.deepEqual([reuse.currentScreensRated, reuse.mainDispatchAuthorized, reuse.actualProviderCalls], [false, false, 0]);
    assert.match(live.plan.context, /phase150.*실제 보정 18건 연결.*54건 새 검토.*US\$0\.737900 부족/);
  }
  if (manifest.avoidExplanationFile) {
    const explanation = await json(resolve(root, manifest.avoidExplanationFile));
    assert.deepEqual([explanation.historicalProviderResponses, explanation.browserChecks, explanation.newlyExplainedScreens,
      explanation.countRulePreservedScreens, explanation.replayedPilotCandidatePayloads, explanation.changedPilotExplanations,
      explanation.actualProviderCalls, explanation.unitTestsPassed], [3, 6, 2, 2, 180, 0, 0, 900]);
    assert.deepEqual([explanation.explanationCandidateRebound, explanation.learnerEfficacyMeasured], [false, false]);
    assert.match(live.plan.context, /phase151.*avoid 교정 이유.*실제 응답 재생 화면 2건.*예비 합성 180건 일치/);
  }
  if (manifest.countUnitPilotRebindFile) {
    const prior = await json(resolve(root, manifest.countUnitPilotRebindFile));
    const current = await json(resolve(root, manifest.currentPilotCandidateRebindFile));
    const explanation = await json(resolve(root, manifest.avoidExplanationFile));
    assert.equal(current.predecessorFreezeSha256, prior.candidateFreezeSha256);
    assert.equal(current.verifiedServerBuildSha256, explanation.currentBuildSha256);
    assert.notEqual(current.runtimeScopeSha256, prior.runtimeScopeSha256);
    assert.deepEqual([current.generationBodiesMatched, current.browserScreensMatched, current.reviewBodiesMatched,
      current.heldReviews, current.grammarBrowserChecks, current.publicCalibrationScreensMatched,
      current.unchangedArchivedCalibrationSlots, current.changedCalibrationSlots, current.sourceInventoryFiles],
    [360, 357, 1440, 12, 4, 22, 18, 54, 679]);
    assert.deepEqual([current.referencesQualified, current.actualProviderCalls, current.mainDispatchAuthorized], [0, 0, false]);
    assert.match(live.plan.context, /phase152.*avoid 설명 반영 후보.*생성 360건·화면 357건·채점 1,440건/);
  }
  if (manifest.mc12DiagnosticScopeFile) {
    const next = await json(resolve(root, manifest.mc12DiagnosticScopeFile));
    const candidate = await json(resolve(root, manifest.currentPilotCandidateRebindFile));
    assert.equal(next.candidateFreezeSha256, candidate.candidateFreezeSha256);
    assert.deepEqual([next.caseId, next.reviewRequests, next.countRequests, next.reserveMicros, next.combinedReserveMicros,
      next.availableAfterCombinedReserveMicros], ['MC12', 6, 6, '713932', '811141', '340959']);
    assert.deepEqual([next.reportIdenticalToPhase134, next.countFeeEstablished, next.mc12ScopeApproved,
      next.mainDispatchAuthorized, next.actualProviderCalls], [true, false, false, false, 0]);
    assert.match(live.plan.context, /phase153.*MC12.*US\$0\.713932.*Noor 합계 US\$0\.811141/);
  }
  if (manifest.mc12CollectorReadyFile) {
    const ready = await json(resolve(root, manifest.mc12CollectorReadyFile));
    const scope = await json(resolve(root, manifest.mc12DiagnosticScopeFile));
    assert.equal(ready.scopeSha256, scope.scopeSha256);
    assert.deepEqual([ready.syntheticChecks, ready.actualProviderCalls, ready.actualCountCalls, ready.actualKeyReads,
      ready.liveScopeApproved, ready.mainDispatchAuthorized], [12, 0, 0, 0, false, false]);
    assert.match(live.plan.context, /phase154.*MC12 수집기.*12건.*Noor 우선/);
  }
  if (manifest.pilotSourceNoteHandoffFile) {
    const notes = await json(resolve(root, manifest.pilotSourceNoteHandoffFile));
    const candidate = await json(resolve(root, manifest.currentPilotCandidateRebindFile));
    assert.equal(notes.candidateFreezeSha256, candidate.candidateFreezeSha256);
    assert.equal(notes.priorHandoffSha256, candidate.reviewHandoffSha256);
    assert.notEqual(notes.previewHandoffSha256, notes.priorHandoffSha256);
    assert.deepEqual([notes.sourceBackedNotes, notes.historicalResponsesRechecked, notes.changedPreviewReviews,
      notes.unchangedPreviewReviews, notes.negativeControls, notes.previewDispatchRejected, notes.referencesQualified,
      notes.actualProviderCalls], [3, 6, 72, 1368, 5, true, 0, 0]);
    assert.match(live.plan.context, /phase155.*실제 근거 3문항.*채점 본문 72개.*정식 참조 0\/60/);
  }
  if (noorMc12) {
    const progress = await json(resolve(root, '.taskmaster/docs/ai-quality-v147-live-progress.json'));
    const candidate = await json(resolve(root, manifest.currentPilotCandidateRebindFile));
    assert.equal(noorMc12.candidateFreezeSha256, candidate.candidateFreezeSha256);
    assert.deepEqual([noorMc12.actualProviderCalls, noorMc12.actualCountCalls, noorMc12.actualKeyReads,
      noorMc12.automaticRetries], [8, 8, 2, 0]);
    assert.deepEqual([noorMc12.noor.responseCount, noorMc12.noor.countCalls, noorMc12.noor.bothSourcesSufficient,
      noorMc12.noor.status, noorMc12.noor.settledBeforeMc12], [2, 2, true, 'agreement-needs-admission', true]);
    assert.deepEqual([noorMc12.mc12.responseCount, noorMc12.mc12.countCalls, noorMc12.mc12.matchingVotes,
      noorMc12.mc12.diagnosticAgreement], [6, 6, 6, true]);
    assert.deepEqual([noorMc12.combinedApprovedMaximumMicros, noorMc12.stageUsedUpperMicros,
      noorMc12.countAllowanceRetainedMicros], ['811141', '540859', '280000']);
    assert.deepEqual([noorMc12.additionalUsedUpperMicros, noorMc12.additionalAvailableMicros, noorMc12.reservedMicros],
      [continuation?.beforeGeneralUsedUpperMicros ?? ledger.usedUpperMicros,
        continuation?.beforeGeneralAvailableMicros ?? ledger.availableMicros, ledger.reservedMicros]);
    assert.equal(BigInt(noorMc12.beforeAvailableMicros) - BigInt(noorMc12.stageUsedUpperMicros),
      BigInt(continuation?.beforeGeneralAvailableMicros ?? ledger.availableMicros));
    assert.deepEqual([noorMc12.fullCalibrationQualified, noorMc12.pilotQualified, noorMc12.referencesQualified,
      noorMc12.pilotGenerationsCompleted, noorMc12.mainDispatchAuthorized], [false, false, 0, 0, false]);
    for (const [file, expected] of Object.entries(noorMc12.evidenceSha256)) {
      assert.equal(createHash('sha256').update(await readFile(resolve(root, file))).digest('hex'), expected);
    }
    assert.deepEqual([progress.phase, progress.status, progress.actualProviderCalls, progress.actualCountCalls,
      progress.mc12DiagnosticMatchingVotes, progress.generalV3AvailableMicros],
      currentManagementRecord
        ? [currentManagementRecord.phase, currentManagementRecord.status, currentManagementRecord.actualProviderCalls, currentManagementRecord.actualCountCalls, 6, ledger.availableMicros]
        : postJointFamily
        ? ['phase199', 'post-joint-family-proposals-collected-source-attribution-and-funding-held', 2, 2, 6, ledger.availableMicros]
        : postJointCandidates
        ? ['phase198', 'post-joint-reference-candidates-prepared-qualification-pending', 0, 0, 6, ledger.availableMicros]
        : postJointRecheck
        ? ['phase197', 'post-joint-source-recheck-collected-reference-admission-pending', 2, 2, 6, ledger.availableMicros]
        : postJointSources
        ? ['phase196', 'post-joint-primary-source-supplement-prepared-admission-pending', 0, 0, 6, ledger.availableMicros]
        : postJointGrammar
        ? ['phase195', 'post-joint-language-proposals-collected-reference-admission-pending', 3, 3, 6, ledger.availableMicros]
        : postJointWord
        ? ['phase194', 'post-joint-word-language-collected-grammar-and-admission-pending', 3, 3, 6, ledger.availableMicros]
        : postJointLanguage
        ? ['phase193', 'post-joint-language-review-prepared-funding-held', 0, 0, 6, ledger.availableMicros]
        : postJointCapture
        ? ['phase192', 'post-joint-application-bodies-captured-reference-review-pending', 0, 0, 6, ledger.availableMicros]
        : postJointDraft
        ? ['phase191', 'post-joint-freeze-sixty-drafts-authored-independent-review-pending', 0, 0, 6, ledger.availableMicros]
        : developmentFamilies
        ? ['phase190', 'development-exposure-blocked-joint-freeze-ready-for-new-cohort', 0, 0, 6, ledger.availableMicros]
        : currentProgramTemplates
        ? ['phase189', 'current-finite-template-coverage-bound-reference-families-held', 0, 0, 6, ledger.availableMicros]
        : referenceRoleCompact
        ? ['phase188', 'reference-role-public-calibration-passed-formal-references-held', 6, 6, 6, ledger.availableMicros]
        : referenceRoleCalibration
        ? ['phase187', 'reference-role-calibration-boundary-disagreement-held', 6, 6, 6, ledger.availableMicros]
        : currentExposureSources
        ? ['phase186', 'current-exposure-bound-regional-source-conflict-held', 0, 0, 6, ledger.availableMicros]
        : bilingualReferenceRecords
        ? ['phase185', 'bilingual-reference-candidates-reconciled-qualification-held', 0, 0, 6, ledger.availableMicros]
        : v10Acceptance
        ? ['phase184', 'v10-calibration-accepted-pilot-references-held', 0, 0, 6, ledger.availableMicros]
        : v10Sources
        ? ['phase183', 'v10-witness-sources-qualified-formal-pilot-held', 3, 3, 6, ledger.availableMicros]
        : v10Rebind
        ? ['phase182', 'v10-review-plans-rebound-pilot-held', 0, 0, 6, ledger.availableMicros]
        : v10Live
        ? ['phase181', 'v10-development-calibration-collected-pilot-held', 18, 18, 6, ledger.availableMicros]
        : withholdingReview
        ? ['phase180', 'withholding-review-v10-prepared-pilot-held', 0, 0, 6, ledger.availableMicros]
        : calibrationRemainder
        ? ['phase179', 'bilingual-calibration-remainder-held', 4, 18, 6, ledger.availableMicros]
        : negativeControls
        ? ['phase178', 'bilingual-negative-controls-collected-pilot-held', 12, 12, 6, ledger.availableMicros]
        : fixedReview
        ? ['phase177', 'actual-app-product-review-collected-pilot-held', 12, 12, 6, ledger.availableMicros]
        : manifest.closedDayProvisionAuditPreparationFile
        ? ['phase176', 'closed-day-provision-audit-candidate-held', 0, 0, 6, ledger.availableMicros]
        : manifest.groupedProductReviewPreparationFile
        ? ['phase175', 'grouped-product-review-and-cost-readback-held', 0, 0, 6, ledger.availableMicros]
        : manifest.bilingualProductReviewPreparationFile
        ? ['phase174', 'bilingual-product-review-prepared-pilot-held', 0, 0, 6, ledger.availableMicros]
        : wordAppActual
        ? ['phase173', 'word-app-diagnostic-collected-pilot-held', 6, 6, 6, ledger.availableMicros]
        : manifest.wordAppDiagnosticExecutorFile
        ? ['phase172', 'word-app-executor-approval-pending', 0, 0, 6, ledger.availableMicros]
        : bilingualActual
        ? ['phase171', 'bilingual-reference-collected-admission-held', 3, 3, 6, ledger.availableMicros]
        : manifest.bilingualReferenceExecutorFile
        ? ['phase170', 'bilingual-reference-executor-approval-pending', 0, 0, 6, ledger.availableMicros]
        : manifest.bilingualPilotDraftProposalFile
        ? ['phase169', 'bilingual-pilot-draft-local-verified-review-pending', 0, 0, 6, ledger.availableMicros]
        : manifest.bilingualFreezeEvidenceFile
        ? ['phase168', 'bilingual-candidate-frozen-local-review', 0, 0, 6, ledger.availableMicros]
        : manifest.intentCorrectionIntegrationFile
        ? ['phase167', 'intent-correction-local-verified', 0, 0, 6, ledger.availableMicros]
        : manifest.koreanIntentIntegrationFile
        ? ['phase166', 'korean-intent-local-verified', 0, 0, 6, ledger.availableMicros]
        : manifest.coreFlowPriorityFile
        ? ['phase165', 'core-flow-integrated-local-verified', 0, 0, 6, ledger.availableMicros]
        : manifest.referenceReconciliationPreparationFile
        ? ['phase164', 'reference-alternatives-source-patch-prepared', 0, 0, 6, ledger.availableMicros]
        : groupedActual
        ? ['phase163', 'grouped-language-reference-collected-source-held', 3, 3, 6, ledger.availableMicros]
        : manifest.blindReferenceGroupsExecutorFile
        ? ['phase162', 'grouped-reference-executor-approval-pending', 0, 0, 6, ledger.availableMicros]
        : manifest.blindReferenceGroupsPreparationFile
        ? ['phase161', 'grouped-reference-prepared-held', 0, 0, 6, ledger.availableMicros]
        : continuation
        ? ['phase160', 'current-calibration-measured-reference-held', 48, 48, 6, ledger.availableMicros]
        : manifest.currentContinuationReadyFile
          ? ['phase159', 'current-continuation-approval-pending', 0, 0, 6, ledger.availableMicros]
          : manifest.budgetHeadroomAuditFile
            ? ['phase158', 'restricted-earmark-headroom-identified-pilot-held', 0, 0, 6, ledger.availableMicros]
            : manifest.currentCalibrationEvidenceFile
              ? ['phase157', 'current-calibration-evidence-bound-pilot-held', 0, 0, 6, ledger.availableMicros]
              : ['phase156', 'diagnostics-complete-pilot-held', 8, 8, 6, ledger.availableMicros]);
    assert.match(live.plan.context, /phase156.*Noor 출처 2\/2.*MC12 6\/6.*정식 참조 0\/60.*예비평가 0\/360/);
    assert.ok(live.plan.budget.includes('합계 US$0.540859'));
  }
  if (manifest.currentCalibrationEvidenceFile) {
    const bound = await json(resolve(root, manifest.currentCalibrationEvidenceFile));
    const progress = await json(resolve(root, '.taskmaster/docs/ai-quality-v147-live-progress.json'));
    const evidence = await json(resolve(root, bound.evidenceFile));
    const pending = await json(resolve(root, bound.pendingRequestsFile));
    assert.deepEqual([bound.historicalEvidenceSlots, bound.diagnosticEvidenceSlots, bound.currentEvidenceSlots,
      bound.pendingCalibrationSlots, bound.matchedCurrentEvidenceSlots], [18, 6, 24, 48, 24]);
    assert.equal(evidence.rows.length, 72);
    assert.deepEqual([pending.requests.length, pending.expectedModelCalls, pending.expectedCountCalls,
      pending.scopeApproved, pending.mainDispatchAuthorized], [48, 48, 48, false, false]);
    assert.ok(pending.requests.every(row => !Object.hasOwn(row, 'vote') && !Object.hasOwn(row, 'inputTokens') && !row.dispatchEligible));
    assert.deepEqual([bound.actualProviderCalls, bound.actualCountCalls, bound.actualKeyReads,
      bound.fullCalibrationQualified, bound.referencesQualified, bound.noorReferenceQualified], [0, 0, 0, false, 0, false]);
    assert.equal(bound.ledgerSha256, noorMc12.ledgerSha256);
    assert.equal(BigInt(bound.currentNewCountAllowanceMicros) - BigInt(continuation?.beforeGeneralAvailableMicros ?? ledger.availableMicros), BigInt(bound.countAllowanceShortfallMicros));
    assert.deepEqual([progress.calibrationCurrentEvidenceSlots, progress.calibrationCurrentScreenUnreviewedSlots], continuation ? [72, 0] : [24, 48]);
    const directory = dirname(resolve(root, bound.evidenceFile));
    for (const [name, expected] of Object.entries(bound.evidenceSha256)) {
      assert.equal(createHash('sha256').update(await readFile(resolve(directory, name))).digest('hex'), expected);
    }
    assert.match(live.plan.context, /phase157.*실제 근거 24\/72.*미검토 48개.*정식 참조 0\/60.*새 AI 호출 0/);
  }
  if (manifest.budgetHeadroomAuditFile) {
    const audit = await json(resolve(root, manifest.budgetHeadroomAuditFile));
    const proposal = await json(resolve(root, audit.continuationProposalFile));
    assert.deepEqual([audit.generalAvailableMicros, audit.restrictedUnusedEarmarkMicros,
      audit.combinedConditionalHeadroomMicros], ['611241', '5078796', '5690037']);
    assert.equal(audit.currentLedgerSha256, noorMc12.ledgerSha256);
    assert.equal(audit.generalAvailableMicros, continuation?.beforeGeneralAvailableMicros ?? ledger.availableMicros);
    assert.equal(BigInt(audit.historicalEarmarkMicros) - BigInt(audit.historicalEarmarkSettledMicros), BigInt(audit.restrictedUnusedEarmarkMicros));
    assert.equal(BigInt(audit.effectiveUsedIfEarmarkReconciledMicros) + BigInt(audit.combinedConditionalHeadroomMicros), BigInt(ledger.capMicros));
    assert.deepEqual([audit.activeLedgerAdjusted, audit.earmarkContinuationAuthorized, audit.actualProviderCalls,
      audit.actualCountCalls, audit.actualKeyReads, audit.mainDispatchAuthorized], [false, false, 0, 0, 0, false]);
    assert.deepEqual([audit.capturedResponsesRechecked, audit.reportedCostRows, audit.unattributedUsd], [201, 15, '0.012527']);
    assert.deepEqual([proposal.expectedModelCalls, proposal.expectedCountCalls, proposal.executorReady,
      proposal.liveScopeApproved, proposal.allCountsBeforeAnyModel], [48, 48, false, false, true]);
    assert.equal(proposal.maximumCombinedSpendMicros, audit.combinedConditionalHeadroomMicros);
    const directory = dirname(resolve(root, audit.continuationProposalFile));
    for (const [name, expected] of Object.entries(audit.evidenceSha256)) {
      assert.equal(createHash('sha256').update(await readFile(resolve(directory, name))).digest('hex'), expected);
    }
    assert.match(live.plan.context, /phase158.*일반 가용 US\$0\.611241.*전용 미사용 US\$5\.078796.*조건부 합계 US\$5\.690037/);
    assert.ok(live.plan.budget.includes('현재 일반 가용액 아님'));
  }
  if (manifest.currentContinuationReadyFile) {
    const ready = await json(resolve(root, manifest.currentContinuationReadyFile));
    const progress = await json(resolve(root, '.taskmaster/docs/ai-quality-v147-live-progress.json'));
    const scope = await json(resolve(root, ready.scopeFile));
    const profile = await json(resolve(root, ready.profileFile));
    assert.deepEqual([ready.expectedModelCalls, ready.expectedCountCalls, ready.syntheticChecks,
      ready.executorReady, ready.liveScopeApproved, ready.actualProviderCalls, ready.actualCountCalls,
      ready.actualKeyReads, ready.mainDispatchAuthorized], [48, 48, 20, true, false, 0, 0, 0, false]);
    assert.deepEqual([scope.maximumCombinedMicros, scope.restrictedMaximumMicros, scope.generalMaximumMicros],
      ['5690037', '5078796', '611241']);
    assert.deepEqual([profile.reservationMicros, profile.countAllowanceMicros, profile.combinedCountAllowanceMicros],
      ['611241', '35000', '1680000']);
    assert.equal(profile.countAllowanceFunding, 'general-first-count-restricted-other-47');
    assert.equal(ready.ledgerSha256, noorMc12.ledgerSha256);
    assert.equal(profile.studyPlanHash, ready.scopeSha256);
    assert.equal(createHash('sha256').update(await readFile(resolve(root, ready.scopeFile))).digest('hex'), ready.scopeSha256);
    assert.equal(createHash('sha256').update(await readFile(resolve(root, ready.profileFile))).digest('hex'), ready.profileSha256);
    const directory = dirname(resolve(root, ready.scopeFile));
    for (const [name, expected] of Object.entries(ready.evidenceSha256)) {
      assert.equal(createHash('sha256').update(await readFile(resolve(directory, name))).digest('hex'), expected);
    }
    assert.deepEqual([progress.pendingCalibrationContinuationExecutorReady, progress.continuationCollectorSyntheticChecks,
      progress.continuationLiveScopeApproved, progress.earmarkContinuationAuthorized], continuation ? [true, 20, true, true] : [true, 20, false, false]);
    assert.match(live.plan.context, /phase159.*남은 48회 수집기.*합성 20건.*US\$5\.690037.*승인 대기/);
  }
  if (continuation) {
    const progress = await json(resolve(root, '.taskmaster/docs/ai-quality-v147-live-progress.json'));
    const evidence = await json(resolve(root, continuation.evidenceFile));
    assert.equal(createHash('sha256').update(await readFile(resolve(root, continuation.evidenceFile))).digest('hex'), continuation.currentEvidenceSha256);
    assert.deepEqual([continuation.actualProviderCalls, continuation.actualCountCalls, continuation.actualKeyReads,
      continuation.transportComplete, continuation.newMatchingVotes], [48, 48, 1, true, 48]);
    assert.deepEqual([continuation.previousEvidenceSlots, continuation.currentEvidenceSlots, continuation.currentMatchedVotes,
      continuation.currentDenominator, continuation.currentUnavailableVotes, continuation.currentCriticalMissVotes], [24, 72, 72, 72, 0, 0]);
    assert.deepEqual(Object.values(continuation.perModel), Array.from({length: 3}, () => ({denominator: 24, matched: 24})));
    assert.equal(evidence.rows.length, 72);
    assert.ok(evidence.scored.every(row => row.available && row.gradeMatch && row.axesMatch && !row.missedCriticalFlags.length));
    assert.deepEqual([continuation.combinedUsedUpperMicros, continuation.generalUsedUpperMicros,
      continuation.restrictedUsedUpperMicros, continuation.combinedCountAllowanceRetainedMicros], ['3791283', '35000', '3756283', '1680000']);
    assert.equal(BigInt(continuation.generalUsedUpperMicros) + BigInt(continuation.restrictedUsedUpperMicros), BigInt(continuation.combinedUsedUpperMicros));
    assert.deepEqual([continuation.additionalUsedUpperMicros, continuation.additionalAvailableMicros, continuation.reservedMicros],
      [groupedActual?.beforeGeneralUsedUpperMicros ?? ledger.usedUpperMicros,
        groupedActual?.beforeGeneralAvailableMicros ?? ledger.availableMicros, ledger.reservedMicros]);
    assert.equal(BigInt(continuation.effectiveSupplementalUsedUpperMicros) + BigInt(continuation.conditionalRemainingMicros), 35000000n);
    assert.deepEqual([continuation.restrictedUnusedMicros, continuation.conditionalRemainingMicros], ['1322513', '1898754']);
    assert.deepEqual([continuation.fullCalibrationQualified, continuation.referencesQualified, continuation.pilotGenerationsCompleted,
      continuation.pilotReviewsCompleted, continuation.mainDispatchAuthorized], [false, 0, 0, 0, false]);
    for (const [name, expected] of Object.entries(continuation.evidenceSha256)) {
      assert.equal(createHash('sha256').update(await readFile(resolve(root, name))).digest('hex'), expected);
    }
    assert.deepEqual([progress.calibrationMatched, progress.calibrationCurrentScreensRated, progress.calibrationCurrentEvidenceSlots,
      progress.calibrationCurrentScreenUnreviewedSlots, progress.fullCalibrationQualified], [72, true, 72, 0, Boolean(v10Acceptance)]);
    assert.equal(live.tasks.find(row => String(row.id) === '25').status, v10Acceptance ? 'in-progress' : 'review');
    assert.match(live.plan.context, /phase160.*48응답\/48계산.*새 48\/48.*합계 72\/72.*중대 누락 0.*기존 71\/72 보존/);
    assert.ok(live.plan.budget.includes('이번 48회 합계 US$3.791283'));
    assert.ok(live.plan.budget.includes('전용 잔액 US$1.322513은 일반 가용액 아님'));
  }
  if (manifest.blindReferenceGroupsPreparationFile) {
    const grouped = await json(resolve(root, manifest.blindReferenceGroupsPreparationFile));
    const progress = await json(resolve(root, '.taskmaster/docs/ai-quality-v147-live-progress.json'));
    const plan = await json(resolve(root, grouped.planFile));
    assert.deepEqual([grouped.remainingCases, grouped.judgmentSlots, grouped.proposedModelCalls,
      grouped.proposedCountCalls, grouped.actualProviderCalls, grouped.actualCountCalls,
      grouped.actualKeyReads, grouped.referencesQualified], [54, 108, 3, 3, 0, 0, 0, 0]);
    assert.deepEqual([grouped.scopeApproved, grouped.newFundingClaimed, grouped.groupedEquivalenceEstablished,
      grouped.referenceRoleQualified, grouped.mainDispatchAuthorized], [false, false, false, false, false]);
    assert.equal(grouped.ledgerSha256, continuation.ledgerSha256);
    assert.equal(createHash('sha256').update(await readFile(resolve(root, grouped.planFile))).digest('hex'), grouped.groupedBodiesSha256);
    assert.equal(plan.hash, grouped.planHash);
    assert.deepEqual(plan.requests.map(row => row.privateBindings.length), [36, 36, 36]);
    assert.equal(plan.requests.length, 3);
    assert.ok(plan.requests.every(row => row.dispatchEligible === false));
    assert.deepEqual([progress.groupedReferencePreparedCases, progress.groupedReferencePreparedJudgments,
      progress.groupedReferenceProposedModelCalls, progress.groupedReferenceScopeApproved], [54, 108, 3, Boolean(groupedActual)]);
    assert.equal(live.tasks.find(row => String(row.id) === '24').status, 'in-progress');
    assert.match(live.plan.context, /phase161.*54문항.*108판정.*3개 요청.*정식 참조 0\/60/);
  }
  if (manifest.blindReferenceGroupsExecutorFile) {
    const executor = await json(resolve(root, manifest.blindReferenceGroupsExecutorFile));
    const profile = await json(resolve(root, executor.profileFile));
    const scope = await json(resolve(root, executor.scopeFile));
    const progress = await json(resolve(root, '.taskmaster/docs/ai-quality-v147-live-progress.json'));
    assert.deepEqual([executor.caseCount, executor.judgmentSlots, executor.expectedModelCalls, executor.expectedCountCalls,
      executor.collectorSyntheticChecks, executor.cliApprovalGateExpectedExitCode], [54, 108, 3, 3, 23, 1]);
    assert.deepEqual([executor.actualProviderCalls, executor.actualCountCalls, executor.actualKeyReads,
      executor.scopeApproved, executor.newFundingClaimed, executor.referencesQualified,
      executor.referenceRoleQualified, executor.mainDispatchAuthorized], [0, 0, 0, false, false, 0, false, false]);
    assert.equal(executor.ledgerSha256, continuation.ledgerSha256);
    assert.equal(createHash('sha256').update(await readFile(resolve(root, executor.scopeFile))).digest('hex'), executor.scopeSha256);
    assert.equal(createHash('sha256').update(await readFile(resolve(root, executor.profileFile))).digest('hex'), executor.profileSha256);
    assert.equal(BigInt(executor.generalMaximumMicros) + BigInt(executor.restrictedMaximumMicros), 1807916n);
    assert.equal(profile.reservationMicros, '485403');
    assert.equal(profile.countAllowanceMicros, '105000');
    assert.equal(scope.maximumMeasuredInputTokens, 50000);
    assert.equal(scope.maximumOutputTokens, 8192);
    for (const [file, expected] of Object.entries(executor.executionSha256)) {
      assert.equal(createHash('sha256').update(await readFile(resolve(root, file))).digest('hex'), expected);
    }
    assert.deepEqual([progress.groupedReferenceExecutorReady, progress.groupedReferenceCollectorSyntheticChecks,
      progress.groupedReferenceMaximumCombinedMicros, progress.groupedReferenceScopeApproved], [true, 23, '1807916', Boolean(groupedActual)]);
    assert.match(live.plan.context, /phase162.*수집기 23검사.*3응답\/3계산.*1\.807916.*승인 대기.*호출\/예약 0/);
  }
  if (groupedActual) {
    const progress = await json(resolve(root, '.taskmaster/docs/ai-quality-v147-live-progress.json'));
    const evidence = await json(resolve(root, groupedActual.evidenceFile));
    const approval = await json(resolve(root, groupedActual.approvalFile));
    assert.equal(createHash('sha256').update(await readFile(resolve(root, groupedActual.evidenceFile))).digest('hex'), groupedActual.caseEvidenceSha256);
    assert.deepEqual([groupedActual.actualProviderCalls, groupedActual.actualCountCalls, groupedActual.actualKeyReads,
      groupedActual.availableJudgments, groupedActual.unavailableJudgments], [3, 3, 1, 108, 0]);
    assert.deepEqual([groupedActual.languageAxesAgreementCases, groupedActual.sourceSupportedAgreementCases,
      groupedActual.heldSourceCases, groupedActual.heldLanguageDisagreementCases, groupedActual.initialAuthorDifferenceCases], [54, 50, 4, 0, 18]);
    assert.equal(evidence.cases.length, 54);
    assert.equal(evidence.cases.filter(row => row.status === 'held-source').length, 4);
    assert.ok(evidence.cases.every(row => row.languageAxesAgree && row.votes.length === 2 && !row.referenceQualified));
    assert.equal(groupedActual.beforeLedgerSha256, continuation.ledgerSha256);
    assert.equal(groupedActual.ledgerSha256, bilingualActual?.beforeLedgerSha256 ?? createHash('sha256').update(await readFile(resolve(root, manifest.currentSupplementalLedgerFile))).digest('hex'));
    assert.deepEqual([groupedActual.additionalUsedUpperMicros, groupedActual.additionalAvailableMicros,
      groupedActual.reservedMicros], [bilingualActual?.beforeGeneralUsedUpperMicros ?? ledger.usedUpperMicros,
        bilingualActual?.beforeGeneralAvailableMicros ?? ledger.availableMicros, ledger.reservedMicros]);
    assert.equal(BigInt(groupedActual.generalUsedUpperMicros) + BigInt(groupedActual.restrictedUsedUpperMicros), 542755n);
    assert.equal(groupedActual.countAllowanceRetainedMicros, '105000');
    assert.equal(BigInt(groupedActual.effectiveSupplementalUsedUpperMicros) + BigInt(groupedActual.conditionalRemainingMicros), 35000000n);
    assert.deepEqual([groupedActual.restrictedUnusedMicros, groupedActual.conditionalRemainingMicros], ['884758', '1355999']);
    assert.deepEqual([groupedActual.referencesQualified, groupedActual.referenceRoleQualified,
      groupedActual.groupedEquivalenceEstablished, groupedActual.mainDispatchAuthorized], [0, false, false, false]);
    assert.equal(approval.approved, true);
    assert.equal(approval.scopeSha256, groupedActual.scopeSha256);
    assert.equal(approval.maximumCombinedMicros, '1807916');
    for (const [file, expected] of Object.entries(groupedActual.evidenceSha256)) {
      assert.equal(createHash('sha256').update(await readFile(resolve(root, file))).digest('hex'), expected);
    }
    assert.deepEqual([progress.groupedReferenceExecutionCompleted, progress.groupedReferenceJudgmentsAvailable,
      progress.groupedReferenceLanguageAgreementCases, progress.groupedReferenceSourceSupportedCases,
      progress.groupedReferenceHeldSourceCases, progress.currentPaidScopeConsumed], [true, 108, 54, 50, 4, true]);
    assert.match(live.plan.context, /phase163.*3응답\/3계산.*108판정 유효.*언어 54\/54.*출처 양쪽 50\/54.*출처 보류 4/);
    assert.ok(live.plan.budget.includes('이번 3회 합계 US$0.542755'));
    assert.ok(live.plan.budget.includes('전용 잔액 US$0.884758은 일반 가용액 아님'));
  }
  if (manifest.referenceReconciliationPreparationFile) {
    const prepared = await json(resolve(root, manifest.referenceReconciliationPreparationFile));
    const directory = resolve(root, prepared.outputDirectory);
    const alternatives = await json(resolve(directory, 'reference-reconciliation.json'));
    const patch = await json(resolve(directory, 'source-patch-plan.json'));
    assert.deepEqual([prepared.alternativeDraftCases, prepared.sourcePatchCases, prepared.newSourceFacts,
      prepared.proposedModelCalls, prepared.proposedCountCalls, prepared.proposedJudgments], [18, 4, 6, 2, 2, 8]);
    assert.deepEqual([prepared.actualProviderCalls, prepared.actualCountCalls, prepared.actualKeyReads,
      prepared.referencesQualified, prepared.scopeApproved, prepared.mainDispatchAuthorized], [0, 0, 0, 0, false, false]);
    assert.equal(prepared.ledgerSha256, groupedActual.ledgerSha256);
    assert.equal(alternatives.cases.length, 18);
    assert.ok(alternatives.cases.every(row => !row.appliedToFrozenDraft && !row.referenceQualified));
    assert.deepEqual(patch.requests.map(row => row.privateBindings.length), [4, 4]);
    assert.equal(patch.currentUnmeasuredJudgments, 8);
    assert.equal(patch.oldResponsesReusedAsNewVotes, 0);
    for (const [file, expected] of Object.entries(prepared.evidenceSha256)) {
      assert.equal(createHash('sha256').update(await readFile(resolve(directory, file))).digest('hex'), expected);
    }
    assert.match(live.plan.context, /phase164.*18문항 수정안.*출처 요약 6개.*2요청\/8판정.*새 AI 호출 0/);
  }
 }else{
 if(manifest.fiveDollarDiagnosticExecutionFile){assert.equal(manifest.authorization.newPaidEvaluationMaxUsdBeforeTax,5);assert.equal(manifest.authorization.paidEvaluationApprovalScope,'public-g12-n04-diagnostic-only');assert.match(live.plan.budget,/US\$5/);if(manifest.twoReviewerFollowupExecutionFile){const follow=await json(resolve(root,manifest.twoReviewerFollowupExecutionFile));assert.equal(follow.actualProviderCalls,4);assert.equal(follow.actualCountApiCalls,4);assert.equal(follow.combinedMatched,24);assert.equal(follow.referenceRoleQualified,false);assert.equal(manifest.authorization.newEvaluationUsedUsdBeforeTax,4.471863);assert.equal(manifest.authorization.totalAuthorizedIncludingSupplementUsdBeforeTax,40);assert.match(live.plan.budget,/US\$4\.471863/);assert.match(live.plan.budget,/US\$0\.528137/);assert.match(live.plan.budget,/US\$35/);assert.match(live.plan.budget,/US\$40/);assert.match(live.plan.context,/24\/24/);assert.match(live.plan.context,/영어정답률아님/);}else if(manifest.publicControlBatchExecutionFile){const actual=await json(resolve(root,manifest.publicControlBatchExecutionFile));assert.equal(actual.actualProviderCalls,6);assert.equal(actual.actualCountApiCalls,6);assert.equal(actual.referenceRoleQualified,false);assert.equal(manifest.authorization.newEvaluationUsedUsdBeforeTax,3.788335);assert.match(live.plan.budget,/US\$3\.788335/);assert.match(live.plan.budget,/US\$1\.211665/);assert.match(live.plan.context,/10\/36/);assert.match(live.plan.context,/영어정답률아님/);}else if(manifest.measuredAstraExecutionFile){const measured=await json(resolve(root,manifest.measuredAstraExecutionFile));assert.equal(measured.actualProviderCalls,6);assert.match(live.plan.budget,/6\/6/);assert.ok(live.plan.budget.includes('US$'+(Number(measured.campaignUpperMicros)/1e6).toFixed(6)));}else{assert.match(live.plan.budget,/US\$0\.059060/);assert.match(live.plan.budget,/4\/6/);}}
 if(manifest.mainWitnessExecutionFile){const p=await json(resolve(root,manifest.mainWitnessExecutionFile)),ledger=await json(resolve(root,p.ledgerFile));assert.deepEqual([p.actualProviderCalls,p.actualCountApiCalls,p.actualKeyReads,p.totalProviderCalls],[72,72,1,346]);assert.deepEqual([p.witnesses,p.models,p.layouts,p.denominator],[12,3,2,72]);assert.equal(ledger.state,'settled');assert.equal(ledger.reservedMicros,'0');assert.equal(ledger.usedUpperMicros,p.supplementalUsedUpperMicros);assert.equal(p.sourceQualified,false);assert.equal(p.mainDispatchAuthorized,false);assert.equal(p.releaseVerdict,'held');assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,Number(p.supplementalUsedUpperMicros)/1e6);for(const value of['US$5','US$35','US$40','US$'+(Number(p.supplementalUsedUpperMicros)/1e6).toFixed(6),'US$'+(Number(p.additionalAvailableMicros)/1e6).toFixed(6),'US$'+(Number(p.totalConservativeMicros)/1e6).toFixed(6)])assert.ok(live.plan.budget.includes(value));for(const pattern of[/phase77/,/실제72응답/,/source48/,/키13/,/기대값/])assert.match(live.plan.context,pattern);}else if(manifest.reportedCostReconciliationFile){const p=await json(resolve(root,manifest.reportedCostReconciliationFile)),l=await json(resolve(root,p.ledgerFile));assert.equal(p.additionalUsedUpperMicros,'6143238');assert.equal(p.additionalAvailableMicros,'28856762');assert.equal(l.state,'issued');assert.equal(l.reservedMicros,'0');assert.equal(p.oldFinancialBooksUnchanged,2);assert.deepEqual([p.actualProviderCalls,p.actualCountApiCalls,p.actualKeyReads],[0,0,0]);assert.equal(p.newStudyActuallyCollected,false);assert.equal(p.pastContingencyIsEngineeringAssumption,true);assert.equal(p.invoiceVerified,false);assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,6.143238);for(const value of ['US$5','US$35','US$40','US$6.143238','US$28.856762','US$10.615101','US$6.431184'])assert.ok(live.plan.budget.includes(value));for(const pattern of [/phase76/,/27.096016/,/1달러/,/단한번/,/실제추가AI0/])assert.match(live.plan.context,pattern);}else if(manifest.mainWitnessPreparationFile){const p=await json(resolve(root,manifest.mainWitnessPreparationFile)),c=await json(resolve(root,manifest.reportedCostReconciliationProposalFile));assert.deepEqual([p.witnesses,p.individualRequests,p.models,p.layouts],[12,72,3,2]);assert.deepEqual([p.actualProviderCalls,p.actualCountApiCalls,p.actualKeyReads],[0,0,0]);assert.equal(p.sourceQualified,false);assert.equal(p.cumulativeProviderCalls,274);assert.equal(c.proposalOnly,true);assert.equal(c.ledgerAdjusted,false);assert.equal(c.reportedTotalUsd,'3.7071348');assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,33.239254);for(const value of ['US$33.239254','US$37.711117','US$1.760746','US$6.431184','미적용제안'])assert.ok(live.plan.budget.includes(value));for(const pattern of [/phase75/,/보정후보12/,/출처10/,/정확72/,/원장조정안/,/미적용/])assert.match(live.plan.context,pattern);}else if(manifest.explanationAstraExecutionFile){const p=await json(resolve(root,manifest.explanationAstraExecutionFile));assert.deepEqual([p.actualProviderCalls,p.actualCountApiCalls,p.totalProviderCalls],[18,18,274]);assert.deepEqual([p.matched,p.axesMatched,p.combinedMatched,p.combinedDenominator],[18,18,54,54]);assert.equal(p.mainDispatchAuthorized,false);assert.equal(p.englishTruthCertified,false);assert.equal(p.fullThreeModel54Qualified,false);assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,33.239254);for(const value of ['US$33.239254','US$37.711117','US$1.760746','28.096016'])assert.ok(live.plan.budget.includes(value));for(const pattern of [/phase74/,/Astra/,/18\/18/,/54\/54/,/자격/])assert.match(live.plan.context,pattern);}else if(manifest.explanationMainPreparationFile){const p=await json(resolve(root,manifest.explanationMainPreparationFile));assert.equal(p.syntheticMainIntegrated,true);assert.equal(p.liveMainExecuted,false);assert.equal(p.sourceQualified,false);assert.equal(p.automaticAdmission,false);assert.equal(p.actualProviderCalls,0);assert.equal(p.physicalFixtureModelCapturesEachNode,132);assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,34.516219);for(const value of ['US$34.516219','US$38.988082','US$0.483781'])assert.ok(live.plan.budget.includes(value));for(const pattern of [/phase73/,/설명/,/132/,/자격/,/실제추가AI0/])assert.match(live.plan.context,pattern);}else if(manifest.explanationPairExecutionFile){const registry=await json(resolve(root,'.taskmaster/docs/dashboard-plans.json')),entry=registry.plans.find(x=>x.id===PLAN),p=await json(resolve(root,manifest.explanationPairExecutionFile));assert.equal(entry.context,manifest.execution.dashboardContext);assert.equal(entry.budget,manifest.execution.dashboardBudget);assert.equal(p.actualProviderCalls,36);assert.equal(p.actualCountApiCalls,36);assert.equal(p.matched,36);assert.equal(p.axesMatched,36);assert.equal(p.limitedDevelopmentRuleSatisfied,true);assert.equal(p.astraEvaluated,false);assert.equal(p.mainIntegrated,false);assert.equal(p.fullThreeModel54Qualified,false);assert.equal(p.totalProviderCalls,256);assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,34.516219);for(const value of ['US$34.516219','US$38.988082','US$0.483781','26.896016'])assert.ok(live.plan.budget.includes(value));for(const pattern of [/36\/36/,/Astra/,/참인설명/,/거짓설명/])assert.match(live.plan.context,pattern);}else if(manifest.explanationScopePreparationFile){const registry=await json(resolve(root,'.taskmaster/docs/dashboard-plans.json')),entry=registry.plans.find(x=>x.id===PLAN),p=await json(resolve(root,manifest.explanationScopePreparationFile));assert.equal(entry.context,manifest.execution.dashboardContext);assert.equal(entry.budget,manifest.execution.dashboardBudget);assert.equal(p.developmentRows,9);assert.equal(p.pairedFamilies,4);assert.equal(p.individualRequestBodies,54);assert.equal(p.sourceRecords,7);assert.equal(p.actualProviderCalls,0);assert.equal(p.cumulativeProviderCalls,220);assert.equal(p.mainIntegrated,false);assert.equal(p.actualSemanticEffectMeasured,false);assert.equal(p.oldResultsRegraded,false);assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,33.077501);for(const value of ['US$33.077501','US$37.549364','US$1.922499'])assert.ok(live.plan.budget.includes(value));for(const pattern of [/후보기준4/,/설명주장범위분리/,/개별54/,/66\/72/])assert.match(live.plan.context,pattern);}else if(manifest.budgetedCriticalExecutionFile){const registry=await json(resolve(root,'.taskmaster/docs/dashboard-plans.json')),entry=registry.plans.find(x=>x.id===PLAN),p=await json(resolve(root,manifest.budgetedCriticalExecutionFile));assert.equal(entry.context,manifest.execution.dashboardContext);assert.equal(entry.budget,manifest.execution.dashboardBudget);assert.equal(p.actualProviderCalls,72);assert.equal(p.actualCountApiCalls,72);assert.equal(p.matched,66);assert.equal(p.axesMatched,72);assert.equal(p.criticalMissVotes,0);assert.equal(p.old4096ProfileQualified,false);assert.equal(p.mainIntegrated,false);assert.equal(p.limitedDevelopmentRuleSatisfied,false);assert.equal(p.totalProviderCalls,220);assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,33.077501);for(const value of ['US$33.077501','US$37.549364','US$1.922499'])assert.ok(live.plan.budget.includes(value));for(const pattern of [/66\/72/,/72\/72/,/CB08/,/중대플래그누락0/])assert.match(live.plan.context,pattern);}else if(manifest.criticalBoundaryPreparationFile){const registry=await json(resolve(root,'.taskmaster/docs/dashboard-plans.json')),entry=registry.plans.find(x=>x.id===PLAN);assert.equal(entry.context,manifest.execution.dashboardContext);assert.equal(entry.budget,manifest.execution.dashboardBudget);const p=await json(resolve(root,manifest.criticalBoundaryPreparationFile));assert.equal(p.developmentRows,12);assert.equal(p.sourceRecords,4);assert.equal(p.individualRequestBodies,72);assert.equal(p.actualProviderCalls,0);assert.equal(p.cumulativeProviderCalls,148);assert.equal(p.mainIntegrated,false);assert.equal(p.heldoutCasesFrozen,false);assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,27.642603);for(const value of ['US$27.642603','US$32.114466','US$7.357397'])assert.ok(live.plan.budget.includes(value));for(const pattern of [/후보기준3/,/공개개발12/,/개별요청72/,/실제추가AI/,/17\/18/])assert.match(live.plan.context,pattern);}else if(manifest.englishScopeComparisonExecutionFile){const registry=await json(resolve(root,'.taskmaster/docs/dashboard-plans.json')),entry=registry.plans.find(x=>x.id===PLAN);assert.equal(entry.context,manifest.execution.dashboardContext);assert.equal(entry.budget,manifest.execution.dashboardBudget);const a=await json(resolve(root,manifest.englishScopeComparisonExecutionFile));assert.equal(a.actualProviderCalls,36);assert.equal(a.actualCountApiCalls,36);assert.equal(a.mixed.matched,12);assert.equal(a.english.matched,17);assert.equal(a.english.axesMatched,18);assert.equal(a.newScopeLimitedRuleSatisfied,false);assert.equal(a.mainCompilerEnglishScopeIntegrated,false);assert.equal(a.totalProviderCalls,148);assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,27.642603);for(const value of ['US$27.642603','US$32.114466','US$7.357397'])assert.ok(live.plan.budget.includes(value));assert.match(live.plan.context,/12\/18/);assert.match(live.plan.context,/17\/18/);assert.match(live.plan.context,/R01/);assert.match(live.plan.context,/전체규칙미충족/);assert.match(live.plan.context,/66\/72/);}else if(manifest.assessmentCalibrationExecutionFile){const registry=await json(resolve(root,'.taskmaster/docs/dashboard-plans.json')),entry=registry.plans.find(x=>x.id===PLAN);assert.equal(entry.context,manifest.execution.dashboardContext);assert.equal(entry.budget,manifest.execution.dashboardBudget);const a=await json(resolve(root,manifest.assessmentCalibrationExecutionFile));assert.equal(a.actualProviderCalls,84);assert.equal(a.actualCountApiCalls,84);assert.equal(a.primaryMatched,66);assert.equal(a.primaryAxesMatched,72);assert.equal(a.contextContrastMatched,12);assert.equal(a.contextContrastAxesMatched,12);assert.equal(a.limitedCandidateRuleSatisfied,false);assert.equal(a.totalProviderCalls,112);assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,20.914282);for(const value of ['US$20.914282','US$25.386145','US$14.613855'])assert.ok(live.plan.budget.includes(value));assert.match(live.plan.context,/66\/72/);assert.match(live.plan.context,/12\/12/);assert.match(live.plan.context,/인과미검증/);assert.match(live.plan.context,/83\/84/);}else if(manifest.productCalibrationV3ExecutionFile){const cal=await json(resolve(root,manifest.productCalibrationV3ExecutionFile));assert.equal(cal.candidateMatched,83);assert.equal(cal.candidateSourceSatisfied,84);assert.equal(cal.candidateAxesMatched,84);assert.equal(cal.limitedCandidateRuleSatisfied,false);assert.equal(cal.totalProviderCalls,28);assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,5.058448);assert.match(live.plan.context,/83\/84/);assert.match(live.plan.context,/84\/84/);for(const value of ['US$5.058448','US$9.530311','US$30.469689'])assert.ok(live.plan.budget.includes(value));}else if(manifest.productCalibrationDiagnosticExecutionFile){const cal=await json(resolve(root,manifest.productCalibrationDiagnosticExecutionFile));assert.equal(cal.actualProviderCalls,6);assert.equal(cal.actualCountApiCalls,6);assert.equal(cal.candidateMatched,50);assert.equal(cal.candidateSourceSatisfied,61);assert.equal(cal.limitedCandidateRuleSatisfied,false);assert.equal(manifest.authorization.additionalBudgetUsedUsdBeforeTax,2.482733);assert.match(live.plan.context,/50\/72/);assert.match(live.plan.context,/61\/72/);for(const value of ['US$2.482733','US$6.954596','US$33.045404'])assert.ok(live.plan.budget.includes(value));}
 if(manifest.assessmentContextPreparationFile){const c=await json(resolve(root,manifest.assessmentContextPreparationFile));assert.equal(c.policyComplianceSeparateFromEnglishGrade,true);assert.equal(c.defaultContextKindExplicit,true);assert.equal(c.actualProviderCalls,0);assert.equal(c.englishQualityQualified,false);assert.match(live.plan.context,/실제목표필드/);assert.match(live.plan.context,/별도제품정책/);}
 }
 if(manifest.wordAppDiagnosticExecutorFile){
 const prepared=await json(resolve(root,manifest.wordAppDiagnosticExecutorFile));
 const progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([prepared.caseCount,prepared.productSlots,prepared.expectedModelCalls,prepared.expectedCountCalls,prepared.collectorSyntheticChecks,prepared.browserChecks],[2,6,6,6,18,12]);
 assert.deepEqual([prepared.maximumCombinedMicros,prepared.generalMaximumMicros,prepared.restrictedMaximumMicros,prepared.countAllowanceMicros],['1019168','359582','659586','210000']);
 assert.deepEqual([prepared.actualProviderCalls,prepared.actualCountCalls,prepared.actualKeyReads,prepared.formalPilotGenerations,prepared.referencesQualified],[0,0,0,0,0]);
 assert.equal(prepared.scopeApproved,false);assert.equal(prepared.mainDispatchAuthorized,false);assert.equal(prepared.inputTokensMeasured,false);
 assert.equal(prepared.collectorImplemented,true);assert.equal(prepared.allCountsBeforeModels,true);assert.equal(prepared.maximumMeasuredInputTokens,5000);
 assert.equal(prepared.hostTransportTimeoutMs,25500);assert.equal(prepared.appTimeoutMs,28000);
 const directory=resolve(root,prepared.outputDirectory);
 for(const [file,expected]of Object.entries(prepared.evidenceSha256)){
   assert.equal(createHash('sha256').update(await readFile(resolve(directory,file))).digest('hex'),expected);
 }
 assert.equal(progress.activeSubtaskId,currentManagementRecord?.activeSubtaskId??(postJointWord?'24.2':postJointCapture?'24.3':postJointDraft?'24.2':v10Acceptance?'24.3':v10Sources?'25.2':v10Rebind?'26.2':v10Live?'25.2':negativeControls?'34.4':manifest.bilingualProductReviewPreparationFile?'24.3':manifest.wordAppDiagnosticExecutionFile?'24.2':'24.4'));
 assert.equal(progress.wordAppDiagnosticScopeApproved,Boolean(manifest.wordAppDiagnosticExecutionFile));
 assert.equal(live.tasks.find(t=>t.id==='26').status,manifest.practical100RemediationFile?'done':manifest.practical100PreparationFile?'in-progress':'deferred');assert.equal(live.tasks.find(t=>t.id==='38').status,manifest.operatingVerificationFile?'done':'deferred');
 assert.match(live.plan.context,/phase172.*실제6응답\/6계산 준비.*수집기18검사.*새 승인\/호출\/예약0/);
 assert.match(live.plan.budget,/phase172 실제 앱 진단 제안: 최대 US\$1\.019168.*승인\/예약\/사용0/);
 }
 if(manifest.wordAppDiagnosticExecutionFile){
 const actual=await json(resolve(root,manifest.wordAppDiagnosticExecutionFile));
 const ledger=await json(resolve(root,manifest.currentSupplementalLedgerFile));
 const progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 const cases=await json(resolve(root,actual.evidenceFile)),browser=await json(resolve(root,actual.browserEvidenceFile));
 assert.deepEqual([actual.actualProviderCalls,actual.actualCountCalls,actual.actualKeyReads,actual.appFeedbacksReturned,actual.receiptReadbacks,actual.learningRecordsSaved],[6,6,1,6,6,6]);
 assert.deepEqual([actual.appValidationRejections,actual.appUnknownSlots,actual.automaticRetries,actual.newBrowserProviderCalls],[0,0,0,0]);
 assert.deepEqual([actual.combinedUsedUpperMicros,actual.generalUsedUpperMicros,actual.restrictedUsedUpperMicros,actual.restrictedUnusedMicros],['302077','210000','92077','567509']);
 assert.equal(actual.ledgerSha256,fixedReview?.beforeLedgerSha256??createHash('sha256').update(await readFile(resolve(root,manifest.currentSupplementalLedgerFile))).digest('hex'));
 assert.deepEqual([actual.additionalUsedUpperMicros,actual.additionalAvailableMicros,actual.reservedMicros],[fixedReview?.beforeGeneralUsedUpperMicros??ledger.usedUpperMicros,fixedReview?.beforeGeneralAvailableMicros??ledger.availableMicros,'0']);
 assert.equal(BigInt(actual.effectiveSupplementalUsedUpperMicros)+BigInt(actual.conditionalRemainingMicros),35000000n);
 assert.equal(actual.conditionalRemainingMicros,'723750');assert.equal(actual.mainDispatchAuthorized,false);assert.equal(actual.operationalProductionVerified,false);
 assert.equal(cases.cases.length,6);assert.equal(browser.checks.length,12);assert.equal(browser.usesActualCapturedReplies,true);assert.equal(browser.actualProviderCalls,0);
 assert.equal(createHash('sha256').update(await readFile(resolve(root,actual.evidenceFile))).digest('hex'),actual.caseEvidenceSha256);
 for(const [file,expected]of Object.entries(actual.evidenceSha256)){
   assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 }
 assert.equal(progress.wordAppDiagnosticPaidScopeConsumed,true);assert.equal(progress.wordAppDiagnosticActualBrowserChecks,12);
 assert.match(live.plan.context,/phase173.*6응답\/6계산 완료.*학습저장6\/6.*거절\/미확인\/재전송0/);
 assert.ok(live.plan.budget.includes('전용 잔액 US$0.567509은 일반 가용액 아님'));
 }
 if(manifest.bilingualProductReviewPreparationFile){
 const preparation=await json(resolve(root,manifest.bilingualProductReviewPreparationFile));
 const progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([preparation.syntheticObservations,preparation.plannedSyntheticReviewSlots,preparation.availableSyntheticReviewSlots,preparation.unavailableSyntheticReviewSlots],[360,1440,1260,180]);
 assert.deepEqual([preparation.actualAppObservations,preparation.preparedActualAppReviewSlots,preparation.independentActualAiProductGrades,preparation.regressionChecks],[6,24,0,9]);
 assert.deepEqual([preparation.actualProviderCalls,preparation.actualCountCalls,preparation.actualKeyReads],[0,0,0]);
 assert.equal(preparation.mainDispatchAuthorized,false);assert.equal(preparation.calibrationAcceptanceAllowed,false);
 assert.equal(preparation.ledgerSha256,fixedReview?.beforeLedgerSha256??createHash('sha256').update(await readFile(resolve(root,manifest.currentSupplementalLedgerFile))).digest('hex'));
 assert.equal(preparation.preparedSha256,createHash('sha256').update(await readFile(resolve(root,preparation.preparedFile))).digest('hex'));
 for(const [file,expected]of Object.entries(preparation.implementationSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.equal(progress.activeSubtaskId,currentManagementRecord?.activeSubtaskId??(postJointWord?'24.2':postJointCapture?'24.3':postJointDraft?'24.2':v10Acceptance?'24.3':v10Sources?'25.2':v10Rebind?'26.2':v10Live?'25.2':negativeControls?'34.4':'24.3'));assert.equal(progress.bilingualProductReviewCalibrated,Boolean(v10Acceptance));
 assert.equal(progress.calculationProvisionsReleased,Boolean(manifest.accountCostReconciliationFile));assert.equal(progress.tokenCountFeeOfficiallyConfirmed,false);
 assert.equal(preparation.fullPilotReviewCountProvisionMicros,'50400000');
 assert.match(live.plan.context,/phase174.*한국어 의도 제품 채점 기준 연결.*새 AI\/계산\/키0/);
 }
 if(manifest.groupedProductReviewPreparationFile){
 const prepared=await json(resolve(root,manifest.groupedProductReviewPreparationFile));
 const cost=await json(resolve(root,manifest.latestCostReadbackFile));
 const progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([prepared.logicalSlots,prepared.availableJudgments,prepared.unavailableSlots,prepared.physicalRequests,prepared.regressionChecks],[1440,1260,180,168,7]);
 assert.deepEqual([prepared.actualAppLogicalSlots,prepared.actualAppProposedPhysicalRequests,prepared.deduplicatedOrReusedVotes],[24,12,0]);
 assert.equal(prepared.outputTokensPerItemRetained,1024);assert.equal(prepared.actualEquivalenceEstablished,false);
 assert.equal(prepared.mainDispatchAuthorized,false);assert.equal(prepared.inputTokensMeasured,false);
 assert.equal(prepared.currentAvailableCountProvisionMicros,'5880000');assert.equal(prepared.allSuccessMinimumCountProvisionMicros,'6300000');
 assert.equal(prepared.ledgerSha256,fixedReview?.beforeLedgerSha256??createHash('sha256').update(await readFile(resolve(root,manifest.currentSupplementalLedgerFile))).digest('hex'));
 assert.equal(prepared.evidenceSha256,createHash('sha256').update(await readFile(resolve(root,prepared.evidenceFile))).digest('hex'));
 for(const [file,expected]of Object.entries(prepared.implementationSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.deepEqual([cost.newCapturedResponsesMatched,cost.currentDayReportedUsd,cost.modelChargesMatchExactly,cost.unattributedCurrentDayReportedUsd],[68,'1.35710005',true,'0']);
 assert.deepEqual([cost.inputTokens,cost.outputTokens,cost.uiTotalTokens],[412309,27723,412309]);
 assert.equal(cost.closedNov8And9UnchangedSincePriorExport,true);assert.equal(cost.countFeeLineItemObserved,false);
 assert.equal(cost.countFeeProvenFree,false);assert.equal(cost.invoiceVerified,false);assert.equal(cost.ledgerAdjusted,false);
 assert.equal(cost.csvSha256,createHash('sha256').update(await readFile(resolve(root,cost.csvFile))).digest('hex'));
 assert.equal(progress.reportedCurrentDayResponseMatches,68);assert.equal(progress.costReadbackLedgerAdjusted,false);
 assert.match(live.plan.context,/phase175.*1,440슬롯 보존.*168요청.*68응답 비용 US\$1\.35710005.*원장 조정0/);
 }
 if(manifest.closedDayProvisionAuditPreparationFile){
 const audit=await json(resolve(root,manifest.closedDayProvisionAuditPreparationFile));
 const progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([audit.selectedRuns,audit.selectedReceipts,audit.regressionChecks],[10,129,7]);
 assert.deepEqual([audit.candidateProvisionAdjustmentMicros,audit.beforeAvailableMicros,audit.candidateAvailableMicros,audit.candidateConditionalRemainingMicros],['4515000','156241','4671241','5238750']);
 assert.equal(audit.adjustmentApplied,false);assert.equal(audit.feeRiskDecisionRequired,true);assert.equal(audit.countApiProvenFree,false);
 assert.equal(audit.currentLedgerSha256,fixedReview?.beforeLedgerSha256??createHash('sha256').update(await readFile(resolve(root,manifest.currentSupplementalLedgerFile))).digest('hex'));
 assert.equal(audit.evidenceSha256,createHash('sha256').update(await readFile(resolve(root,audit.evidenceFile))).digest('hex'));
 for(const [file,expected]of Object.entries(audit.implementationSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.equal(progress.generalV3AvailableMicros,fixedReview?'0':'156241');assert.equal(progress.closedDayProvisionAdjustmentApplied,false);
 assert.equal(progress.closedDayProvisionCandidateReceipts,129);assert.equal(progress.mainDispatchAuthorized,false);
 assert.match(live.plan.context,/phase176.*129회 US\$4\.515.*과거 재배정245회 제외.*원장 조정0/);
 }
 if(postJointDraft){
 const r=postJointDraft,progress=await json(resolve(root,".taskmaster/docs/ai-quality-v147-live-progress.json"));
 assert.deepEqual([r.totalCases,r.wordCases,r.grammarCases,r.explicitKoreanIntents,r.grammarLessons,r.eachGrammarLessonCases,r.longCases],[60,30,30,30,15,2,12]);
 assert.deepEqual([r.knownDevelopmentMatches,r.priorBankMatches,r.repeatedTwelveWordScaffoldGroups,r.independentReferenceReviews,r.referencesQualified],[0,0,0,0,0]);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.newSpendUpperMicros],[0,0,0,"0"]);
 assert.equal(r.applicationBodiesCaptured,0);assert.equal(r.applicationTransportVerified,false);assert.equal(r.referenceQualified,false);assert.equal(r.mainDispatchAuthorized,false);
 assert.equal(r.productCodeChanged,false);assert.equal(r.judgeSemanticsChanged,false);assert.equal(r.oldBankAndScoresPreserved,true);
 assert.equal(progress.activeSubtaskId,currentManagementRecord?.activeSubtaskId??(postJointWord?'24.2':postJointCapture?'24.3':'24.2'));assert.equal(progress.currentFreshJointCandidateDrafts,60);assert.equal(progress.currentPostJointIndependentReviews,postJointGrammar?120:postJointWord?60:0);
 assert.equal(progress.currentDevelopmentKnownCandidateMatches,0);assert.equal(progress.priorBankKnownDevelopmentCandidateMatches,1);
 assert.equal(manifest.currentPostJointCohortDraftFile,r.draftFile);
 for(const[f,h]of [[r.draftFile,r.draftSha256],[r.jointFreezeFile,r.jointFreezeSha256],[r.mechanicalValidationFile,r.mechanicalValidationSha256],...Object.entries(r.authoringFiles)])
  assert.equal(createHash("sha256").update(await readFile(resolve(root,f))).digest("hex"),h);
 const bank=await json(resolve(root,r.draftFile));assert.equal(bank.cases.length,60);assert.equal(bank.jointFreezeHash,r.jointFreezeHash);
 assert.equal(bank.independentReferenceReviews,0);assert.equal(bank.qualifiedReferences,0);assert.equal(bank.mainDispatchAuthorized,false);
 assert(bank.cases.filter(c=>c.domain==="word").every(c=>c.contextRole==="intended_korean"&&/[가-힣]/.test(c.contextNote)));
 assert.match(live.plan.context,/phase191.*T24\.2.*새60초안/);
 }
 if(postJointLanguage){
 const r=postJointLanguage,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.cases,r.distinctReviewerSeats,r.proposedModelCalls,r.proposedCountCalls],[60,120,6,6]);
 assert(BigInt(r.minimumReservationMicros)>BigInt(r.conditionalRemainingMicros));
 assert.equal(r.inputTokensMeasured,false);assert.equal(r.countProvisionIsOfficialTariff,false);assert.equal(r.modelAdjustmentApplied,false);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.referencesQualified],[0,0,0,0]);
 assert.equal(progress.postJointLanguageReviewFundingHeld,!postJointGrammar);assert.equal(progress.postJointLanguageReviewActualResponses,postJointGrammar?6:postJointWord?3:0);
 for(const [file,expected]of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.match(live.plan.context,/phase193.*T24\.3.*120.*6/);
 }
 if(postJointCapture){
 const r=postJointCapture,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.applicationBodiesCaptured,r.baselineBodies,r.candidateBodies,r.failedReceiptReadbacks,r.duplicateProviderResends],[360,180,180,360,0]);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.referencesQualified,r.formalPilotGenerations,r.formalPilotGrades],[0,0,0,0,0,0]);
 assert.equal(r.syntheticRequestPathVerified,true);assert.equal(r.actualProviderTransportVerified,false);assert.equal(r.successfulLanguageFeedbackPathMeasured,false);
 assert.equal(r.mainDispatchAuthorized,false);assert.equal(progress.currentPostJointRequestBodiesCaptured,360);
 assert.equal(progress.activeSubtaskId,currentManagementRecord?.activeSubtaskId??(postJointWord?'24.2':'24.3'));
 for(const [file,expected] of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.match(live.plan.context,/phase192.*T24\.3.*360/);
 }
 if(postJointWord){
 const r=postJointWord,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.wordCases,r.wordLanguageJudgments,r.availableLanguageJudgments,r.exactAgreementCases,r.heldCases],[30,60,58,26,4]);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.referencesQualified,r.formalPilotGenerations,r.formalPilotGrades],[3,3,0,0,0]);
 assert.equal(r.conditionalRemainingMicros,'845906');assert.equal(r.modelReservationCreditAppliedMicros,'836637');
 assert.equal(r.tenPercentMarginRetained,true);assert.equal(r.originalCountProvisionsReleasedMicros,'0');assert.equal(r.newGrantCreated,false);
 assert.equal(progress.currentRestrictedFundingRemainingMicros,currentManagementRecord?.conditionalRemainingMicros??postJointFamily?.conditionalRemainingMicros??postJointRecheck?.conditionalRemainingMicros??postJointGrammar?.conditionalRemainingMicros??r.conditionalRemainingMicros);assert.equal(progress.postJointLanguageJudgmentsCompleted,postJointGrammar?120:60);
 assert.equal(manifest.currentRestrictedFundingFile,currentManagementRecord?.currentPaidFundingFile??(postJointFamily?manifest.postJointStructuralFamilyReviewExecutionFile:postJointRecheck?manifest.postJointSourceRecheckExecutionFile:postJointGrammar?manifest.postJointGrammarLanguageExecutionFile:manifest.postJointWordLanguageExecutionFile));
 for(const[file,expected]of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.match(live.plan.context,/phase194.*T24\.2.*60.*26.*4/);
 }
 if(postJointGrammar){
 const r=postJointGrammar,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.grammarCases,r.grammarLanguageJudgments,r.availableGrammarJudgments,r.languageAxisAgreementCases,r.sourceAdequateExactAgreementCases],[30,60,60,29,11]);
 assert.deepEqual([r.sourceOnlyHeldCases,r.sourceAndJudgmentDifferenceCases,r.actualProviderCalls,r.actualCountCalls],[18,1,3,3]);
 assert.equal(r.noInputCountRepeated,true);assert.equal(r.noModelRequestRepeated,true);assert.equal(r.reusedActualInputCounts,3);
 assert.equal(r.countedStageActualCountCalls,0);assert.equal(r.finalOutputTokenMax,8000);assert.equal(r.countRequestBodiesUnchanged,true);
 assert.equal(r.combinedUsedUpperMicros,'376843');assert.equal(r.conditionalRemainingMicros,'469063');
 assert.equal(r.fullLanguageJudgmentsCollected,120);assert.equal(r.fullLanguageJudgmentsParserAvailable,118);
 assert.equal(r.referencesQualified,0);assert.equal(r.formalPilotGenerations,0);assert.equal(r.mainDispatchAuthorized,false);
 assert.equal(manifest.currentRestrictedFundingFile,currentManagementRecord?.currentPaidFundingFile??(postJointFamily?manifest.postJointStructuralFamilyReviewExecutionFile:postJointRecheck?manifest.postJointSourceRecheckExecutionFile:manifest.postJointGrammarLanguageExecutionFile));
 assert.equal(progress.postJointLanguageJudgmentsCompleted,120);assert.equal(progress.currentRestrictedFundingRemainingMicros,currentManagementRecord?.conditionalRemainingMicros??postJointFamily?.conditionalRemainingMicros??postJointRecheck?.conditionalRemainingMicros??'469063');
 for(const[file,expected]of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.match(live.plan.context,/phase195.*T24\.2.*120.*29.*11/);
 }
 if(postJointSources){
 const r=postJointSources,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.primarySources,r.boundGrammarCases,r.referencesQualified,r.independentSourceApplicationsQualified],[20,19,0,0]);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.newSpendUpperMicros],[0,0,0,'0']);
 assert.equal(r.conditionalRemainingMicros,'469063');assert.equal(r.observedFactsAndApplicationHypothesesSeparated,true);
 assert.equal(r.allApplicationsStillRequireIndependentReview,true);assert.equal(r.original120LanguageVotesUnchanged,true);
 assert.equal(progress.postJointSourceSupplementPrimarySources,20);assert.equal(progress.postJointSourceSupplementGrammarCases,19);
 assert.equal(progress.postJointSourceApplicationsIndependentlyQualified,0);assert.equal(progress.postJointSourceFactHashesScopedToObservedSpans,true);
 assert.equal(manifest.currentPostJointPrimarySourceSupplementFile,r.supplementFile);
 for(const[file,expected]of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.match(live.plan.context,/phase196.*T24\.2.*19.*20/);
 }
 if(postJointRecheck){
 const r=postJointRecheck,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.grammarCases,r.languageJudgments,r.availableJudgments,r.pairedSourceCoverageSufficientCases,r.languageAxesAgreementCases,r.exactCorrectionAgreementCases,r.correctionSurfaceDifferenceCases],[19,38,38,19,19,18,1]);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.referencesQualified,r.formalPilotGenerations,r.formalPilotGrades],[2,2,0,0,0]);
 assert.equal(r.originalVotesAndScoresUnchanged,true);assert.equal(r.strictFrozenInspectionResultPreserved,true);
 assert.equal(r.combinedUsedUpperMicros,'146150');assert.equal(r.conditionalRemainingMicros,'322913');
 assert.equal(progress.postJointSourceRecheckJudgmentsCompleted,38);assert.equal(progress.postJointSourceRecheckPairedSourceSupportCases,19);
 assert.equal(manifest.currentRestrictedFundingFile,currentManagementRecord?.currentPaidFundingFile??(postJointFamily?manifest.postJointStructuralFamilyReviewExecutionFile:manifest.postJointSourceRecheckExecutionFile));
 for(const[file,expected]of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.match(live.plan.context,/phase197.*T24\.2.*19.*38/);
 }
 if(postJointCandidates){
 const r=postJointCandidates,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.candidateRecords,r.structurallyValidCandidates,r.pairedLanguageAxesAgreementCases,r.exactCorrectionAgreementCases,r.linguisticHeldCaseCount],[60,60,56,55,4]);
 assert.deepEqual([r.archivedFactOccurrencesExplicitlyLabeled,r.observedSourceFragmentOccurrences,r.correctionAlternativeExamplesPreserved],[26,23,2]);
 assert.equal(r.farParserHoldPreserved,true);assert.equal(r.allReferenceDraftsUnresolved,true);assert.equal(r.exposureCoverage,'partial');
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.newSpendUpperMicros,r.referencesQualified],[0,0,0,'0',0]);
 assert.equal(r.conditionalRemainingMicros,'322913');assert.equal(manifest.currentPostJointReferenceCandidatesFile,r.candidateFile);
 assert.equal(progress.currentPostJointReferenceRecordsStructurallyValid,60);assert.equal(progress.postJointReferenceLinguisticHeldCases,4);
 const candidates=await json(resolve(root,r.candidateFile));assert.equal(candidates.cases.length,60);assert.ok(candidates.cases.every(c=>c.draft.unresolved&&!c.referenceQualified));
 for(const[file,expected]of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.match(live.plan.context,/phase198.*T24\.2.*60.*56/);
 }
 if(postJointFamily){
 const r=postJointFamily,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.frozenIndexSurfacesRestored,r.priorBankRecordsIncluded,r.priorBankRecordsAddedOutsideFrozenIndex,r.knownEntriesShownPerReviewer],[1076,60,59,1136]);
 assert.deepEqual([r.rawStructuralProposals,r.formatAndMembershipAvailableProposals,r.outOfRangeCitationProposals],[120,117,3]);
 assert.equal(r.sourceReadbackMismatchObserved,true);assert.equal(r.semanticSourceAttributionQualified,false);
 assert.equal(r.structuralFamiliesQualified,0);assert.equal(r.referencesQualified,0);assert.equal(r.completeProjectExposure,false);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.prospectiveActualProviderCalls,r.prospectiveActualCountCalls],[2,2,0,0]);
 assert.equal(r.combinedUsedUpperMicros,'230136');assert.equal(r.conditionalRemainingMicros,'92777');
 assert.equal(r.prospectivePlanFundingHeld,true);assert.ok(BigInt(r.prospectiveMinimumReservationMicros)>BigInt(r.conditionalRemainingMicros));
 assert.equal(progress.postJointFamilySourceReadbackHeld,true);assert.equal(progress.postJointFamiliesQualified,0);
 assert.equal(manifest.currentRestrictedFundingFile,currentManagementRecord?.currentPaidFundingFile??(manifest.postJointStructuralFamilyReviewExecutionFile));
 for(const[file,expected]of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.match(live.plan.context,/phase199.*T24\.2.*1076.*120/);
 }
 if(currentManagementRecord){
 const r=currentManagementRecord,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 const funding=await json(resolve(root,r.currentPaidFundingFile));
 assert.equal(progress.currentRestrictedFundingRemainingMicros,r.conditionalRemainingMicros);
 assert.equal(funding.conditionalRemainingMicros,r.conditionalRemainingMicros);
 for(const[file,expected]of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 if(manifest.prospectiveGrammarContextCandidateFile){
  const prospective=await json(resolve(root,manifest.prospectiveGrammarContextCandidateFile));
  assert.deepEqual([prospective.promptVersion,prospective.validationVersion,prospective.frozen,prospective.actualProviderCalls,prospective.actualCountCalls],['reference-v11','judgment-v9',false,0,0]);
  assert.equal(contextCandidateHistory.source,prospective.candidateSource);
  assert.equal(contextCandidateHistory.frozen,false);
  assert.equal(contextCandidateHistory.newModelQualityMeasured,manifest.lessonCriteriaAlignmentFile?Boolean(manifest.lessonCriterionContrastExecutionFile):Boolean(manifest.contextCandidateActualExecutionFile));
  assert.equal(prospective.comparisons.length,3);assert.ok(prospective.comparisons.every(c=>c.synthetic&&c.candidate.accepted));
  if(manifest.contextCandidateActualExecutionFile){
   const actual=await json(resolve(root,manifest.contextCandidateActualExecutionFile));
   assert.deepEqual([actual.actualProviderCalls,actual.actualCountCalls,actual.appFeedbacksReturned,actual.receiptReadbacks,actual.learningReadbacks,actual.duplicateProviderResends],[2,2,2,2,2,0]);
   assert.equal(actual.formalQualityQualified,false);assert.equal(actual.pilotGenerationsCompleted,0);
   assert.equal(contextCandidateHistory.fullPanelQualityMeasured,false);
   const replay=await json(resolve(root,actual.runtimeDirectory,'../replay.json'));
   assert.ok(replay.results.every(c=>c.observedGrammarMatches&&c.learningReadbackEqual&&c.receiptReadbackEqual));
  }
  if(manifest.prospectiveReferenceContextVerificationFile){
   const encoding=await json(resolve(root,manifest.prospectiveReferenceContextVerificationFile));
   const currentContract=await json(resolve(root,contextCandidateHistory.decisionContractFile));
   assert.equal(encoding.decisionContractFile,manifest.lessonCriteriaAlignmentFile?currentContract.previousContract:contextCandidateHistory.decisionContractFile);
   assert.deepEqual([encoding.previouslySupportedProposals,encoding.previousEncodingAcceptedProposals,encoding.prospectiveEncodingAcceptedProposals,encoding.additionalEnglishJudgments],[7,5,7,0]);
   assert.equal(encoding.qualifiedReferences,0);assert.equal(encoding.oldScoresChanged,false);
   for(const[file,expected]of Object.entries(encoding.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
  }
  if(manifest.liveWordRouteExecutionFile){
   const actual=await json(resolve(root,manifest.liveWordRouteExecutionFile));
   assert.deepEqual([actual.actualProviderCalls,actual.actualCountCalls,actual.appFeedbacksReturned,actual.receiptReadbacks,actual.learningReadbacks,actual.duplicateProviderResends],[1,1,1,1,1,0]);
   assert.equal(actual.liveHostProviderTransportAwaitedByBuiltApp,true);assert.equal(actual.recordedResponseReplay,false);
   assert.equal(actual.input.english,'Two luggage block aisle.');assert.equal(actual.observed.grammar,'needs_work');
   assert.equal(actual.formalQualityQualified,false);assert.equal(actual.operationalProductionVerified,false);
   for(const[file,expected]of Object.entries(actual.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
  }
  if(manifest.contextLanguagePreparationFile){
   const prepared=await json(resolve(root,manifest.contextLanguagePreparationFile));
   assert.deepEqual([prepared.fullUnitTests,prepared.fullUnitPassed,prepared.fullUnitFailed,prepared.fullUnitExitCode],[915,915,0,0]);
   assert.deepEqual([prepared.prospectiveRequests,prepared.prospectiveCases,prepared.prospectiveJudgmentSlots],[4,31,62]);
   const currentSourceState=await json(resolve(root,contextCandidateHistory.sourceStateFile));
   assert.equal(prepared.candidateSourceStateFile,manifest.lessonCriteriaAlignmentFile?currentSourceState.previousSourceStateFile:contextCandidateHistory.sourceStateFile);
   assert.equal(prepared.mainDispatchAuthorized,false);assert.equal(prepared.qualifiedReferences,0);assert.equal(prepared.actualProviderCalls,0);
   const plan=await json(resolve(root,prepared.requestPlanFile));assert.ok(plan.requests.every(r=>r.dispatchEligible===false));
   for(const[file,expected]of Object.entries(prepared.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
  }
  if(manifest.accountCostReconciliationFile){
   const financial=await json(resolve(root,manifest.accountCostReconciliationFile));
   assert.equal(BigInt(financial.reconciledUsedUpperMicros)+BigInt(financial.conditionalRemainingMicros),35000000n);
   assert.equal(financial.openDayCountProvisionMicros,'6125000');assert.equal(financial.unresolvedModelReservationMicros,'2037721');
   assert.equal(financial.currentDayCountProvisionsReleased,false);assert.equal(financial.unresolvedModelReservationReleased,false);
   assert.equal(financial.invoiceVerified,false);assert.equal(financial.oldFiveReopened,false);assert.equal(financial.genericLedgerMutated,false);
   for(const[file,expected]of Object.entries(financial.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
  }
  if(manifest.lessonCriteriaAlignmentFile){
   const aligned=await json(resolve(root,manifest.lessonCriteriaAlignmentFile));
   assert.deepEqual([aligned.fullUnitPassed,aligned.fullUnitFailed,aligned.fullUnitExitCode],[916,0,0]);
   assert.deepEqual([aligned.actualProviderCalls,aligned.actualCountCalls,aligned.actualKeyReads],[0,0,0]);
   assert.equal(aligned.promptVersion,'reference-v12');assert.equal(aligned.validationVersion,'judgment-v9');
   assert.equal(contextCandidateHistory.promptVersion,aligned.promptVersion);
   assert.equal(contextCandidateHistory.sourceStateFile,aligned.candidateSourceStateFile);
   assert.equal(contextCandidateHistory.newModelQualityMeasured,Boolean(manifest.lessonCriterionContrastExecutionFile));
   assert.equal(aligned.qualifiedReferences,0);assert.equal(aligned.mainDispatchAuthorized,false);
   const readback=await json(resolve(root,aligned.languageReadbackFile));
   assert.deepEqual([readback.totals.cases,readback.totals.rawSeats,readback.totals.prospectiveAvailableSeats],[60,120,120]);
   assert.deepEqual(readback.totals.byStatus,{'paired-proposal-compatible':48,'held-label-difference':3,'held-source':9});
   assert.equal(readback.oldScoresChanged,false);assert.equal(readback.freshCohortClaimed,false);
   for(const[file,expected]of Object.entries(aligned.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
  }
  if(manifest.lessonCriterionContrastExecutionFile){
   const actual=await json(resolve(root,manifest.lessonCriterionContrastExecutionFile));
   assert.deepEqual([actual.actualProviderCalls,actual.actualCountCalls,actual.currentPolicyResponses,actual.counterfactualCriterionResponses],[4,4,2,2]);
   assert.deepEqual([actual.observedJudgmentGains,actual.observedJudgmentLosses,actual.observedJudgmentTies],[0,0,2]);
   assert.equal(actual.fullBaselineBuildCompared,false);assert.equal(actual.improvementDemonstrated,false);
   assert.equal(actual.usedUpperMicros,'154985');assert.equal(actual.conditionalRemainingMicros,'3237942');
   assert.equal(actual.qualifiedReferences,0);assert.equal(actual.mainDispatchAuthorized,false);
   const terminal=await json(resolve(root,actual.terminalFile));assert.equal(terminal.failureCode,null);
   assert.ok(terminal.flows.every(f=>f.httpStatus===200&&f.receiptReadbackEqual&&f.learningReadbackEqual&&f.duplicateProviderResends===0));
   assert.equal(terminal.flows.filter(f=>f.providerBodyEqualsCapturedAppBody).length,2);
   for(const[file,expected]of Object.entries(actual.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
  }
 }
 }
 if(manifest.practical100RemediationFile){
 const r=await json(resolve(root,manifest.practical100RemediationFile)),candidate=manifest.currentDevelopmentCandidate;
 assert.equal(manifest.currentManagementEvidenceFile,manifest.operatingVerificationFile??manifest.operatingAuthorizationFile??manifest.followupPreparationFile??manifest.featurePublicationFile??manifest.practicalReviewCompatibilityFile??manifest.practical100RemediationFile);
 assert.equal(candidate.source,r.candidateSource);assert.equal(candidate.sourceStateFile,r.candidateSourceStateFile);
 assert.deepEqual([candidate.promptVersion,candidate.validationVersion,candidate.frozen],['reference-v13','judgment-v10',false]);
 assert.equal(candidate.newModelQualityMeasured,true);assert.equal(candidate.fullPanelQualityMeasured,false);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.appFeedbacks,r.reviewJudgments,r.aiPairPass],[5,5,3,6,3]);
 assert.deepEqual([r.receiptReadbacks,r.learningReadbacks,r.foreignReceiptOwnershipChecks,r.duplicateProviderResends],[3,3,3,0]);
 assert.deepEqual([r.fullUnitTests,r.fullUnitExitCode,r.typecheckExitCode,r.lintExitCode,r.buildExitCode],[918,0,0,0,0]);
 assert.equal(r.old100Rescored,false);assert.equal(r.newSourceFull100Measured,false);assert.equal(r.remainingOldDisagreementCases,6);
 assert.equal(r.releaseReady,false);assert.equal(r.onePercentClaimAllowed,false);assert.equal(r.mainDispatchAuthorized,false);
 assert.equal(BigInt(r.reconciledUsedUpperMicros)+BigInt(r.conditionalRemainingMicros),35000000n);
 assert.equal(live.tasks.find(t=>t.id==='26').status,'done');
 const state=await json(resolve(root,r.candidateSourceStateFile));assert.equal(state.previousSourceStateFile,contextCandidateHistory.sourceStateFile);
 for(const[file,h]of Object.entries(state.sourceFiles))assert.equal(createHash('sha256').update(await readFile(resolve(candidate.source,file))).digest('hex'),h);
 const prior=await json(resolve(root,r.previousPractical100ExecutionFile));assert.deepEqual([prior.aiPairPassCases,prior.heldDisagreementCases,prior.appRejectedCases],[91,8,1]);
 for(const[file,h]of Object.entries(prior.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),h);
 const terminal=await json(resolve(root,r.terminalFile));assert.equal(terminal.failureCode,null);assert.equal(terminal.reviews.length,6);
 assert.ok(terminal.reviews.every(v=>v.result&&['meaning','grammar','correction','explanation','abstention'].every(d=>v.result.grade[d]==='pass')));
 }
 if(manifest.practicalReviewCompatibilityFile){
 const r=await json(resolve(root,manifest.practicalReviewCompatibilityFile));assert.equal(r.actualProviderCalls,0);assert.equal(r.actualCountCalls,0);
 assert.equal(r.completedTaskId,27);assert.equal(live.tasks.find(t=>t.id==='27').status,'done');
 assert.equal(r.remainingAiDisagreements,6);assert.equal(r.oldScoresChanged,false);assert.equal(r.compatibilityTestsPassed,7);
 assert.equal(r.strictQualityGateSatisfied,false);assert.equal(r.limitedFeaturePublicationApproved,false);assert.equal(r.releaseReady,false);
 const review=await json(resolve(root,r.reviewFile));assert.equal(review.allValidVisibleOutputsReviewed,99);assert.equal(review.remaining.length,6);
 const compatibility=await json(resolve(root,r.compatibilityFile));assert.equal(compatibility.exitCode,0);assert.equal(compatibility.productFilesUnchanged,765);
 const release=await json(resolve(root,r.publicationReviewFile));assert.equal(release.limitedFeaturePublicationAuthorized,false);assert.equal(release.publicationPerformed,false);
 assert.equal(release.existingSite.latestVersion,147);assert.equal(release.existingSite.environmentRevision,77);
 }
 if(manifest.featurePublicationFile){
 const r=await json(resolve(root,manifest.featurePublicationFile));assert.equal(r.limitedFeaturePublicationApproved,true);assert.equal(r.strictQualityGateSatisfied,false);
 assert.equal(r.publicationPerformed,true);assert.equal(r.version,148);assert.equal(r.nativeStatus,'succeeded');assert.equal(r.publicJsCssMatched,14);
 assert.equal(r.fullEnvironmentEntriesIdentical,true);assert.equal(r.operationalStudyAiVerified,false);assert.equal(r.onePercentClaimAllowed,false);
 assert.equal(live.tasks.find(t=>t.id==='29').status,'done');assert.equal(live.tasks.find(t=>t.id==='30').status,'done');assert.equal(live.tasks.find(t=>t.id==='40').status,'done');
 const publicResult=await json(resolve(root,'outputs/ai-quality-v147-implementation-20261106/phase221/production-verification.json'));assert.equal(publicResult.passed,true);
 }
 if(manifest.followupPreparationFile){
 const r=await json(resolve(root,manifest.followupPreparationFile));assert.equal(r.actualProviderCalls,0);assert.equal(r.actualCountCalls,0);assert.equal(r.localCapturedRequests,6);
 assert.equal(r.operationalScopeApproved,false);assert.equal(r.productionTransportImplemented,false);assert.equal(r.dedicatedOperatingAccountAssigned,false);
 assert.equal(r.day1Performed,false);assert.equal(r.day7Performed,false);assert.equal(r.goalComplete,false);
 assert.equal(manifest.currentAuthorization.existingSitePublicationApprovedAndCompleted,true);assert.equal(manifest.currentAuthorization.productionQaWritesApproved,Boolean(manifest.operatingAuthorizationFile));
 const audit=await json(resolve(root,r.requirementsAuditFile));assert.deepEqual([audit.macroCount,audit.microCount,audit.historyCount,audit.sufficiencyCount],[5,13,30,6]);assert.equal(audit.historicalSourceMismatches.length,0);
 const requests=await json(resolve(root,'outputs/ai-quality-v147-implementation-20261106/phase222/prepared-operational-requests.json'));assert.equal(requests.requests.length,6);assert.equal(requests.actualProviderCalls,0);
 }
 if(manifest.operatingAuthorizationFile){
 const r=await json(resolve(root,manifest.operatingAuthorizationFile));assert.equal(r.scopeApproved,true);assert.equal(r.productionQaWritesApproved,true);
 assert.equal(r.dedicatedTestAccountAssigned,false);assert.equal(r.normalAuthenticationVerified,false);assert.equal(r.productionTransportImplemented,false);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.productionStudyWrites],[0,0,0]);assert.equal(r.guardTestsPassed,7);assert.equal(r.guardTestExitCode,0);
 assert.equal(r.maximumMicros,'1019168');assert.equal(r.reservationMade,false);assert.equal(r.goalComplete,false);
 assert.equal(manifest.currentAuthorization.newOperationalPaidScopeApproved,true);assert.equal(manifest.currentAuthorization.dedicatedTestAccountAssigned,Boolean(manifest.operatingVerificationFile));
 }
 if(manifest.operatingVerificationFile){
 const r=await json(resolve(root,manifest.operatingVerificationFile));
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.storedReloadedSlots,r.normalAuthenticatedUiSlots],[6,6,1,6,6]);
 assert.ok(r.scopeApproved&&r.dedicatedTestAccountAssigned&&r.normalAuthenticationVerified&&r.operationalProductionVerified&&r.settingsRestored);
 assert.equal(r.sourceChanged,false);assert.equal(r.publicationChanged,false);assert.equal(r.automaticRetry,false);assert.equal(r.allHistoricalRowsCompared,false);
 assert.equal(r.usedUpperMicros,'904946');assert.equal(r.conditionalRemainingMicros,'3955111');assert.equal(r.countProvisionRetainedMicros,'210000');
 assert.equal(BigInt(r.reconciledUsedUpperMicros)+BigInt(r.conditionalRemainingMicros),35000000n);
 assert.equal(r.modelTokenUsageObserved,false);assert.equal(r.invoiceVerified,false);assert.equal(r.countProvisionIsOfficialTariff,false);
 assert.equal(r.goalComplete,false);assert.equal(r.onePercentClaimAllowed,false);assert.equal(r.day1Performed,false);assert.equal(r.day7Performed,false);
 assert.equal(live.plan.gates.find(g=>g.id==='AQ-O').result.status,'passed');
 const task=live.tasks.find(t=>t.id==='38');assert.equal(task.status,'done');assert.ok(task.subtasks.every(t=>t.status==='done'));
 for(const[file,h]of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),h);
 }
 if(developmentFamilies){
 const r=developmentFamilies,progress=await json(resolve(root,".taskmaster/docs/ai-quality-v147-live-progress.json"));
 assert.deepEqual([r.programKnownSurfaces,r.publicCalibrationItems,r.publicCalibrationUniqueSurfaces,r.newCalibrationSurfaces,r.combinedDevelopmentSurfaces],[1073,60,7,3,1076]);
 assert.deepEqual([r.knownCandidateCases,r.majorScaffoldGroups,r.casesWithSharedScaffold,r.declaredFamilyLabels,r.sharedDeclaredLabelGroups],[1,2,6,58,2]);
 assert.deepEqual(r.knownCaseIds,["ko-word-needsCorrection-03"]);assert.equal(r.knownCaseGuardBlocked,true);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.newSpendUpperMicros],[0,0,0,"0"]);
 assert.equal(r.requiredNextCohortCases,60);assert.equal(r.newPostSealDraftCases,0);assert.equal(r.referencesQualified,0);assert.equal(r.mainDispatchAuthorized,false);
 assert.equal(progress.currentDevelopmentKnownCandidateMatches,postJointDraft?0:1);assert.equal(progress.currentDevelopmentKnownSurfaceCount,1076);
 assert.equal(progress.currentScaffoldAffectedCases,postJointDraft?0:6);assert.equal(progress.currentFreshJointCandidateDrafts,postJointDraft?60:0);
 assert.equal(manifest.prospectiveDevelopmentExposureIndexFile,r.indexFile);assert.equal(manifest.currentJointEvaluationFreezeFile,r.jointFreezeFile);
 for(const[f,h]of [[r.indexFile,r.indexSha256],[r.auditFile,r.auditSha256],[r.jointFreezeFile,r.jointFreezeSha256],[r.sourceBankFile,r.sourceBankSha256]])
  assert.equal(createHash("sha256").update(await readFile(resolve(root,f))).digest("hex"),h);
 const freeze=await json(resolve(root,r.jointFreezeFile));assert.equal(freeze.hash,r.jointFreezeHash);assert.equal(freeze.nextCohortSize,60);
 assert.equal(freeze.requiredBilingualWordCases,30);assert.equal(freeze.requiredGrammarCases,30);assert.equal(Object.keys(freeze.requiredAllocation).length,6);
 assert.equal(freeze.productSourceFilesVerified,765);assert.equal(freeze.referencePolicyVersion,4);assert.equal(freeze.referenceQualified,false);
 assert.equal(freeze.mainDispatchAuthorized,false);assert.equal(freeze.newPaidApprovalGranted,false);
 const dossier=await json(resolve(root,r.auditFile));assert.equal(dossier.independentFamiliesAdmitted,0);assert.equal(dossier.counts.knownDevelopmentCases,1);
 assert.match(live.plan.context,/phase190.*T24\.2.*ko-word-needsCorrection-03/);
 }
 if(currentProgramTemplates){
 const r=currentProgramTemplates,progress=await json(resolve(root,".taskmaster/docs/ai-quality-v147-live-progress.json"));
 assert.deepEqual([r.candidateTemplates,r.englishTemplates,r.nonLearningTemplates,r.generatedOccurrences,r.currentUniqueGeneratedSurfaces],[15,12,3,76,69]);
 assert.deepEqual([r.unresolvedSelectedTemplates,r.knownSurfaceIndexSize,r.candidateCasesChecked,r.candidateMatches,r.positiveControlMatches],[0,1073,60,0,69]);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.newSpendUpperMicros],[0,0,0,"0"]);
 assert.equal(r.completeForSelectedCandidateFrames,true);assert.equal(r.sourceExecutionPerformed,false);assert.equal(r.completeProjectExposure,false);
 assert.equal(r.structuralFamiliesCertified,false);assert.equal(r.referencesQualified,0);assert.equal(r.mainDispatchAuthorized,false);
 assert.equal(progress.currentProgramUnexpandedTemplates,0);assert.equal(progress.currentFiniteSelectedCoverageComplete,true);
 assert.equal(progress.currentProgramExposureUniqueSurfaces,1073);assert.equal(progress.referenceRoleReviewExactMatches,60);
 assert.equal(manifest.prospectiveCurrentProgramExposureIndexFile,r.indexFile);
 for(const[f,h]of [[r.expansionFile,r.expansionSha256],[r.indexFile,r.indexSha256],[r.screenFile,r.screenSha256],[r.baseIndexFile,r.baseIndexSha256]])
  assert.equal(createHash("sha256").update(await readFile(resolve(root,f))).digest("hex"),h);
 const index=await json(resolve(root,r.indexFile));assert.equal(index.completeForSelectedTestTemplates,true);assert.equal(index.allDynamicInputsEnumerated,false);
 assert.equal(index.referenceQualified,false);assert.equal(index.mainDispatchAuthorized,false);
 assert.match(live.plan.context,/phase189.*T24\.3.*미처리0/);
 }
 if(referenceRoleCompact){
 const r=referenceRoleCompact,progress=await json(resolve(root,".taskmaster/docs/ai-quality-v147-live-progress.json"));
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.exactGradeMatches,r.judgments,r.criticalMisses],[6,6,1,60,60,0]);
 assert.equal(r.policyVersion,4);assert.equal(r.declaredPublicRoleCalibrationPassed,true);assert.equal(r.maximumObservedGroupItems,10);
 assert.equal(Object.keys(r.modelLayoutCells).length,6);assert(Object.values(r.modelLayoutCells).every(n=>n===10));
 assert.equal(r.referenceRoleQualified,false);assert.equal(r.referencesQualified,0);assert.equal(r.mainDispatchAuthorized,false);
 assert.equal(r.reversibleAliasingVerified,true);assert.equal(r.previous59Of60ScoreUnchanged,true);assert.equal(r.isolatedCausalEffectEstablished,false);
 assert.equal(r.actualInputTokens,85018);assert.equal(r.actualOutputTokens,7037);assert.equal(r.previousProtocolInputTokens,170932);
 assert.equal(progress.referenceRoleReviewExactMatches,60);assert.equal(progress.referenceRoleBoundaryDisagreements,0);assert.equal(progress.referenceRolePolicyVersion,4);
 assert.equal(progress.referenceRoleStrictCalibrationPassed,true);assert.equal(progress.qualifiedReferences,0);
 const funding=await json(resolve(root,r.fundingSettlementFile));assert.equal(funding.usedUpperMicros,"882107");assert.equal(funding.conditionalRemainingMicros,"331099");
 assert.equal(funding.generalLedgerUnchanged,true);assert.equal(funding.originalClosedFiveReopened,false);
 for(const[f,h]of [[r.preparedFile,r.preparedSha256],[r.fundingSettlementFile,r.fundingSettlementSha256],[r.runtimeTerminalFile,r.runtimeTerminalSha256],[r.previousExecutionFile,r.previousExecutionSha256]])
  assert.equal(createHash("sha256").update(await readFile(resolve(root,f))).digest("hex"),h);
 assert.match(live.plan.context,/phase188.*T24\.3.*60판정 전부 일치/);assert.match(live.plan.budget,/US\$0\.882107/);
 }
 if(referenceRoleCalibration){
 const r=referenceRoleCalibration,progress=await json(resolve(root,".taskmaster/docs/ai-quality-v147-live-progress.json"));
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.exactGradeMatches,r.judgments,r.criticalMisses],[6,6,2,59,60,0]);
 assert.equal(r.coreBoundaryJudgmentsSupported,18);assert.equal(r.referenceRoleQualified,false);assert.equal(r.strictRoleCalibrationPassed,false);
 assert.equal(r.referencesQualified,0);assert.equal(r.mainDispatchAuthorized,false);assert.equal(r.historicalEvidenceModified,false);
 if(!referenceRoleCompact){assert.equal(progress.referenceRoleReviewExactMatches,59);assert.equal(progress.referenceRoleBoundaryDisagreements,1);}
 assert.equal(r.disagreement.name,"omitted-supported-completion");assert.equal(r.disagreement.mismatches[0].dimension,"ambiguityHandling");
 const funding=await json(resolve(root,r.fundingSettlementFile));
 assert.equal(funding.combinedUsedUpperMicros,"1545707");assert.equal(funding.conditionalRemainingMicros,"1213206");
 assert.equal(funding.unattemptedCountProvisionUnusedMicros,"175000");assert.equal(funding.countProvisionRetainedMicros,"210000");
 assert.equal(funding.generalLedgerUnchanged,true);assert.equal(funding.originalClosedFiveReopened,false);
 for(const[f,h]of [[r.preparedFile,r.preparedSha256],[r.fundingSettlementFile,r.fundingSettlementSha256],...r.runtimeTerminalFiles.map((f,i)=>[f,r.runtimeTerminalSha256[i]])])
  assert.equal(createHash("sha256").update(await readFile(resolve(root,f))).digest("hex"),h);
 assert.match(live.plan.context,/phase187.*T24\.3.*59\/60/);assert.match(live.plan.budget,/US\$1\.545707/);
 }
 if(currentExposureSources){
 const r=currentExposureSources,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.testSourceFiles,r.currentStaticOccurrences,r.currentUniqueSurfaces,r.currentUnexpandedTemplates,r.combinedUniqueSurfaces],[126,882,614,15,1073]);
 assert.deepEqual([r.candidateCasesChecked,r.knownSurfaceMatches,r.knownPositiveControlMatches,r.editorialSupportingRuleCases,r.editorialRegionalConflictCases],[60,0,8,3,1]);
 assert.deepEqual([r.newProviderCalls,r.newCountCalls,r.newKeyReads,r.referencesQualified],[0,0,0,0]);
 assert.equal(r.currentSourceBindingsVerified,true);assert.equal(r.completeProjectExposure,false);assert.equal(r.freshnessQualified,false);assert.equal(r.structuralFamiliesCertified,false);
 for(const[f,h]of [[r.indexFile,r.indexFileSha256],[r.auditFile,r.auditSha256],[r.screenFile,r.screenSha256],[r.sourceFile,r.sourceSha256],[r.literalRoleFile,r.literalRoleSha256]])assert.equal(createHash('sha256').update(await readFile(resolve(root,f))).digest('hex'),h);
 const sources=await json(resolve(root,r.sourceFile));assert.equal(sources.sources.length,8);assert.equal(sources.conflictingRegionalCases,1);assert.equal(sources.independentSourceReviewCompleted,false);
 assert.equal(sources.cases.find(c=>c.caseId==='fresh-grammar-insufficientContext-08').regionalVerdictEstablished,false);
 assert.equal(progress.currentProgramExposureBindingsVerified,true);assert.equal(progress.currentReferenceRegionalConflicts,1);assert.equal(progress.qualifiedReferences,0);
 assert.match(live.plan.context,/phase186.*T24\.3.*테스트126파일.*규칙근거3개.*충돌1개 보류/);
 }
 if(bilingualReferenceRecords){
 const r=bilingualReferenceRecords,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.caseCount,r.wordCases,r.grammarCases,r.languageVotesReused,r.parentPayloadsChecked,r.structurallyValidatedDrafts],[60,30,30,120,180,60]);
 assert.deepEqual([r.explicitKoreanDrafts,r.naturalEnglishMeaningCorrections,r.authorDifferenceCases,r.sourceAdequacyHeldCases.length],[30,3,15,4]);
 assert.deepEqual([r.newProviderCalls,r.newCountCalls,r.newKeyReads,r.referencesQualified,r.referenceRoleQualified],[0,0,0,0,false]);
 assert.equal(r.mainDispatchAuthorized,false);assert.equal(r.freshnessQualified,false);assert.equal(r.oldFrozenDraftsChanged,false);assert.equal(r.oldScoresRescored,false);
 const policy=await json(resolve(root,r.policyFile)),old=await json(resolve(root,r.previousPolicyFile));
 assert.equal(policy.version,2);assert.equal(Object.keys(policy.dimensions).length,7);assert.equal(Object.keys(policy.criticalFlags).length,5);
 assert.deepEqual(policy.dimensions.exposureAndFamilyCompliance,old.dimensions.exposureAndFamilyCompliance);assert.equal(policy.independentQualification,false);
 for(const[f,h]of [[r.candidateFile,r.candidateSha256],[r.auditFile,r.auditSha256],[r.policyFile,r.policySha256],[r.previousPolicyFile,r.previousPolicySha256]])assert.equal(createHash('sha256').update(await readFile(resolve(root,f))).digest('hex'),h);
 const candidates=await json(resolve(root,r.candidateFile));assert.equal(candidates.cases.length,60);assert.ok(candidates.cases.every(c=>c.languageEvidence.length===2&&!c.referenceQualified));
 assert.equal(manifest.bilingualReferenceRoleRequalificationRequired,true);assert.equal(progress.bilingualReferenceLanguageVotesBound,120);assert.equal(progress.qualifiedReferences,0);
 assert.match(live.plan.context,/phase185.*T24\.3.*언어 제안120개.*참조0\/60/);
 }
 if(v10Acceptance){
 const r=v10Acceptance,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.calibrationAccepted,r.sourceWitnessesQualified,r.logicalJudgments,r.gradeMatches,r.axesMatches,r.maximumCalibratedGroupItems],[true,12,72,72,72,4]);
 assert.ok(r.modelLayoutCells.every(c=>c.denominator===12&&c.matches===12&&c.axesMatches===12&&c.criticalMisses===0));
 assert.deepEqual([r.syntheticLogicalSlots,r.syntheticAvailableSlots,r.syntheticUnavailableSlots,r.syntheticPhysicalRequests],[1440,1260,180,324]);
 assert.deepEqual([r.newProviderCalls,r.newCountCalls,r.newKeyReads,r.referencesQualified,r.formalPilotGenerations],[0,0,0,0,0]);
 assert.equal(r.englishTruthCertified,false);assert.equal(r.mainDispatchAuthorized,false);assert.equal(r.individualGroupedEquivalenceEstablished,false);
 for(const[f,h]of [[r.acceptanceFile,r.acceptanceSha256],[r.preparedFile,r.preparedSha256]])assert.equal(createHash('sha256').update(await readFile(resolve(root,f))).digest('hex'),h);
 assert.equal(progress.v10CalibrationAccepted,true);assert.equal(progress.fullCalibrationQualified,true);assert.equal(progress.v10CalibratedMaximumGroupItems,4);
 const task=live.tasks.find(t=>String(t.id)==='25');assert.equal(task.subtasks.find(s=>String(s.id)==='2').status,'done');assert.equal(task.subtasks.find(s=>String(s.id)==='3').status,'done');
 assert.match(live.plan.context,/phase184.*T25\.2.*25\.3.*보정 수락/);
 assert.match(live.plan.gates.find(g=>g.id==='AQ-G3').result.detail,/v10 AI-only 보정 수락.*참조0\/60/);
 }
 if(v10Sources){
 const r=v10Sources,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.candidateMatches,r.candidateDenominator,r.controlsPassed],[3,3,1,36,36,6]);
 assert.deepEqual([r.qualifiedWitnesses,r.availableLanguageWitnesses,r.absentFeedbackControlWitnesses],[12,11,1]);
 assert.equal(r.sourceQualifiedForDeclaredAiOnlyPolicy,true);assert.equal(r.formalCalibrationQualification,false);assert.equal(r.mainDispatchAuthorized,false);assert.equal(r.englishTruthCertified,false);
 assert.deepEqual([r.combinedUsedUpperMicros,r.countProvisionMicros,r.conditionalRemainingMicros,r.formalCountProvisionRetainedMicros],['437743','105000','238913','2520000']);
 assert.equal(manifest.currentRestrictedFundingFile,currentManagementRecord?.currentPaidFundingFile??(postJointFamily?manifest.postJointStructuralFamilyReviewExecutionFile:postJointRecheck?manifest.postJointSourceRecheckExecutionFile:postJointGrammar?manifest.postJointGrammarLanguageExecutionFile:postJointWord?manifest.postJointWordLanguageExecutionFile:referenceRoleCompact?manifest.referenceRoleCompactExecutionFile:referenceRoleCalibration?manifest.referenceRoleCalibrationExecutionFile:manifest.sourceReviewV10ExecutionFile));assert.equal(progress.currentWitnessSourceQualifiedCount,12);assert.equal(progress.fullCalibrationQualified,Boolean(v10Acceptance));
 const registry=await json(resolve(root,r.registryFile));assert.equal(registry.qualifiedWitnesses,12);assert.equal(registry.calibrationAcceptanceAllowed,false);assert.equal(registry.entries.length,12);
 for(const[f,h]of [[r.registryFile,r.registrySha256],[r.runtimeTerminalFile,r.runtimeTerminalSha256],[r.fundingSettlementFile,r.fundingSettlementSha256],[r.auditFile,r.auditSha256]])assert.equal(createHash('sha256').update(await readFile(resolve(root,f))).digest('hex'),h);
 assert.match(live.plan.context,/phase183.*근거 AI 검토36\/36.*통제6\/6.*자격12\/12/);assert.ok(live.plan.budget.includes('US$0.238913'));
 if(!v10Acceptance)assert.match(live.plan.gates.find(g=>g.id==='AQ-G3').result.detail,/AI-only 출처 자격12\/12.*정식 보정 수락/);
 }
 if(v10Rebind){
 const r=v10Rebind,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.policyVersion,r.syntheticObservations,r.syntheticLogicalSlots,r.syntheticAvailableSlots,r.syntheticUnavailableSlots,r.syntheticGroupedRequests],[10,360,1440,1260,180,168]);
 assert.deepEqual([r.actualAppObservations,r.actualAppLogicalSlots,r.actualAppGroupedRequests,r.verifiedEvidencePackets],[6,24,12,1464]);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.formalPilotGenerations,r.formalPilotGrades],[0,0,0,0,0]);
 assert.equal(r.sourceQualified,false);assert.equal(r.mainDispatchAuthorized,false);assert.equal(r.priorScoresRescored,false);
 assert.equal(r.ledgerSha256,createHash('sha256').update(await readFile(resolve(root,manifest.currentSupplementalLedgerFile))).digest('hex'));
 for(const[f,h]of [[r.preparedIndividualFile,r.preparedIndividualSha256],[r.preparedGroupedFile,r.preparedGroupedSha256],[r.auditFile,r.auditSha256]])assert.equal(createHash('sha256').update(await readFile(resolve(root,f))).digest('hex'),h);
 assert.equal(progress.v10PreparedPlansRebound,true);assert.equal(manifest.preparedProductReviewRebindComplete,true);
 assert.equal(manifest.productReviewRebindRequired,true);assert.match(live.plan.context,/phase182.*T26\.2.*1,440슬롯.*부재180/);
 }
 if(v10Live){
 const r=v10Live,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.logicalGrades,r.exactGradeMatches,r.axesMatches],[18,18,1,72,72,72]);
 assert.equal(r.observedCriterionSatisfied,true);assert.equal(r.criticalMisses,0);assert.equal(r.extraCriticalVotes,0);
 assert.ok(r.byModel.every(m=>m.available===24&&m.matches===24&&m.axesMatches===24&&m.criticalMisses===0));
 assert.equal(r.formalCalibrationQualification,false);assert.equal(r.sourceQualified,false);assert.equal(r.mainDispatchAuthorized,false);assert.equal(r.freshHoldout,false);
 assert.deepEqual([r.modelUpperMicros,r.countProvisionMicros,r.combinedUsedUpperMicros],['1039862','630000','1669862']);
 assert.equal(r.funding.formalSourceUsedUpperMicros,'0');assert.equal(r.funding.formalUnusedReturnedToProvisionMicros,'1948803');assert.equal(r.funding.formalCountProvisionRetainedMicros,'2520000');
 assert.equal(BigInt(r.failedV9ReconciledUpperMicros)+BigInt(r.failedV9RefundMicros),2806936n);
 assert.equal(r.funding.conditionalRemainingMicros,'676656');assert.equal(r.generalLedgerUnchanged,true);assert.equal(r.newGrantCreated,false);
 assert.equal(progress.withholdingReviewActualGrades,72);assert.equal(progress.v10GradeMatches,72);assert.equal(progress.closedDayProvisionUnassignedHeldMicros,'0');
 assert.equal(progress.withholdingReviewPaidExecutionPrepared,true);assert.equal(progress.v10PaidScopeConsumed,true);
 assert.equal(Object.keys(r.sourceClaimSha256).length,3);
 assert.equal(manifest.currentDevelopmentProductReviewPolicyFile,withholdingReview.policyFile);assert.equal(manifest.productReviewRebindRequired,true);
 for(const[f,h]of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,f))).digest('hex'),h);
 assert.match(live.plan.context,/phase181.*실제 보정72\/72.*각24\/24.*중대 누락0/);assert.ok(live.plan.budget.includes('US$1.669862'));assert.ok(live.plan.budget.includes('US$0.676656'));
 }
 if(withholdingReview){
 const w=withholdingReview,policy=await json(resolve(root,w.policyFile)),old=await json(resolve(root,w.previousPolicyFile));
 const progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([w.policyVersion,w.regressionChecks,w.regressionExitCode,w.syntheticParseChecks],[10,8,0,72]);
 assert.deepEqual([w.prospectiveRequests,w.prospectiveVotes,w.absenceProbeVotes,w.actualV10Votes],[18,72,6,0]);
 assert.deepEqual([w.actualProviderCalls,w.actualCountCalls,w.actualKeyReads],[0,0,0]);
 assert.equal(w.oldV9ScoresChanged,false);assert.equal(w.formalCalibrationQualification,false);assert.equal(w.sourceQualified,false);assert.equal(w.mainDispatchAuthorized,false);
 assert.equal(w.pricingPerformed,false);assert.equal(w.liveExecutorScopePrepared,false);assert.equal(w.priorFailureResolvedInActualAi,false);
 assert.deepEqual([w.oldV9NewVotesAvailable,w.oldV9NewGradeMatches,w.oldV9FullUnmeasured],[9,5,39]);
 assert.equal(policy.version,10);assert.deepEqual(policy.criticalFlags,old.criticalFlags);assert.deepEqual(policy.dimensions.grammar,old.dimensions.grammar);
 assert.equal(w.planSha256,createHash('sha256').update(await readFile(resolve(root,w.planFile))).digest('hex'));
 for(const snapshot of w.sourceSnapshots)assert.equal(createHash('sha256').update(await readFile(resolve(root,snapshot.snapshotFile))).digest('hex'),snapshot.sha256);
 for(const [file,expected]of Object.entries(w.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.equal(progress.withholdingReviewActualGrades,v10Live?.logicalGrades??0);assert.equal(progress.withholdingReviewPolicyVersion,10);
 assert.match(live.plan.context,/phase180.*교정 보류와 응답 부재.*회귀8\/8.*실제v10 판정0/);
 }
 if(calibrationRemainder){
 const r=calibrationRemainder,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.equal(r.status,'held');assert.equal(r.failureCode,'GRV2_SECRET_ECHO');assert.equal(r.actualExecutionExitCode,2);
 assert.deepEqual([r.actualProviderCalls,r.actualCountCalls,r.actualKeyReads,r.validResponses,r.newGradesAvailable,r.newGradeMatches],[4,18,1,3,9,5]);
 assert.equal(r.newGradesAvailable+r.attemptedButUnretainedGrades+r.notAttemptedGrades,48);
 assert.deepEqual([r.combinedAvailableGrades,r.combinedGradeMatches,r.remainingUnmeasured,r.fullCalibrationDenominator],[33,29,39,72]);
 assert.deepEqual([r.terraKnownMismatches,r.terraMaximumPossibleMatches,r.terraRequiredMatches],[4,20,22]);
 assert.equal(r.currentV9TerraCriterionImpossible,true);assert.equal(r.formalCalibrationQualification,false);assert.equal(r.mainDispatchAuthorized,false);
 assert.equal(r.failedTriggerDisambiguated,false);assert.equal(r.actualFaultProvenFalsePositive,false);assert.equal(r.separateSyntheticFalsePositiveReproduced,true);
 assert.deepEqual([r.preparationUnitChecks,r.futureGuardUnitChecks],[6,6]);assert.equal(r.futureCollectorActuallyUsed,false);
 assert.equal(r.combinedHeldUpperMicros,'2806936');assert.equal(r.conditionalRemainingMicros,'567509');assert.equal(r.unassignedProvisionHeldMicros,'39155');
 assert.equal(BigInt(r.combinedHeldUpperMicros)+BigInt(r.unassignedProvisionHeldMicros)+744007n+924902n,4515000n);
 assert.equal(progress.closedDayProvisionUnassignedHeldMicros,v10Live?.closed129UnassignedProvisionMicros??r.unassignedProvisionHeldMicros);assert.equal(progress.calibrationRemainderUnmeasured,39);
 for(const [file,expected]of Object.entries(r.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 for(const [file,expected]of Object.entries(r.futureCollectorSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.match(live.plan.context,/phase179.*중단.*4AI시도\/18계산.*기대값5\/9/);assert.ok(live.plan.budget.includes('실제 청구액 아님'));
 }
 if(negativeControls){
 const n=negativeControls,progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([n.actualProviderCalls,n.actualCountCalls,n.actualKeyReads,n.authoredNegativeCases,n.judgments,n.exactGradeMatches,n.criticalMisses,n.extraCriticalFlags],[12,12,1,4,24,24,0,0]);
 assert.deepEqual([n.combinedUsedUpperMicros,n.modelUpperMicros,n.countProvisionMicros,n.restrictedUnusedMicros,n.unassignedProvisionHeldMicros],['924902','504902','420000','974578','1871513']);
 assert.equal(n.generalDebitMicros,'0');assert.equal(n.newGrantCreated,false);assert.equal(n.formalCalibrationQualification,false);assert.equal(n.mainDispatchAuthorized,false);
 assert.equal(BigInt(n.combinedUsedUpperMicros)+BigInt(n.restrictedUnusedMicros)+BigInt(n.unassignedProvisionHeldMicros)+744007n,4515000n);
 assert.equal(BigInt(n.conditionalRemainingMicros)+BigInt(n.effectiveSupplementalUsedUpperMicros),35000000n);
 assert.equal(n.conditionalRemainingMicros,'1542087');assert.equal(progress.negativeControlsJudgments,24);assert.equal(progress.closedDayProvisionUnassignedHeldMicros,v10Live?.closed129UnassignedProvisionMicros??calibrationRemainder?.unassignedProvisionHeldMicros??'1871513');
 for(const [file,expected] of Object.entries(n.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.match(live.plan.context,/phase178.*24\/24.*중대 오류 누락0/);
 assert.ok(live.plan.budget.includes('US$0.924902'));assert.ok(live.plan.budget.includes('US$1.542087'));
 }
 if(fixedReview){
 const actual=fixedReview,ledger=await json(resolve(root,manifest.currentSupplementalLedgerFile));
 const progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([actual.actualProviderCalls,actual.actualCountCalls,actual.actualKeyReads,actual.sourceAppResponses,actual.uniqueEnglishCases,actual.independentJudgments],[12,12,1,6,2,24]);
 assert.deepEqual([actual.allDimensionsPassJudgments,actual.criticalVotes,actual.unavailableJudgments],[24,0,0]);
 assert.equal(actual.authorizationBasis,'existing-additional-budget-authorization');assert.equal(actual.newUserApprovalInvented,false);
 assert.deepEqual([actual.maximumCombinedMicros,actual.combinedUsedUpperMicros,actual.modelUpperMicros,actual.countAllowanceRetainedMicros],['1899480','900248','480248','420000']);
 assert.deepEqual([actual.newEarmarkAssignedMicros,actual.restrictedUsedUpperMicros,actual.restrictedUnusedMicros,actual.unassignedProvisionHeldMicros],['1743239','744007','999232','2771761']);
 assert.deepEqual([actual.additionalUsedUpperMicros,actual.additionalAvailableMicros,actual.reservedMicros],[ledger.usedUpperMicros,ledger.availableMicros,'0']);
 assert.equal(actual.ledgerSha256,createHash('sha256').update(await readFile(resolve(root,manifest.currentSupplementalLedgerFile))).digest('hex'));
 assert.equal(actual.caseEvidenceSha256,createHash('sha256').update(await readFile(resolve(root,actual.evidenceFile))).digest('hex'));
 for(const [file,expected]of Object.entries(actual.evidenceSha256))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 assert.equal(BigInt(actual.effectiveSupplementalUsedUpperMicros)+BigInt(actual.conditionalRemainingMicros),35000000n);
 assert.equal(progress.actualAppProductReviewJudgments,24);assert.equal(progress.closedDayProvisionPartialEarmarkApplied,true);
 assert.equal(actual.formalPilotReviews,0);assert.equal(actual.groupedEquivalenceEstablished,false);assert.equal(actual.mainDispatchAuthorized,false);
 assert.match(live.plan.context,/phase177.*24\/24 통과.*중대0.*AI12응답\/12계산/);
 assert.ok(live.plan.budget.includes('US$0.900248'));assert.ok(live.plan.budget.includes('US$1.566741'));
 }
 if(manifest.bilingualReferenceExecutorFile){
 const progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 const prepared=await json(resolve(root,manifest.bilingualReferenceExecutorFile));
 assert.deepEqual([prepared.caseCount,prepared.judgmentSlots,prepared.expectedModelCalls,prepared.expectedCountCalls,prepared.collectorSyntheticChecks],[30,60,3,3,31]);
 assert.deepEqual([prepared.maximumCombinedMicros,prepared.generalMaximumMicros,prepared.restrictedMaximumMicros,prepared.countAllowanceMicros],['1249323','364565','884758','105000']);
 assert.deepEqual([prepared.actualProviderCalls,prepared.actualCountCalls,prepared.actualKeyReads,prepared.referencesQualified],[0,0,0,0]);
 assert.equal(prepared.scopeApproved,false);assert.equal(prepared.mainDispatchAuthorized,false);assert.equal(prepared.inputTokensMeasured,false);
 assert.equal(prepared.collectorImplemented,true);assert.equal(prepared.allCountsBeforeModels,true);assert.equal(prepared.maximumMeasuredInputTokens,25000);
 const directory=resolve(root,prepared.outputDirectory);
 for(const [file,expected]of Object.entries(prepared.evidenceSha256)){
   assert.equal(createHash('sha256').update(await readFile(resolve(directory,file))).digest('hex'),expected);
 }
 assert.equal(progress.activeSubtaskId,currentManagementRecord?.activeSubtaskId??(postJointWord?'24.2':postJointCapture?'24.3':postJointDraft?'24.2':v10Acceptance?'24.3':v10Sources?'25.2':v10Rebind?'26.2':v10Live?'25.2':negativeControls?'34.4':manifest.bilingualProductReviewPreparationFile?'24.3':manifest.wordAppDiagnosticExecutionFile?'24.2':manifest.wordAppDiagnosticExecutorFile?'24.4':manifest.bilingualReferenceExecutionFile?'24.2':'24.3'));
 assert.equal(progress.bilingualReferenceScopeApproved,Boolean(manifest.bilingualReferenceExecutionFile));
 assert.match(live.plan.context,/phase170.*한국어\/영어30쌍.*3응답\/3계산.*31검사.*승인\/실제호출\/예약0/);
 assert.match(live.plan.budget,/phase170 제안: 최대 US\$1\.249323.*승인\/예약\/사용0/);
 }
 if(manifest.bilingualReferenceExecutionFile){
 const actual=await json(resolve(root,manifest.bilingualReferenceExecutionFile));
 const follow=manifest.wordAppDiagnosticExecutionFile?await json(resolve(root,manifest.wordAppDiagnosticExecutionFile)):null;
 const ledger=await json(resolve(root,manifest.currentSupplementalLedgerFile));
 const evidence=await json(resolve(root,actual.evidenceFile));
 const progress=await json(resolve(root,'.taskmaster/docs/ai-quality-v147-live-progress.json'));
 assert.deepEqual([actual.actualProviderCalls,actual.actualCountCalls,actual.actualKeyReads,actual.availableJudgments,actual.unavailableJudgments],[3,3,1,60,0]);
 assert.deepEqual([actual.languageAxesAgreementCases,actual.authorDifferenceCases,actual.referencesQualified],[30,5,0]);
 assert.deepEqual([actual.combinedUsedUpperMicros,actual.generalUsedUpperMicros,actual.restrictedUsedUpperMicros,actual.restrictedUnusedMicros],['330172','105000','225172','659586']);
 assert.equal(actual.ledgerSha256,follow?.beforeLedgerSha256??createHash('sha256').update(await readFile(resolve(root,manifest.currentSupplementalLedgerFile))).digest('hex'));
 assert.deepEqual([actual.additionalUsedUpperMicros,actual.additionalAvailableMicros,actual.reservedMicros],[follow?.beforeGeneralUsedUpperMicros??ledger.usedUpperMicros,follow?.beforeGeneralAvailableMicros??ledger.availableMicros,'0']);
 assert.equal(BigInt(actual.effectiveSupplementalUsedUpperMicros)+BigInt(actual.conditionalRemainingMicros),35000000n);
 assert.equal(actual.conditionalRemainingMicros,'1025827');assert.equal(actual.mainDispatchAuthorized,false);
 assert.equal(actual.referenceRoleQualified,false);assert.equal(actual.pilotGenerationsCompleted,0);
 assert.equal(evidence.cases.length,30);assert.ok(evidence.cases.every(c=>c.votes.length===2&&c.languageAxesAgree&&!c.referenceQualified));
 assert.equal(createHash('sha256').update(await readFile(resolve(root,actual.evidenceFile))).digest('hex'),actual.caseEvidenceSha256);
 for(const [file,expected]of Object.entries(actual.evidenceSha256)){
   assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),expected);
 }
 assert.equal(progress.bilingualReferencePaidScopeConsumed,true);assert.equal(progress.bilingualDraftIndependentReviews,60);
 assert.match(live.plan.context,/phase171.*실제3응답\/3계산.*두AI30\/30 일치.*US\$0\.330172/);
 assert.ok(live.plan.budget.includes('전용 잔액 US$0.659586은 일반 가용액 아님'));
 }
 if(manifest.bilingualPilotDraftProposalFile){
 const draft=await json(resolve(root,manifest.bilingualPilotDraftProposalFile));
 assert.deepEqual([draft.newWordDrafts,draft.retainedGrammarDrafts,draft.capturedSyntheticRequests,
   draft.candidateSyntheticStoredDraftMatches,draft.baselineSyntheticStoredDraftMatches,draft.receiptReadbacks],[30,30,360,180,135,360]);
 assert.deepEqual([draft.independentReferenceReviews,draft.qualifiedReferences,draft.formalPilotCasesApproved,
   draft.actualProviderCalls,draft.actualCountCalls,draft.actualKeyReads],[0,0,0,0,0,0]);
 assert.equal(draft.retainedGrammarObjectsUnchanged,true);assert.equal(draft.newModelQualityMeasured,false);
 assert.equal(draft.freshnessQualified,false);assert.equal(draft.mainDispatchAuthorized,false);
 const directory=resolve(root,draft.outputDirectory);
 for(const [file,expected]of Object.entries(draft.evidenceSha256)){
   assert.equal(createHash('sha256').update(await readFile(resolve(directory,file))).digest('hex'),expected);
 }
 assert.deepEqual(['2','3','4'].map(id=>live.tasks.find(t=>t.id==='24').subtasks.find(t=>t.id===id).status),['in-progress','in-progress','in-progress']);
 assert.match(live.plan.context,/phase169.*단어30 한국어\/영어 초안.*문법30 보존.*독립 검토\/참조 자격\/정식 새 문항0/);
 }
 if(manifest.bilingualFreezeEvidenceFile){
 const frozen=await json(resolve(root,manifest.bilingualFreezeEvidenceFile));
 assert.deepEqual([frozen.rebuildSourceFiles,frozen.capturedRequests,frozen.rebuiltRequestsEqual,frozen.frozenBrowserChecks,frozen.rebuiltUnitTests],[765,36,18,6,913]);
 assert.deepEqual([frozen.actualProviderCalls,frozen.actualCountCalls,frozen.actualKeyReads,frozen.newFormalPilotCases],[0,0,0,0]);
 assert.equal(frozen.formalFreezeComplete,false);assert.equal(frozen.mainDispatchAuthorized,false);
 assert.equal(live.tasks.find(t=>t.id==='24').subtasks.find(t=>t.id==='1').status,manifest.lessonCriteriaAlignmentFile?'in-progress':'review');
 assert.match(live.plan.context,/phase168.*로컬 동결 검토/);
 }
 if(manifest.intentCorrectionIntegrationFile){
 const intent=await json(resolve(root,manifest.intentCorrectionIntegrationFile));
 assert.deepEqual([intent.unitTests,intent.builtBrowserChecks,intent.correctionRegressionChecks,intent.draftRegressionChecks],[913,6,30,40]);
 assert.equal(intent.explicitIntentRole,'intended_korean');assert.equal(intent.ordinaryContextProtectionPreserved,true);
 assert.deepEqual([intent.actualProviderCalls,intent.actualCountCalls,intent.newStoredFields],[0,0,0]);
 assert.equal(intent.mainDispatchAuthorized,false);assert.match(live.plan.context,/phase167.*한국어 의도 기반/);
 }
 if(manifest.koreanIntentIntegrationFile){
 const intent=await json(resolve(root,manifest.koreanIntentIntegrationFile));
 assert.deepEqual([intent.unitTests,intent.builtBrowserChecks,intent.correctionRegressionChecks,intent.draftRegressionChecks],[906,6,30,40]);
 assert.deepEqual([intent.actualProviderCalls,intent.actualCountCalls,intent.actualKeyReads,intent.newSqlMigrations],[0,0,0,0]);
 assert.equal(intent.requiredForNewWordAiRequest,true);assert.equal(intent.legacyContextApiCompatible,true);
 assert.equal(intent.promptVersion,'reference-v9');assert.equal(intent.mainDispatchAuthorized,false);
 assert.match(live.plan.context,/phase166.*한국어 의도.*영어 답안.*AI 1회 검사/);
 }
 if(manifest.coreFlowPriorityFile){
 const core=await json(resolve(root,manifest.coreFlowPriorityFile));
 assert.equal(core.sourceIntegrated,true);assert.equal(core.sourceCoverageBlocksLocalImplementation,false);
 assert.equal(core.releaseGatesPreserved,true);assert.equal(core.mainDispatchAuthorized,false);
 assert.deepEqual([core.actualProviderCalls,core.actualCountCalls,core.browserChecks,core.unitTests],[0,0,14,904]);
 assert.equal(core.currentValidationVersion,'judgment-v7');
 assert.match(live.plan.context,/phase165.*기본 교정 우선.*T5.2/);
 }
 pass('actual existing4318 serves current revision counts with current implementation state, five histories, exact scoped budget and quality-held gate');
 for(const engine of dataOnly?[]:['chromium','webkit']){
  const browser=await pw[engine].launch({headless:true});browsers.push(browser);
  const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(![url+'/',local+'/','file:','data:'].some(x=>r.url().startsWith(x)))external.push(r.url());});
  await page.goto(url);await page.waitForFunction(tag=>document.getElementById('plan-tag').textContent===tag,TAG);
  assert.equal(await page.locator('[data-plan-id]').count(),expectedPlans);assert.equal(await page.locator('#parent-total').textContent(),String(expectedParents));assert.equal(await page.locator('#leaf-total').textContent(),String(expectedChildren));assert.equal(await page.locator('#overall-percent').textContent(),String(expectedPercent));
  assert.equal(await page.locator('#integrity-warning').isVisible(),false);assert.match(await page.locator('[data-gate="AQ-G3"] [data-gate-result]').textContent(),/보류/);
  await page.locator('#task-1 > summary').click();assert.ok(await page.locator('[data-subtask="1.1"]').isVisible());
  await page.locator('#task-1 > summary').click();
  pass(engine+': default current plan,manifest counts,source progress,gate held and visible subtasks match authoritative tasks');
  for(const entry of registry.plans){
   await page.locator('[data-plan-id="'+entry.id+'"]').click();await page.waitForFunction(id=>document.querySelector('[data-plan-id="'+id+'"]').getAttribute('aria-pressed')==='true',entry.id);
   const expected=direct.planSnapshots[entry.id],tasks=expected.tasks,children=tasks.flatMap(t=>t.subtasks),done=children.filter(c=>c.status==='done').length;
   assert.equal(await page.locator('#plan-tag').textContent(),expected.source.tag);assert.equal(await page.locator('#parent-total').textContent(),String(tasks.length));assert.equal(await page.locator('#leaf-total').textContent(),String(children.length));assert.equal(await page.locator('#overall-percent').textContent(),String(Math.round(done/children.length*100)));
   assert.equal(await page.locator('#plan-budget').textContent(),expected.plan.budget);assert.equal(await page.locator('#integrity-warning').isVisible(),false);
  }
  await page.locator('[data-plan-id="openai-api-migration-2026-11-03"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#leaf-total').textContent(),'35');
  await page.locator('[data-plan-id="'+PLAN+'"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#leaf-total').textContent(),String(expectedChildren));
  await page.getByRole('searchbox',{name:'작업 검색'}).fill('원장');assert.ok(await page.locator('#task-19').count());await page.getByRole('searchbox',{name:'작업 검색'}).fill('');
  pass(engine+': all five plan counts/status/budgets stay separate; keyboard selection and new task search work');
  for(const width of [320,390,1440])for(const scale of [1,2]){
   await page.setViewportSize({width,height:1000});await page.evaluate(s=>document.documentElement.style.fontSize=14*s+'px',scale);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),engine+' horizontal overflow '+width+'/'+scale);
  }
  await page.evaluate(()=>document.documentElement.style.fontSize='14px');await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:resolve(out,engine+'-five-plans.png'),fullPage:false});
  if(process.env.AXE_CORE_PATH){await page.addScriptTag({path:process.env.AXE_CORE_PATH});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa']})).violations.map(x=>x.id)),[]);}
  pass(engine+':320/390/1440px at100/200percent and retained accessibility labels/keyboard; optional axe scope recorded');
  const old=structuredClone(registry);old.plans=old.plans.filter(x=>x.id!==PLAN);old.defaultPlanId='comprehensive-remediation-2026-11-05';
  await write(paths[1],old);await write(paths[0],source);await page.goto(local);assert.equal(await page.locator('[data-plan-id]').count(),4);
  await write(paths[1],registry);const response=page.waitForResponse(r=>r.url().includes('/api/tasks'));await page.locator('#refresh').click();assert.equal((await(await response).json()).catalog.plans.length,expectedPlans);
  await page.waitForFunction(()=>document.querySelectorAll('[data-plan-id]').length===5);await page.locator('[data-plan-id="'+PLAN+'"]').click();await page.waitForFunction(n=>document.getElementById('leaf-total').textContent===String(n),expectedChildren);
  const changed=structuredClone(source),parent=changed[TAG].tasks.find(t=>!['done','cancelled'].includes(t.status)&&t.subtasks.some(c=>c.status==='pending'));assert.ok(parent);parent.subtasks.find(c=>c.status==='pending').status='done';await write(paths[0],changed);await page.locator('#refresh').click();await page.waitForFunction(n=>document.getElementById('leaf-done').textContent===String(n),expectedDone+1);assert.equal(await page.locator('#overall-percent').textContent(),String(Math.round((expectedDone+1)/expectedChildren*100)));
  await writeFile(resolve(fixture,paths[0]),'{');await page.locator('#refresh').click();await page.locator('#data-warning').waitFor({state:'visible'});assert.equal(await page.locator('#leaf-done').textContent(),String(expectedDone+1));
  await write(paths[0],source);await page.locator('#refresh').click();await page.waitForFunction(n=>document.getElementById('leaf-done').textContent===String(n)&&document.getElementById('data-warning').hidden,expectedDone);
  pass(engine+': isolated4→5 live catalog refresh, status refresh and malformed-source retention/recovery pass; originals untouched');
  await browser.close().catch(()=>{});
  const savedBrowser=await pw[engine].launch({headless:true});browsers.push(savedBrowser);
  const standalone=await savedBrowser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});standalone.on('pageerror',e=>errors.push(e.message));standalone.on('request',r=>{if(!['file:','data:'].some(x=>r.url().startsWith(x)))external.push(r.url());});
  await standalone.goto(pathToFileURL(resolve(root,'outputs/openai-migration-dashboard/index.html')).href,{waitUntil:'domcontentloaded'});await standalone.waitForFunction(tag=>document.getElementById('plan-tag').textContent===tag,TAG);
  assert.equal(await standalone.locator('[data-plan-id]').count(),expectedPlans);assert.equal(await standalone.locator('#connection-mode').innerText(),'저장된 HTML 사본');
  await standalone.locator('[data-plan-id="comprehensive-remediation-2026-11-05"]').click();assert.equal(await standalone.locator('#leaf-total').textContent(),'81');await standalone.locator('[data-plan-id="'+PLAN+'"]').click();assert.equal(await standalone.locator('#leaf-total').textContent(),String(expectedChildren));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);pass(engine+': standalone five-plan HTML retains new/old switching; no page errors or external requests');
  await savedBrowser.close();
 }
 assert.deepEqual(await hashes(),before);pass('actual task/tag/registry/manifest/runtime bytes unchanged by dashboard QA');
}catch(error){checks.push({name:error.message,passed:false});console.error(error);process.exitCode=1;}
finally{
 for(const browser of browsers)await browser.close().catch(()=>{});server.closeAllConnections();await new Promise(ok=>server.close(ok));
 const report={at:new Date().toISOString(),passed:checks.every(x=>x.passed),exitCode:process.exitCode||0,checks,sourceHashes:before,mode:dataOnly?'data-only':'browser-and-data',browserChecksExecuted:!dataOnly,axeExecuted:!dataOnly&&!!process.env.AXE_CORE_PATH,physicalDevice:false,scope:'Existing loopback dashboard and isolated synthetic task fixture. No product/learner/API AI writes or paid calls.'};
 await writeFile(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:checks.length,exitCode:report.exitCode}));
}
