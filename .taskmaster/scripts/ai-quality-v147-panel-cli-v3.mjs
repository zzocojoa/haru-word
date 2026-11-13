// Explicit synthetic-fixture CLI. It owns its loopback server. No real endpoint,
// credentials, child module imports or implicit dead-lease recovery.
import {readFileSync,writeFileSync,existsSync,realpathSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {createV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {startSyntheticHttpV3} from './ai-quality-v147-synthetic-http-v3.mjs';
import {openSyntheticPanelExecutorV3,panelFailureCodeV3} from './ai-quality-v147-panel-executor-v3.mjs';
import {openV3SettlementProof} from './ai-quality-v147-settlement-proof-v3.mjs';
import {inspectV3Recovery,recoverV3Journal} from './ai-quality-v147-recovery-v3.mjs';
import {startSyntheticInputCountHttpV1} from './ai-quality-v147-input-count-http-v1.mjs';
const [bundleFile,allowedRoot,outputName,recoveryFlag,faultStage]=process.argv.slice(2);let http=null,counter=null,executor=null,result=null;
try{
 if(!bundleFile||!allowedRoot||!/^result-[a-z0-9-]+\.json$/.test(outputName??'')||recoveryFlag&&!['--recover','--no-recover'].includes(recoveryFlag))throw Error('PX3_CLI_ARGUMENTS');const root=realpathSync(allowedRoot);if(root!==resolve(allowedRoot)||lstatSync(root).isSymbolicLink())throw Error('PX3_CLI_SCOPE');const b=JSON.parse(readFileSync(bundleFile,'utf8'));if(b.syntheticOnly!==true||b.spec.mode!=='synthetic')throw Error('PX3_SYNTHETIC_ONLY');const context={allowedRoot:root,directory:resolve(root,'v3-'+b.spec.runId),spec:b.spec};if(!existsSync(context.directory))createV3Journal(context,b.approval);
 if(recoveryFlag==='--recover'){const settlementProof=openV3SettlementProof({context,seal:b.seal,observeCurrent:()=>b.current}),i=inspectV3Recovery(context,{settlementProof});await recoverV3Journal({context,expectedInspectionHash:i.inspectionHash,settlementProof});}
 http=await startSyntheticHttpV3({bundle:b,logFile:resolve(root,outputName+'.http.jsonl')});if(b.reportInputs.contract.inputCountPolicy)counter=await startSyntheticInputCountHttpV1({bundle:b,logFile:resolve(root,outputName+'.count.jsonl')});executor=openSyntheticPanelExecutorV3({context,seal:b.seal,observeCurrent:()=>b.current,readWire:k=>b.wires[k],reportInputs:b.reportInputs,transport:http.send,inputCountTransport:counter?.send??null,testFault:stage=>{if(faultStage&&stage===faultStage)process.exit(91);}});result=await executor.collect();executor.release();executor=null;result.transport=await http.close();http=null;if(counter){result.inputCountTransport=await counter.close();counter=null;}writeFileSync(resolve(root,outputName),JSON.stringify(result,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({status:result.status,sent:result.sent,failureCode:result.failureCode,actualProviderCalls:0,actualKeyReads:0,releaseVerdict:'held'})+'\n');process.exitCode=result.failureCode?2:0;
}catch(e){try{executor?.abandon();}catch{/* Preserve the lease if ownership cannot be proved. */}try{await http?.close();}catch{/* Raw log remains. */}try{await counter?.close();}catch{/* Count intent and raw log remain. */}process.stdout.write(JSON.stringify({status:'held',failureCode:panelFailureCodeV3(e),actualProviderCalls:0,actualKeyReads:0})+'\n');process.exitCode=2;}
