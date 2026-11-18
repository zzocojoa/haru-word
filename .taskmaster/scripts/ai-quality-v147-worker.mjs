// Full built Vinext application in local workerd. Every provider request is
// intercepted; no environment files, remote bindings or provider credentials.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions,Response as LocalResponse,Log,LogLevel} from 'miniflare';

const MODELS=['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra'];
const hash=text=>createHash('sha256').update(text).digest('hex');
async function modulesIn(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,entry.name);if(entry.isDirectory())files.push(...await modulesIn(p));else if(/\.m?js$/.test(p))files.push(p);}return files;}
function ownedWorkerd(){
 if(process.platform!=='win32')return [];
 const text=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`@(Get-CimInstance Win32_Process -Filter "ParentProcessId = ${process.pid}" | Where-Object { $_.Name -eq 'workerd.exe' } | Select-Object ProcessId,ParentProcessId,CreationDate) | ConvertTo-Json -Compress`],{windowsHide:true,encoding:'utf8'}).trim();
 const result=text?JSON.parse(text):[];return Array.isArray(result)?result:[result];
}
class SafeLog extends Log{
 constructor(events){super(LogLevel.INFO);this.events=events;this.unknown=0;}
 log(message){
  try{const start=message.indexOf('{'),end=message.lastIndexOf('}');if(start<0)throw Error();const raw=JSON.parse(message.slice(start,end+1));
   if(!/^(?:openai_feedback_completed|sentence_feedback_(?:succeeded|failed|withheld)|grammar_feedback_(?:succeeded|failed|withheld))$/.test(raw.event))throw Error();
   const safe={event:raw.event};for(const k of ['model','requestedModel'])if(MODELS.includes(raw[k]))safe[k]=raw[k];
   for(const k of ['provider','promptVersion','validationVersion','validationStage','judgmentReason','code','lessonId'])if(typeof raw[k]==='string'&&/^[A-Za-z0-9_.:-]{1,80}$/.test(raw[k]))safe[k]=raw[k];
   for(const k of ['durationMs','contentVersion'])if(Number.isSafeInteger(raw[k])&&raw[k]>=0)safe[k]=raw[k];this.events.push(safe);
  }catch{this.unknown++;}
 }
}

export async function startSyntheticWorker({label,buildSourceRoot,workspaceRoot,allowedSentences,respond}){
 assert.ok(['baseline','candidate'].includes(label));assert.ok(Array.isArray(allowedSentences)&&allowedSentences.length>0);
 const server=resolve(buildSourceRoot,'dist/server'),built=JSON.parse(await readFile(resolve(server,'wrangler.json'),'utf8')),main=resolve(server,built.main);
 assert.ok(main.startsWith(server+sep),'entrypoint outside build');
 const files=[main,...(await modulesIn(server)).filter(p=>p!==main)],modules=await Promise.all(files.map(async path=>({path,type:'ESModule',contents:await readFile(path,'utf8')})));
 const persist=resolve(workspaceRoot,'work','ai-quality-v147-worker-'+label+'-'+randomUUID());await mkdir(persist,{recursive:true});
 const before=ownedWorkerd(),events=[],providerRecords=[],log=new SafeLog(events);let owned=[],stopPromise,base;
 const options=convertV4MiniflareOptions({host:'127.0.0.1',port:0,inspectorPort:0,cf:false,telemetry:{enabled:false},logRequests:false,log,resourcePersistencePath:persist,
  workers:[{name:'ai-quality-v147-'+label,modules,modulesRoot:server,compatibilityDate:built.compatibility_date,compatibilityFlags:built.compatibility_flags,
   d1Databases:{DB:'synthetic-'+label+'-'+randomUUID()},r2Buckets:{BUCKET:'synthetic-'+label+'-'+randomUUID()},
   assets:{directory:resolve(server,built.assets.directory),binding:'ASSETS',run_worker_first:built.assets.run_worker_first??false,routerConfig:{has_user_worker:true}},
   bindings:{grammar_enabled:'true',grammar_practice_v2_enabled:'true',grammar_practice_v3_enabled:'true',grammar_practice_v4_enabled:'true',large_backup_restore_enabled:'true',ai_feedback_enabled:'true',feedback_judgment_enabled:'true',OPENAI_API_KEY:'SYNTHETIC_NEVER_REAL',OPENAI_ALLOWED_MODELS:MODELS.join(',')},
   outboundService:async request=>{
    assert.ok(request.url==='https://api.openai.com/v1/responses'&&request.method==='POST','unexpected provider destination');assert.ok(request.headers.get('authorization')==='Bearer SYNTHETIC_NEVER_REAL','expected synthetic credential');
    const text=await request.text();assert.ok(Buffer.byteLength(text)<=64*1024,'synthetic request exceeds harness bound');const body=JSON.parse(text),input=JSON.parse(body.input[0].content);
    assert.ok(MODELS.includes(body.model)&&allowedSentences.includes(input.sentence),'unexpected synthetic input');
    const response=await respond(body,text);assert.ok(response&&typeof response==='object');const responseText=JSON.stringify(response);
    providerRecords.push({ordinal:providerRecords.length+1,url:request.url,method:request.method,bodySha256:hash(text),body:text,responseSha256:hash(responseText),synthetic:true});
    return new LocalResponse(responseText,{headers:{'content-type':'application/json'}});
   }}]});
 const mf=new Miniflare(options);
 function stop(){
  return stopPromise??=(async()=>{await mf.dispose();const remaining=ownedWorkerd();assert.ok(!owned.some(p=>remaining.some(q=>q.ProcessId===p.ProcessId&&q.CreationDate===p.CreationDate)),'owned runtime remained after dispose');
   if(base){let alive=false;try{await fetch(new URL('/api/study-clock',base),{signal:AbortSignal.timeout(500)});alive=true;}catch{/* listener closed */}assert.equal(alive,false,'owned listener remained after dispose');}
  })();
 }
 try{
  const db=await mf.getD1Database('DB');for(const file of(await readdir(resolve(buildSourceRoot,'drizzle'))).filter(f=>f.endsWith('.sql')).sort())for(const statement of(await readFile(resolve(buildSourceRoot,'drizzle',file),'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
  base=await mf.ready;assert.ok(base.hostname==='127.0.0.1'&&base.protocol==='http:');owned=ownedWorkerd().filter(p=>!before.some(q=>q.ProcessId===p.ProcessId&&q.CreationDate===p.CreationDate));if(process.platform==='win32')assert.equal(owned.length,1,'one new owned workerd process');
  const cssDir=resolve(server,built.assets.directory,'_next/static/css'),css=(await readdir(cssDir)).find(f=>f.endsWith('.css'));assert.ok(css,'built stylesheet missing');
  const asset=await fetch(new URL('/_next/static/css/'+css,base));assert.equal(asset.status,200,'built asset route');assert.equal(hash(Buffer.from(await asset.arrayBuffer())),hash(await readFile(resolve(cssDir,css))),'built asset bytes');
  return {base:base.origin,db,providerRecords,events,stop,proof:{label,runtime:'actual full built Vinext/workerd',modules:modules.length,persist:relative(workspaceRoot,persist),ownedProcesses:owned,loopbackOnly:true,remoteBindings:false,providerCredentials:'fixed synthetic constant',realProviderEgress:0,compatibilityDate:built.compatibility_date,compatibilityFlags:built.compatibility_flags}};
 }catch(error){await stop();throw error;}
}
