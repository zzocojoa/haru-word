// Offline grade accounting and review separation. No network, keys or ledger IO.
import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes} from 'node:crypto';

export const DIMENSIONS=['meaning','grammar','correction','explanation','abstention'];
export const CRITICAL=['approveBadGrammar','reverseMeaning','swapRoles','inventedIntent'];
export const JUDGES=['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra'];
const VALUES=['pass','fail','uncertain','unavailable'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,expected)=>{assert.ok(object(v),'invalid record');const names=Object.keys(v);assert.ok(names.length===expected.length&&names.every(k=>expected.includes(k)),'invalid fields');};
const id=v=>assert.ok(typeof v==='string'&&/^[A-Za-z0-9_.:/-]{1,160}$/.test(v),'invalid identifier');
const canonical=v=>{
 if(Array.isArray(v))return v.map(canonical);
 if(object(v))return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));
 assert.ok(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v),'invalid hash value');return v;
};
export const digest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');

export function validateGrade(grade){
 keys(grade,[...DIMENSIONS,'criticalErrors']);for(const d of DIMENSIONS)assert.ok(VALUES.includes(grade[d]),'invalid grade');
 keys(grade.criticalErrors,CRITICAL);for(const d of CRITICAL)assert.equal(typeof grade.criticalErrors[d],'boolean','invalid critical flag');return grade;
}
export const sameGrade=(a,b)=>{validateGrade(a);validateGrade(b);return digest(a)===digest(b);};

export function summarizeCalibration(witnesses,records){
 assert.equal(witnesses.length,12);assert.equal(new Set(witnesses.map(w=>w.id)).size,12);
 for(const group of ['normal','clear_error','ambiguous'])assert.equal(witnesses.filter(w=>w.group===group).length,4);
 for(const w of witnesses){id(w.id);validateGrade(w.expectedGrade);}
 for(const flag of CRITICAL)assert.ok(witnesses.some(w=>w.expectedGrade.criticalErrors[flag]),'critical coverage missing');
 const seen=new Set();for(const row of records){
  keys(row,['judgeId','witnessId','state','grade']);assert.ok(JUDGES.includes(row.judgeId));assert.ok(witnesses.some(w=>w.id===row.witnessId));assert.ok(['graded','failed'].includes(row.state));
  const key=row.judgeId+'/'+row.witnessId;assert.ok(!seen.has(key),'duplicate grade slot');seen.add(key);
  if(row.state==='graded')validateGrade(row.grade);else assert.equal(row.grade,null);
 }
 const judges=JUDGES.map(judgeId=>{
  let matches=0,missing=0,failed=0;const criticalMisses=Object.fromEntries(CRITICAL.map(k=>[k,0])),falseCritical=Object.fromEntries(CRITICAL.map(k=>[k,0]));
  for(const w of witnesses){const row=records.find(r=>r.judgeId===judgeId&&r.witnessId===w.id),g=row?.state==='graded'?row.grade:undefined;
   if(!row)missing++;else if(row.state==='failed')failed++;if(g&&sameGrade(g,w.expectedGrade))matches++;
   for(const k of CRITICAL){if(w.expectedGrade.criticalErrors[k]&&g?.criticalErrors[k]!==true)criticalMisses[k]++;if(!w.expectedGrade.criticalErrors[k]&&g?.criticalErrors[k]===true)falseCritical[k]++;}
  }
  const complete=missing===0&&failed===0;
  return {judgeId,denominator:12,matches,missing,failed,complete,criticalMisses,falseCritical,thresholdMet:complete&&matches>=11&&Object.values(criticalMisses).every(n=>n===0)};
 });
 return {judges,thresholdArithmeticSatisfied:judges.every(j=>j.thresholdMet),modelCalibrationMeasured:false,independentEnglishCertification:false,scope:'Arithmetic only; caller must supply separately approved actual judge collection to claim measured performance.'};
}

const publicInput=input=>{
 assert.ok(object(input));const out={};
 for(const [key,max]of [['sentence',2000],['target',300],['contextKind',30],['contextNote',500]])if(Object.hasOwn(input,key)){assert.equal(typeof input[key],'string');assert.ok(input[key].length<=max);out[key]=input[key];}
 assert.ok(out.sentence);assert.ok(out.target);return out;
};
const publicFeedback=(feedback,input)=>{
 assert.ok(object(feedback),'invalid visible feedback');
 assert.ok(feedback.original===input.sentence,'input/output context mismatch');assert.ok(['appropriate','needs_work','uncertain'].includes(feedback.meaningUsage));assert.ok(['natural','needs_work','uncertain'].includes(feedback.grammar));
 for(const [key,max]of [['original',2000],['correctedSentence',2000],['explanation',6000]])assert.ok(typeof feedback[key]==='string'&&feedback[key].length<=max);
 return Object.fromEntries(['original','meaningUsage','grammar','correctedSentence','explanation'].map(k=>[k,feedback[k]]));
};
const visibleEvidence=row=>{const input=publicInput(row.input),available=row.feedback!==null;return {input,available,feedback:available?publicFeedback(row.feedback,input):null};};

