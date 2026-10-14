// Isolated additional-round fixtures. No native image or external API calls.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..'), fixture = fs.mkdtempSync(path.join(repo, 'work/oxford-rounds-check-'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex'), copy = x => JSON.parse(JSON.stringify(x));
const read = f => JSON.parse(fs.readFileSync(f)), write = (f,x) => fs.writeFileSync(f, JSON.stringify(x,null,2)+'\n');
for (const d of ['data','docs','scripts','work']) fs.mkdirSync(path.join(fixture,d));
const mf = path.join(fixture,'data/word-image-manifest.json'), pf = path.join(fixture,'work/oxford-images-progress.json');
const qpath = 'docs/oxford-word-image-recovery-round2-proposal.json', qf = path.join(fixture,qpath);
const original = read(path.join(repo,'data/word-image-manifest.json')), proposal = read(path.join(repo,qpath)), ids = proposal.executionOrder;
if (original.generation.remainingApproval) {
  for (const spec of original.generation.remainingApproval.entries) original.entries[original.entries.findIndex(e=>e.entryId===spec.entryId)] = copy(spec.entryBefore);
  delete original.generation.remainingApproval;
}
delete original.generation.recoveryRounds;
delete original.generation.qualityContinuationApproval;
// Reconstruct synthetic round2 seeds from the committed scope, even after real candidates have progressed.
for (const spec of proposal.entries) {
  const e = original.entries.find(e=>e.entryId===spec.entryId);
  e.attempts = e.attempts.slice(0,spec.currentAttempts); e.status = spec.currentStatus;
  for (const key of ['file','sha256','bytes','width','height']) e[key] = e.attempts.at(-1)[key];
  spec.entrySnapshotSha256 = sha(JSON.stringify(e));
}
original.counts = {total:3809,waiting:0,generating:0,generated:0,approved:0,held:0,failed:0};
for (const e of original.entries) original.counts[e.status]++;
const sourceMf = path.join(fixture,'work/base-manifest.json'), sourcePf = path.join(fixture,'work/base-ledger.json');
write(sourceMf,original); write(sourcePf,{dataset:original.dataset.sha256,generationCalls:original.entries.reduce((n,e)=>n+e.attempts.length,0),current:null,history:[]});
proposal.sourceSnapshot.manifestSha256 = sha(fs.readFileSync(sourceMf));
proposal.sourceSnapshot.ledgerSha256 = sha(fs.readFileSync(sourcePf));
const sourceQf = path.join(fixture,'work/base-proposal.json'); write(sourceQf,proposal);
for (const f of ['words.json','content.json']) fs.copyFileSync(path.join(repo,'data',f),path.join(fixture,'data',f));
for (const f of ['oxford-images.cjs','verify-oxford-images.cjs']) fs.copyFileSync(path.join(repo,'scripts',f),path.join(fixture,'scripts',f));
fs.copyFileSync(path.join(repo,'docs/oxford-word-image-recovery-proposal.json'),path.join(fixture,'docs/oxford-word-image-recovery-proposal.json'));
const root = path.join(fixture,original.assetRoot), sourceRoot = path.join(process.env.OXFORD_ASSET_WORKSPACE || 'C:/Users/user/Documents/ChatGPT/하루단어',original.assetRoot);
fs.mkdirSync(root,{recursive:true});
const ref = original.entries.find(e=>e.entryId===original.generation.styleReferenceEntryId);
for (const file of new Set([ref.file,...ids.map(id=>original.entries.find(e=>e.entryId===id).file)]))
  fs.copyFileSync(path.join(sourceRoot,file),path.join(root,file));
const af = path.join(fixture,'work/approval.json'), jf = path.join(fixture,'work/oxford-images-pending.json');
const env = {...process.env,OXFORD_ASSET_WORKSPACE:fixture};
const run = (...args) => spawnSync(process.execPath,[path.join(fixture,'scripts/oxford-images.cjs'),...args],{cwd:fixture,env,encoding:'utf8'});
const hashes = () => [sha(fs.readFileSync(mf)),sha(fs.readFileSync(pf))];
let checks=0;
function reset() { fs.copyFileSync(sourceMf,mf);fs.copyFileSync(sourcePf,pf);fs.copyFileSync(sourceQf,qf); }
function decision() { return {approvalId:'fixture-additional-round',round:2,approvedAt:'2026-10-14T00:00:00.000Z',
  userDecision:'fixture explicit14-entry approval',proposalPath:qpath,proposalCommit:'7755dce815ff19fe3bf55a3b18e6620e981e8fec',proposalId:proposal.proposalId,
  proposalSha256:sha(fs.readFileSync(qf)),baseManifestSha256:sha(fs.readFileSync(mf)),baseLedgerSha256:sha(fs.readFileSync(pf)),
  baseGenerationCalls:4052,maximumNewStartSlots:14,maximumTotalStartSlots:4066,entryIds:ids,firstApprovalId:original.generation.recoveryApproval.approvalId,
  oneAdditionalStartPerEntry:true,automaticRetry:false,provider:'built-in-image_gen',textPolicyHoldsPreserved:true}; }
