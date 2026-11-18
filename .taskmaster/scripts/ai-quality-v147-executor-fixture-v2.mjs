// Reusable wholly synthetic executor fixture. No English quality evidence.
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PROTOCOL_V2,MODELS,digest,slotKey} from './ai-quality-v147-budget-v2.mjs';
import {PLAN} from './ai-quality-v147-budget.mjs';
import {FREEZE_PROTOCOL,COMPONENTS,sealFreeze} from './ai-quality-v147-freeze.mjs';
import {DIMENSIONS,CRITICAL} from './ai-quality-v147-calibration.mjs';
const h=digest('owned synthetic fixture,not price approval or actual English quality'),sha=x=>createHash('sha256').update(x).digest('hex');
const grade=()=>({...Object.fromEntries(DIMENSIONS.map(k=>[k,'pass'])),criticalErrors:Object.fromEntries(CRITICAL.map(k=>[k,false]))});
const body=(model,instructions,payload)=>JSON.stringify({model,instructions,input:[{role:'user',content:JSON.stringify(payload)}],text:{format:{type:'json_schema',name:'synthetic',strict:true,schema:{type:'object',properties:{},additionalProperties:false}}},reasoning:{effort:'low'},max_output_tokens:4096,store:false,stream:false,service_tier:'default'});
export function executorFixtureV2({full=false,nodeVersion=process.version}={}){
 const witnesses=full?JSON.parse(readFileSync(fileURLToPath(new URL('../evaluation/ai-quality-v147/calibration-witnesses.json',import.meta.url)),'utf8')).witnesses:[];
 const batches=[],wirePolicies={},wires={},responses={},schedule=[],cases=Array.from({length:full?60:1},(_,i)=>{const offset=i%30;return {id:'fixture-case-'+String(i+1).padStart(3,'0'),domain:i<30?'word':'grammar',stratum:offset<10?'normal':offset<(i<30?22:23)?'needsCorrection':'insufficientContext',familyId:'synthetic-family-'+(i+1)};});
 function add(batchId,d,raw,parentKey=null){
  const key=slotKey(d),derived=parentKey!==null;d.bodyCommitment=derived?sha(raw):digest(JSON.parse(raw));
  wirePolicies[key]={kind:derived?'derived':'static',bodySha256:derived?null:sha(raw),templateHash:derived?sha(raw):null,parentKey,maximumBytes:65536};wires[key]=derived?{templateRaw:raw}:{raw};
  schedule.push({key,modelId:d.modelId,role:d.role,kind:derived?'derived':'static',maximumBytes:65536,outputTokenMax:4096,bodySha256:derived?null:sha(raw),bodyDigest:derived?null:d.bodyCommitment,parentKey,recipeHash:derived?sha(raw):null});
  let batch=batches.find(b=>b.id===batchId);if(!batch){batch={id:batchId,requests:[]};batches.push(batch);}batch.requests.push(d);return key;
 }
 const descriptor=(phase,caseId,targetModelId,modelId,role)=>({phase,caseId,targetModelId,modelId,role,repetition:1,inputTokenMax:70000,outputTokenMax:4096,inputBoundHash:h,bodyCommitment:h});
 if(full)for(let m=0;m<3;m++)for(let i=0;i<12;i++){
  const d=descriptor('calibration','witness-'+witnesses[i].id.toLowerCase(),MODELS[m],MODELS[m],'calibration'),key=add('calibration-'+m+'-'+i,d,body(MODELS[m],'synthetic calibration',{sentence:'Synthetic calibration '+i+'.'}));
  responses[key]={state:'completed',modelId:d.modelId,payloadRaw:JSON.stringify(witnesses[i].expectedGrade),usage:{inputTokens:20,outputTokens:20}};
 }
 for(const phase of (full?['baseline','candidate']:['candidate']))for(let m=0;m<(full?3:1);m++)for(const c of cases){
  const sentence='The synthetic fixture '+c.id+' stays warm.',input={sentence,target:'warm adjective'},batch='pair-'+phase+'-'+m+'-'+c.id;
  const d=descriptor(phase,c.id,MODELS[m],MODELS[m],'generation'),g=add(batch,d,body(d.modelId,'synthetic generation/'+phase,input));
  responses[g]={state:'completed',modelId:d.modelId,payloadRaw:JSON.stringify({original:sentence,meaningUsage:c.stratum==='insufficientContext'?'uncertain':'appropriate',grammar:c.stratum==='insufficientContext'?'uncertain':'natural',correctedSentence:'',explanation:'가상 공급자의 고정 응답. 실제 영어 품질 근거가 아니다.'}),usage:{inputTokens:20,outputTokens:20}};
  const j=descriptor(phase,c.id,MODELS[m],MODELS[(m+1)%3],'judge'),key=add(batch,j,body(j.modelId,'synthetic judge',{domain:c.domain,input,reference:{criterion:'synthetic only'},feedback:null}),g);
  responses[key]={state:'completed',modelId:j.modelId,payloadRaw:JSON.stringify(grade()),usage:{inputTokens:20,outputTokens:20}};
 }
 const runId=randomUUID(),spec={schemaVersion:1,protocol:PROTOCOL_V2,planId:PLAN,runId,mode:'synthetic',sourceSeal:h,quote:{kind:'synthetic-test',evidenceHash:h,regionalNumerator:'1',regionalDenominator:'1',inputFactorNumerator:'1',inputFactorDenominator:'1',models:Object.fromEntries(MODELS.map(m=>[m,{inputMicrosPerMillion:'1000000',outputMicrosPerMillion:'1000000'}]))},batches,wirePolicies};
 const {sourceSeal:_unused,...outline}=spec;void _unused;
 const environment={nodeVersion,platform:process.platform,arch:process.arch,timezone:'Asia/Seoul',compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],featureFlags:Object.fromEntries(['grammar_enabled','grammar_practice_v2_enabled','grammar_practice_v3_enabled','grammar_practice_v4_enabled','large_backup_restore_enabled','ai_feedback_enabled','feedback_judgment_enabled'].map(k=>[k,'true'])),providerEndpoint:'https://api.openai.com/v1/responses',outboundMode:'synthetic-intercept'};
 const current={schemaVersion:1,protocol:FREEZE_PROTOCOL,planId:PLAN,runId,mode:'synthetic',components:{...Object.fromEntries(COMPONENTS.map(k=>[k,h])),sourceBaseline:digest('synthetic baseline'),sourceCandidate:digest('synthetic candidate'),runtime:digest(environment),corpus:digest(cases),rubric:full?digest(witnesses):h,limits:digest(outline),quote:digest(spec.quote)},environment,schedule,order:schedule.map(s=>s.key)},seal=sealFreeze(current);spec.sourceSeal=seal.hash;
 const approval={schemaVersion:1,protocol:PROTOCOL_V2,runId,specHash:digest(spec),kind:'synthetic-test',amountMicros:'1000000000',evidenceHash:h};
 return {spec,approval,current,seal,wires,responses,cases,witnesses,syntheticOnly:true};
}
