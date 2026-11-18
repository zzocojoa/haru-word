// Synthetic CLI revision3: finite HTTP diagnostics and no reused connections.
// Budget protocol remains v2. Old CLI,ledgers and failure evidence stay intact.
import {readFileSync,writeFileSync,openSync,closeSync,fsyncSync,realpathSync,lstatSync,existsSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {validateSpecV2,validateApprovalV2,newLedgerV2,accountV2} from './ai-quality-v147-budget-v2.mjs';
import {verifyV2Freeze} from './ai-quality-v147-wire-v2.mjs';
import {createV2Journal,readV2Journal} from './ai-quality-v147-journal-v2.mjs';
import {openSyntheticExecutorV2} from './ai-quality-v147-executor-v2.mjs';
import {reportSyntheticJournalV2} from './ai-quality-v147-journal-report-v2.mjs';
import {startSyntheticHttpV2} from './ai-quality-v147-synthetic-http-v2.mjs';
const check=(ok,code)=>{if(!ok)throw new Error(code);},sha=x=>createHash('sha256').update(x).digest('hex');
function save(file,value){const fd=openSync(file,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}}
const [command,bundleArgument,rootArgument,crashStage]=process.argv.slice(2);let provider,executor;
try{
 check(command==='--synthetic'&&bundleArgument&&rootArgument&&process.argv.length<=7,'V3CLI_ARGUMENTS');
 const file=resolve(bundleArgument),root=realpathSync(rootArgument);check(root===resolve(rootArgument)&&!lstatSync(root).isSymbolicLink()&&!lstatSync(file).isSymbolicLink()&&lstatSync(file).isFile()&&lstatSync(file).nlink===1,'V3CLI_SCOPE');
 const bytes=readFileSync(file),bundle=JSON.parse(bytes.toString('utf8')),{spec,approval,seal,current,wires}=bundle;
 check(spec.mode==='synthetic'&&bundle.syntheticOnly===true,'V3CLI_SYNTHETIC_ONLY');validateSpecV2(spec);validateApprovalV2(spec,approval);verifyV2Freeze({spec,seal,current});
 check(current.environment.nodeVersion===process.version&&current.environment.platform===process.platform&&current.environment.arch===process.arch,'V3CLI_ACTUAL_RUNTIME');
 const context={directory:resolve(root,spec.runId),allowedRoot:root,spec};check(dirname(context.directory)===root,'V3CLI_SCOPE');
 const existed=existsSync(context.directory),ledger=existed?readV2Journal(context).ledger:newLedgerV2(spec,approval),balance=accountV2(spec,ledger);
 check(!existed||ledger.closed,'V3CLI_EXISTING_OPEN_HELD');check(ledger.closed||!ledger.hold&&!balance.overBudget&&BigInt(balance.limitMicros)>0n,'V3CLI_UNAPPROVED');
 const stages=['executor:after-binding','executor:after-consume-before-transport','executor:after-transport-before-capture','executor:after-capture-before-settle'];check(crashStage===undefined||stages.includes(crashStage),'V3CLI_FAULT_STAGE');
 if(!existed){createV2Journal(context,approval);provider=await startSyntheticHttpV2({bundle,allowedRoot:root});}
 executor=openSyntheticExecutorV2({context,seal,observeCurrent:()=>{check(sha(readFileSync(file))===sha(bytes),'V3CLI_BUNDLE_CHANGED');return current;},readWire:key=>wires[key],transport:r=>{check(provider,'V3CLI_CLOSED_TRANSPORT');return provider.send(r);},testFault:stage=>{if(stage===crashStage)process.exit(82);}});
 if(bundle.testOwnedGate===true){process.stdout.write('{"ownedReady":true}\n');await new Promise(res=>process.stdin.once('data',res));process.stdin.destroy();}
 const started=Date.now(),summary={...await executor.collect(),runId:spec.runId,cliRevision:3,elapsedMs:Date.now()-started,syntheticProviderSendsAdded:provider?.inspect().accepted??0,syntheticConnectionPolicy:'close-every-request'};
 if(bundle.cases?.length===60){const report=reportSyntheticJournalV2({context,seal,cases:bundle.cases,witnesses:bundle.witnesses}),reportFile=resolve(root,spec.runId+'-v3-report-'+randomUUID()+'.json');save(reportFile,report);summary.reportFile=basename(reportFile);}
 if(provider){const info=provider.inspect();summary.syntheticHttpLogFile=basename(provider.logFile);summary.syntheticSocketCount=info.sockets;summary.syntheticClientAttempts=info.events.filter(e=>e.kind==='client-start').length;summary.syntheticClientFailures=info.events.filter(e=>e.kind==='client-failed').length;}
 const output=resolve(root,spec.runId+'-v3-summary-'+randomUUID()+'.json');save(output,summary);
 process.stdout.write(JSON.stringify({status:summary.status,plannedSlots:summary.plannedSlots,counts:summary.counts,closed:summary.closed,syntheticProviderSendsAdded:summary.syntheticProviderSendsAdded,syntheticClientFailures:summary.syntheticClientFailures??0,actualProviderCalls:0,actualKeyReads:0,summary:basename(output)})+'\n');
 if(summary.status!=='synthetic-collection-complete')process.exitCode=2;
}catch(error){const code=typeof error?.message==='string'&&/^[A-Z][A-Z0-9_]{1,80}$/.test(error.message)?error.message:'V3CLI_HELD';process.stderr.write(JSON.stringify({status:'held',code,actualProviderCalls:0,actualKeyReads:0})+'\n');process.exitCode=1;}
finally{
 try{executor?.release();}catch{process.exitCode=1;process.stderr.write('{"status":"held","code":"V3CLI_RELEASE_HELD"}\n');}
 try{if(provider)await provider.stop();}catch{process.exitCode=1;process.stderr.write('{"status":"held","code":"V3CLI_PROVIDER_STOP_HELD"}\n');}
}