function rejected(args,message) { const before=hashes(),r=run(...args);assert.notEqual(r.status,0,r.stdout);if(message)assert(r.stderr.includes(message),r.stderr);assert.deepEqual(hashes(),before);checks++; }
function passed(...args) {const r=run(...args);assert.equal(r.status,0,r.stderr);checks++;return r;}
function authorize() {write(af,decision());return passed('recovery-round-authorize',af);}
reset();rejected(['recovery-round-start',ids[0],'missing'],'Explicit recovery approval');
const good=decision();
for(const invalid of [
 {...good,round:3},{...good,approvalId:original.generation.recoveryApproval.approvalId},
 {...good,maximumNewStartSlots:15},{...good,maximumTotalStartSlots:4067},{...good,baseGenerationCalls:0},
 {...good,baseManifestSha256:'0'.repeat(64)},{...good,baseLedgerSha256:'0'.repeat(64)},
 {...good,proposalSha256:'0'.repeat(64)},{...good,firstApprovalId:'other'},
 {...good,entryIds:[...ids].reverse()},{...good,entryIds:ids.slice(1)},
 {...good,entryIds:[ids[0],...ids.slice(0,-1)]},{...good,provider:'cli'},
 {...good,automaticRetry:true},{...good,textPolicyHoldsPreserved:false}
]){write(af,invalid);rejected(['recovery-round-authorize',af]);}
authorize();const authorized=read(mf),authorizedP=read(pf);assert.deepEqual(authorized.entries,original.entries);
assert.deepEqual(authorized.generation.recoveryApproval,original.generation.recoveryApproval);assert.equal(authorizedP.generationCalls,4052);
const stable=hashes();passed('recovery-round-authorize',af);assert.deepEqual(hashes(),stable);
write(af,{...decision(),approvalId:'refill'});rejected(['recovery-round-authorize',af],'cannot be replaced or refilled');
write(af,{...good,userDecision:'replacement'});rejected(['recovery-round-authorize',af],'cannot be replaced or refilled');
write(af,good);
rejected(['recovery-round-start',ids[0]],'Specify the additional approval ID');
rejected(['recovery-round-start',ids[1],good.approvalId],'textbook order');
rejected(['recovery-round-start','d056f2650b116cba',good.approvalId],'Explicit policy hold');
rejected(['recovery-round-start','53b4f95ddd122fc2',good.approvalId],'outside the approved');
rejected(['recovery-round-start',ref.entryId,good.approvalId],'outside the approved');
rejected(['recovery-start',ids[0]],'already consumed');
const start=JSON.parse(passed('recovery-round-start',ids[0],good.approvalId).stdout);
assert.equal(start.attempt,4);assert.deepEqual(start.references,[path.join(root,ref.file)]);assert.equal(read(pf).generationCalls,4053);
rejected(['recovery-round-start',ids[1],good.approvalId],'Previous image call is unresolved');
const started=read(mf),startedP=read(pf);write(jf,{manifest:started,progress:startedP});write(mf,authorized);write(pf,authorizedP);
passed('status');assert.deepEqual(read(mf),started);assert.deepEqual(read(pf),startedP);assert(!fs.existsSync(jf));
const image=path.join(root,ref.file);passed('capture',ids[0],image);
rejected(['recovery-round-start',ids[1],good.approvalId],'Review the previous candidate');
const rf=path.join(fixture,'work/review.json');
function hold(id){write(rf,[{entryId:id,decision:'hold',note:'Synthetic reference capture only; not a real vocabulary image or learning approval.'}]);passed('review',rf);}
hold(ids[0]);rejected(['recovery-round-start',ids[0],good.approvalId],'already consumed');
const editStart=JSON.parse(passed('recovery-round-start',ids[1],good.approvalId).stdout);
assert.deepEqual(editStart.references,[path.join(root,original.entries.find(e=>e.entryId===ids[1]).file),path.join(root,ref.file)]);
const raw=path.join(fixture,'work/raw-failure.json'),ff=path.join(fixture,'work/failure.json');
write(raw,{synthetic:true,error:'request_timeout',image:null});
write(ff,{entryId:ids[1],error:{code:'request_timeout',category:'service-timeout',stage:'request-body',outcome:'terminal-no-image-returned',httpStatus:408},rawResultFile:'work/raw-failure.json',rawResultSha256:sha(fs.readFileSync(raw))});
passed('recovery-fail',ff);assert.equal(read(pf).generationCalls,4054);assert.deepEqual(read(mf).generation.recoveryApproval,original.generation.recoveryApproval);
rejected(['recovery-round-start',ids[2],good.approvalId],'stopped after a service failure');
const stopHashes=hashes();passed('recovery-round-authorize',af);assert.deepEqual(hashes(),stopHashes);assert(read(mf).generation.recoveryRounds[0].stoppedByFailure);
const bf=read(mf),bp=read(pf),stop=bf.generation.recoveryRounds[0].stoppedByFailure,failed=bf.entries.find(e=>e.entryId===stop.entryId).attempts.at(-1),resumeFile=path.join(fixture,'work/resume.json');
const resume={resumeId:'fixture-round2-resume',userDecision:'fixture explicit unused scope resume',approvedAt:new Date().toISOString(),recoveryApprovalId:good.approvalId,scope:'unstarted-approved-entries-only',provider:'built-in-image_gen',automaticRetry:false,maximumTotalStartSlots:4066,manifestSha256:sha(fs.readFileSync(mf)),ledgerSha256:sha(fs.readFileSync(pf)),stoppedByFailure:stop,failedAttemptSha256:sha(JSON.stringify(failed)),entryIds:ids.slice(2)};
write(resumeFile,{...resume,entryIds:[ids[1],...ids.slice(2)]});rejected(['recovery-resume',resumeFile],'untouched approved scope');
write(resumeFile,resume);passed('recovery-resume',resumeFile);assert.deepEqual(read(mf).entries,bf.entries);assert.equal(read(pf).generationCalls,bp.generationCalls);
const resumedHashes=hashes();passed('recovery-resume',resumeFile);assert.deepEqual(hashes(),resumedHashes);
passed('recovery-round-start',ids[2],good.approvalId);write(ff,{...read(ff),entryId:ids[2]});passed('recovery-fail',ff);
const laterStop=read(mf).generation.recoveryRounds[0].stoppedByFailure,laterHashes=hashes();passed('recovery-resume',resumeFile);assert.deepEqual(hashes(),laterHashes);assert.deepEqual(read(mf).generation.recoveryRounds[0].stoppedByFailure,laterStop);
// Complete every slot using synthetic captures, to verify global budgets and mixed v3/v4 provenance.
reset();authorize();for(const id of ids){passed('recovery-round-start',id,good.approvalId);passed('capture',id,image);hold(id);}
const completed=read(mf);assert.equal(read(pf).generationCalls,4066);assert.deepEqual(completed.generation.recoveryApproval,original.generation.recoveryApproval);
for(const id of ids){const e=completed.entries.find(e=>e.entryId===id),before=original.entries.find(e=>e.entryId===id);assert.deepEqual(e.attempts.slice(0,-1),before.attempts);assert.equal(e.attempts.at(-1).recoveryApprovalId,good.approvalId);}
assert(completed.entries.find(e=>e.word==='code'&&e.entryId===ids[4]).file.endsWith('-v3.png'));
assert(completed.entries.find(e=>e.entryId===ids[0]).file.endsWith('-v4.png'));
rejected(['recovery-round-start',ids[0],good.approvalId],'already consumed');
const status=JSON.parse(passed('status').stdout);assert.equal(status.recovery.used,53);assert.equal(status.recoveryRounds[0].used,14);
const verifier=(id)=>spawnSync(process.execPath,[path.join(fixture,'scripts/verify-oxford-images.cjs'),id],{cwd:fixture,env,encoding:'utf8'});
for(const id of [ids[0],ids[4]]){const bad=copy(completed);bad.entries.find(e=>e.entryId===id).attempts.at(-1).recoveryApprovalId=original.generation.recoveryApproval.approvalId;write(mf,bad);assert.notEqual(verifier(id).status,0);checks++;write(mf,completed);const result=verifier(id);assert.equal(result.status,0,result.stderr);checks++;}
const corrupt=copy(completed);corrupt.entries.find(e=>e.entryId===ids[0]).attempts.at(-1).recoveryApprovalId='unknown';write(mf,corrupt);rejected(['status'],'Unscoped recovery slot');write(mf,completed);
const finalStable=hashes();passed('recovery-round-authorize',af);assert.deepEqual(hashes(),finalStable);

