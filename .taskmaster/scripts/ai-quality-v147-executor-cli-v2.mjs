// Owned loopback fake-provider CLI. Intentionally has no real-provider mode.
import {createServer} from 'node:http';
import {readFileSync, existsSync, realpathSync, lstatSync, openSync, writeFileSync, fsyncSync, closeSync} from 'node:fs';
import {resolve, dirname, basename} from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {validateSpecV2, validateApprovalV2, newLedgerV2, accountV2, slotKey, v2RequestId} from './ai-quality-v147-budget-v2.mjs';
import {verifyV2Freeze} from './ai-quality-v147-wire-v2.mjs';
import {createV2Journal, readV2Journal} from './ai-quality-v147-journal-v2.mjs';
import {openSyntheticExecutorV2} from './ai-quality-v147-executor-v2.mjs';
import {reportSyntheticJournalV2} from './ai-quality-v147-journal-report-v2.mjs';

const check = (ok, code) => {if (!ok) throw new Error(code);};
const sha = raw => createHash('sha256').update(raw).digest('hex');
const durable = (file, raw, flags='wx') => {const fd=openSync(file,flags,0o600);try{writeFileSync(fd,raw);fsyncSync(fd);}finally{closeSync(fd);}};
const [command,bundleArgument,rootArgument,crashStage] = process.argv.slice(2);
let server, executor, summary;
try {
  check(command === '--synthetic' && bundleArgument && rootArgument && process.argv.length <= 7, 'V2CLI_SYNTHETIC_ARGUMENTS');
  const bundleFile=resolve(bundleArgument), root=realpathSync(rootArgument);
  check(!lstatSync(root).isSymbolicLink() && !lstatSync(bundleFile).isSymbolicLink() && lstatSync(bundleFile).isFile() && lstatSync(bundleFile).nlink===1, 'V2CLI_REGULAR_INPUTS');
  const bundleBytes=readFileSync(bundleFile), bundle=JSON.parse(bundleBytes.toString('utf8')), {spec,approval,seal,current,wires,responses}=bundle;
  validateSpecV2(spec);check(spec.mode==='synthetic','V2CLI_SYNTHETIC_ONLY');validateApprovalV2(spec,approval);verifyV2Freeze({spec,seal,current});
  check(current.environment.nodeVersion===process.version && current.environment.platform===process.platform && current.environment.arch===process.arch,'V2CLI_ACTUAL_RUNTIME');
  const context={directory:resolve(root,spec.runId),allowedRoot:root,spec};check(dirname(context.directory)===root,'V2CLI_SCOPE');
  const ledger=existsSync(context.directory)?readV2Journal(context).ledger:newLedgerV2(spec,approval), balance=accountV2(spec,ledger);
  check(ledger.closed || !ledger.hold && !balance.overBudget && BigInt(balance.limitMicros)>0n,'V2CLI_UNAPPROVED');
  if(!existsSync(context.directory))createV2Journal(context,approval);
  const sendsFile=resolve(root,spec.runId+'-v2-provider.jsonl'), seen=new Set();
  if(existsSync(sendsFile)){
    check(lstatSync(sendsFile).isFile()&&!lstatSync(sendsFile).isSymbolicLink()&&lstatSync(sendsFile).nlink===1,'V2CLI_PROVIDER_LOG');
    for(const line of readFileSync(sendsFile,'utf8').trim().split('\n').filter(Boolean)){const row=JSON.parse(line);check(row.runId===spec.runId&&row.requestId===v2RequestId(spec,row.key)&&!seen.has(row.requestId),'V2CLI_PROVIDER_LOG_BINDING');seen.add(row.requestId);}
  }else durable(sendsFile,'');
  const before=seen.size, descriptors=new Map(spec.batches.flatMap(b=>b.requests.map(d=>[slotKey(d),d])));
  server=createServer(async(req,res)=>{
    try{
      check(req.method==='POST'&&req.url==='/synthetic-responses'&&!req.headers.authorization,'V2CLI_FAKE_ENDPOINT');
      const key=req.headers['x-synthetic-key'],requestId=req.headers['x-synthetic-request'];check(descriptors.has(key)&&requestId===v2RequestId(spec,key)&&!seen.has(requestId),'V2CLI_DUPLICATE_OR_FOREIGN');
      const parts=[];let length=0;for await(const chunk of req){length+=chunk.length;check(length<=262144,'V2CLI_REQUEST_SIZE');parts.push(chunk);}const raw=Buffer.concat(parts).toString('utf8');
      let expected=wires[key]?.raw;
      if(spec.wirePolicies[key].kind==='derived'){
        const template=JSON.parse(wires[key].templateRaw),content=JSON.parse(template.input[0].content);content.feedback=JSON.parse(responses[spec.wirePolicies[key].parentKey].payloadRaw);template.input[0].content=JSON.stringify(content);expected=JSON.stringify(template);
      }
      check(raw===expected&&JSON.parse(raw).model===descriptors.get(key).modelId,'V2CLI_FAKE_BODY');
      seen.add(requestId);durable(sendsFile,JSON.stringify({runId:spec.runId,key,requestId,bodySha256:sha(raw),synthetic:true})+'\n','a');
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(responses[key]));
    }catch{res.writeHead(409,{'content-type':'application/json'});res.end('{"error":"SYNTHETIC_REQUEST_REJECTED"}');}
  });
  await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res);});
  const endpoint='http://127.0.0.1:'+server.address().port+'/synthetic-responses';
  const stages=['executor:after-binding','executor:after-consume-before-transport','executor:after-transport-before-capture','executor:after-capture-before-settle'];
  check(crashStage===undefined||stages.includes(crashStage),'V2CLI_FAULT_STAGE');
  executor=openSyntheticExecutorV2({context,seal,observeCurrent:()=>{
    check(sha(readFileSync(bundleFile))===sha(bundleBytes),'V2CLI_BUNDLE_CHANGED');return current;
  },readWire:key=>wires[key],transport:async({key,requestId,raw})=>{
    const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-synthetic-key':key,'x-synthetic-request':requestId},body:raw,signal:AbortSignal.timeout(10000)});
    check(response.ok,'V2CLI_FAKE_PROVIDER_REJECTED');return response.json();
  },testFault:stage=>{if(stage===crashStage)process.exit(81);}});
  if(bundle.testOwnedGate===true){process.stdout.write('{"ownedReady":true}\n');await new Promise(res=>process.stdin.once('data',res));process.stdin.destroy();}
  const started=Date.now();summary={...await executor.collect(),elapsedMs:Date.now()-started,runId:spec.runId,syntheticProviderSendsBefore:before,syntheticProviderSendsTotal:seen.size,syntheticProviderSendsAdded:seen.size-before};
  if(bundle.cases?.length===60){const report=reportSyntheticJournalV2({context,seal,cases:bundle.cases,witnesses:bundle.witnesses});const file=resolve(root,spec.runId+'-v2-report-'+randomUUID()+'.json');durable(file,JSON.stringify(report,null,2)+'\n');summary.reportFile=basename(file);}
  const output=resolve(root,spec.runId+'-v2-summary-'+randomUUID()+'.json');check(dirname(output)===root,'V2CLI_SUMMARY_SCOPE');durable(output,JSON.stringify(summary,null,2)+'\n');
  process.stdout.write(JSON.stringify({status:summary.status,plannedSlots:summary.plannedSlots,counts:summary.counts,syntheticProviderSendsAdded:summary.syntheticProviderSendsAdded,closed:summary.closed,actualProviderCalls:0,actualKeyReads:0,summary:basename(output)})+'\n');
  if(summary.status!=='synthetic-collection-complete')process.exitCode=2;
} catch(error) {
  // Only owned finite identifiers are exposed. Never echo messages,stacks or input.
  const code=typeof error?.message==='string'&&/^[A-Z][A-Z0-9_]{1,80}$/.test(error.message)?error.message:'V2CLI_HELD';
  process.stderr.write(JSON.stringify({status:'held',code,actualProviderCalls:0,actualKeyReads:0})+'\n');process.exitCode=1;
} finally {
  try{executor?.release();}catch{process.exitCode=1;process.stderr.write('{"status":"held","code":"V2CLI_RELEASE_HELD"}\n');}
  if(server)await new Promise(resolveClose=>server.close(resolveClose));
}