export function makeReviewPacket(rows,salt=randomBytes(32)){
 assert.ok(Buffer.isBuffer(salt)&&salt.length>=32);const rowIds=new Set(),entries=[],mapping=[];
 for(const row of rows){id(row.id);assert.ok(!rowIds.has(row.id),'duplicate observation');rowIds.add(row.id);validateGrade(row.rawGrade);
  const evidence=visibleEvidence(row);
  const evidenceHash=digest(evidence),blindId=createHmac('sha256',salt).update(row.id+'|'+evidenceHash).digest('hex').slice(0,24);
  entries.push({blindId,evidenceHash,...evidence});mapping.push({blindId,rowId:row.id,evidenceHash,rawGradeHash:digest(row.rawGrade)});
 }
 // Model/phase/expected grades are absent from the packet; wording can reveal
 // the implementation, and this session knows the cases. Never call it fully blind.
 entries.sort((a,b)=>a.blindId.localeCompare(b.blindId));
 return {packet:{reviewKind:'same-author-partially-blinded',independent:false,entries},mapping:{rowsHash:digest(rows),entries:mapping}};
}

export function combineReviews(rows,mapping,reviews,adjudications){
 assert.equal(digest(rows),mapping.rowsHash,'raw observations changed');const seenReviews=new Set(),seenDecisions=new Set();
 assert.equal(mapping.entries.length,rows.length);assert.equal(new Set(mapping.entries.map(m=>m.rowId)).size,rows.length);assert.equal(new Set(mapping.entries.map(m=>m.blindId)).size,rows.length);
 for(const m of mapping.entries){const row=rows.find(r=>r.id===m.rowId);assert.ok(row,'unknown mapped observation');assert.equal(m.evidenceHash,digest(visibleEvidence(row)),'mapping evidence changed');assert.equal(m.rawGradeHash,digest(row.rawGrade),'mapping grade changed');}
 for(const review of reviews){
  keys(review,['blindId','evidenceHash','reviewerId','grade','reasonCodes']);id(review.reviewerId);assert.ok(!seenReviews.has(review.blindId),'duplicate review');seenReviews.add(review.blindId);
  const m=mapping.entries.find(m=>m.blindId===review.blindId);assert.ok(m,'unknown review');assert.equal(review.evidenceHash,m.evidenceHash,'stale review evidence');validateGrade(review.grade);
  assert.ok(Array.isArray(review.reasonCodes)&&review.reasonCodes.length>0&&review.reasonCodes.every(x=>['confirmed','target','grammar','meaning_preservation','explanation','abstention','unavailable'].includes(x)),'invalid review reason');
 }
 const decisions=new Map();for(const decision of adjudications){
  keys(decision,['blindId','reviewHash','reviewerId','decision']);id(decision.reviewerId);assert.ok(!seenDecisions.has(decision.blindId),'duplicate adjudication');seenDecisions.add(decision.blindId);
  const review=reviews.find(r=>r.blindId===decision.blindId);assert.ok(review,'adjudication without review');assert.equal(digest(review),decision.reviewHash,'stale adjudication');assert.ok(['confirm_raw','confirm_review','unresolved'].includes(decision.decision));decisions.set(decision.blindId,decision);
 }
 const entries=mapping.entries.map(m=>{
  const row=rows.find(r=>r.id===m.rowId);assert.ok(row);assert.equal(digest(row.rawGrade),m.rawGradeHash,'raw grade changed');
  const review=reviews.find(r=>r.blindId===m.blindId),decision=decisions.get(m.blindId),resolved=!!review&&!!decision&&decision.decision!=='unresolved';
  return {rowId:row.id,rawGrade:structuredClone(row.rawGrade),reviewGrade:review?structuredClone(review.grade):null,adjudicatedGrade:resolved?structuredClone(decision.decision==='confirm_raw'?row.rawGrade:review.grade):null,resolved};
 });
 return {entries,held:entries.some(e=>!e.resolved),rawGradesOverwritten:false,independentReviewVerified:false};
}