const standingFile=path.join(fixture,'work/standing.json');
const standing={approvalId:'fixture-standing',approvedAt:new Date().toISOString(),userDecision:'fixture explicit quality continuation until approved',parentApprovalId:good.approvalId,entryIds:ids,untilApproved:true,provider:'built-in-image_gen',automaticServiceRetry:false,textPolicyHoldsPreserved:true};
for(const bad of [{...standing,entryIds:[...ids,'d056f2650b116cba']},{...standing,provider:'cli'},{...standing,automaticServiceRetry:true},{...standing,untilApproved:false}]){write(standingFile,bad);rejected(['recovery-quality-authorize',standingFile]);}
write(standingFile,standing);const standingBefore=read(mf);passed('recovery-quality-authorize',standingFile);assert.deepEqual(read(mf).entries,standingBefore.entries);assert.equal(read(pf).generationCalls,4066);
const standingStable=hashes();passed('recovery-quality-authorize',standingFile);assert.deepEqual(hashes(),standingStable);
write(standingFile,{...standing,userDecision:'replace'});rejected(['recovery-quality-authorize',standingFile],'cannot be replaced');write(standingFile,standing);
const continuation=read(mf).generation.qualityContinuationApproval,third=copy(proposal),current=read(mf),entry=current.entries.find(e=>e.entryId===ids[0]);
third.round=3;third.proposalId='fixture-round3-proposal';third.executionOrder=[ids[0]];third.entries=[copy(third.entries[0])];
third.currentStartSlots=4066;third.proposedStartSlotLimit=1;third.maximumStartSlotsAfterProposal=4067;
third.sourceSnapshot.manifestSha256=sha(fs.readFileSync(mf));third.sourceSnapshot.ledgerSha256=sha(fs.readFileSync(pf));third.sourceSnapshot.continuationApprovalSha256=sha(JSON.stringify(continuation));
const ts=third.entries[0];Object.assign(ts,{currentAttempts:entry.attempts.length,currentStatus:entry.status,entrySnapshotSha256:sha(JSON.stringify(entry)),proposedNextAttemptNumber:entry.attempts.length+1});
const tqpath='docs/oxford-word-image-recovery-round3-proposal.json',tqf=path.join(fixture,tqpath);write(tqf,third);
const td={...good,round:3,approvalId:'fixture-third',continuationApprovalId:standing.approvalId,proposalPath:tqpath,proposalId:third.proposalId,proposalSha256:sha(fs.readFileSync(tqf)),baseManifestSha256:sha(fs.readFileSync(mf)),baseLedgerSha256:sha(fs.readFileSync(pf)),baseGenerationCalls:4066,maximumNewStartSlots:1,maximumTotalStartSlots:4067,entryIds:[ids[0]]};
write(af,{...td,continuationApprovalId:'wrong'});rejected(['recovery-round-authorize',af]);
write(af,td);passed('recovery-round-authorize',af);const thirdStart=JSON.parse(passed('recovery-round-start',ids[0],td.approvalId).stdout);assert.equal(thirdStart.attempt,5);
passed('capture',ids[0],image);hold(ids[0]);assert.equal(read(pf).generationCalls,4067);assert.deepEqual(read(mf).generation.recoveryApproval,original.generation.recoveryApproval);
const checkedV5=verifier(ids[0]);assert.equal(checkedV5.status,0,checkedV5.stderr);checks++;
const untouchedId=ids[1],unsupported={...td,round:4,approvalId:'fixture-unsupported',entryIds:[untouchedId],continuationApprovalId:'outside'};write(af,unsupported);rejected(['recovery-round-authorize',af]);

console.log(JSON.stringify({result:'pass',checks,imageCalls:0,apiCalls:0,fixture,syntheticImageOnly:true}));
