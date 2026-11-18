// Owned loopback fake provider only. Finite diagnostics never contain bodies,
// error messages/stacks,authorization headers,environment values or credentials.
import {createServer} from 'node:http';
import {realpathSync,lstatSync,openSync,writeFileSync,fsyncSync,closeSync,readFileSync,fstatSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {validateSpecV2,slotKey,v2RequestId,digest} from './ai-quality-v147-budget-v2.mjs';
const check=(ok,code)=>{if(!ok)throw Object.assign(new Error('OWNED_SYNTHETIC_HTTP_FAILURE'),{syntheticCode:code});};
const sha=x=>createHash('sha256').update(x).digest('hex');
const own=(v,k)=>{try{const d=Object.getOwnPropertyDescriptor(v??{},k);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}};
const nativeCodes=new Set(['UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','ECONNRESET','ECONNREFUSED','ETIMEDOUT','EPIPE','ERR_STREAM_PREMATURE_CLOSE','ABORT_ERR']);
function nativeCode(error){const code=own(error,'code')??own(own(error,'cause'),'code');if(nativeCodes.has(code))return code;return error instanceof DOMException&&['TimeoutError','AbortError'].includes(error.name)?'ABORT_ERR':'UNKNOWN';}
const failureCodes=new Set(['ENDPOINT','REQUEST_ID','SIZE','BODY','DUPLICATE','FORCED_DISCONNECT','FORCED_STATUS','REUSED_SOCKET_DISCONNECT','SERVER_IO','NETWORK','HTTP_STATUS','BODY_JSON','CLIENT_INPUT']);
function projectedError(kind,status=null){
 const code=kind==='BODY_JSON'?'provider_invalid_response':kind==='HTTP_STATUS'?'provider_request':'provider_network';
 return Object.assign(new Error('OWNED_SYNTHETIC_TRANSPORT_FAILURE'),{code,status:503,issue:{code,...(status===null?{}:{providerStatus:status})},...(kind==='BODY_JSON'?{validationStage:'json_syntax'}:{})});
}

export async function startSyntheticHttpV2({bundle,allowedRoot,testKeepAlive=false,testFault}){
 check(bundle?.spec?.mode==='synthetic'&&bundle.syntheticOnly===true,'CLIENT_INPUT');validateSpecV2(bundle.spec);
 const spec=structuredClone(bundle.spec),wires=structuredClone(bundle.wires),responses=structuredClone(bundle.responses),root=realpathSync(allowedRoot);
 check(root===resolve(allowedRoot)&&!lstatSync(root).isSymbolicLink(),'CLIENT_INPUT');
 const file=resolve(root,spec.runId+'-http-v2.jsonl');check(dirname(file)===root,'CLIENT_INPUT');
 const fd=openSync(file,'wx',0o600);let ordinal=0,server,stopped=false,sendBusy=false,socketCount=0;const sockets=new Map(),seen=new Set(),events=[];
 function record(kind,{key=null,requestId=null,bodySha256=null,status=null,native=null,failure=null,socketId=null,elapsedMs=null}={}){
  check(failure===null||failureCodes.has(failure),'CLIENT_INPUT');check(native===null||native==='UNKNOWN'||nativeCodes.has(native),'CLIENT_INPUT');
  const row={schemaVersion:1,protocol:'ai-quality-v147-synthetic-http-v2',runId:spec.runId,ordinal:++ordinal,kind,keyHash:key===null?null:digest(key),requestId,bodySha256,status,nativeCode:native,failureCode:failure,socketId,elapsedMs};
  const now=lstatSync(file),opened=fstatSync(fd);check(now.isFile()&&!now.isSymbolicLink()&&now.nlink===1&&now.ino===opened.ino&&now.dev===opened.dev,'CLIENT_INPUT');
  writeFileSync(fd,JSON.stringify(row)+'\n');fsyncSync(fd);events.push(row);return row;
 }
 const descriptors=new Map(spec.batches.flatMap(b=>b.requests.map(d=>[slotKey(d),d]))),ids=new Map();
 function id(key){if(!ids.has(key))ids.set(key,v2RequestId(spec,key));return ids.get(key);}
 function expected(key){
  const policy=spec.wirePolicies[key];if(policy.kind==='static')return wires[key].raw;
  const template=JSON.parse(wires[key].templateRaw),content=JSON.parse(template.input[0].content);content.feedback=JSON.parse(responses[policy.parentKey].payloadRaw);template.input[0].content=JSON.stringify(content);return JSON.stringify(template);
 }
 record('start');
 server=createServer(async(req,res)=>{
  const socket=sockets.get(req.socket);socket.requests++;let key=null,requestId=null;
  try{
   check(req.method==='POST'&&req.url==='/synthetic-responses'&&!req.headers.authorization,'ENDPOINT');
   key=req.headers['x-synthetic-key'];check(descriptors.has(key),'REQUEST_ID');requestId=req.headers['x-synthetic-request'];check(requestId===id(key),'REQUEST_ID');
   record('server-received',{key,requestId,socketId:socket.id});check(!seen.has(requestId),'DUPLICATE');
   const action=testFault?.('server-before-accept',{requestId,keyHash:digest(key),socketRequests:socket.requests});
   if(action==='disconnect'||action==='disconnect-reuse'&&socket.requests>1){record('server-rejected',{key,requestId,socketId:socket.id,failure:action==='disconnect'?'FORCED_DISCONNECT':'REUSED_SOCKET_DISCONNECT'});req.socket.destroy();return;}
   if(action==='status503'){record('server-rejected',{key,requestId,socketId:socket.id,status:503,failure:'FORCED_STATUS'});res.writeHead(503,{'content-type':'application/json',connection:'close'});res.end('{}');return;}
   const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;check(size<=262144,'SIZE');parts.push(chunk);}const raw=Buffer.concat(parts).toString('utf8');
   check(raw===expected(key)&&JSON.parse(raw).model===descriptors.get(key).modelId,'BODY');
   if(!testKeepAlive)check(req.headers.connection?.toLowerCase()==='close','ENDPOINT');
   seen.add(requestId);record('server-accepted',{key,requestId,bodySha256:sha(raw),status:200,socketId:socket.id});
   res.writeHead(200,{'content-type':'application/json',...(testKeepAlive?{}:{connection:'close'})});
   res.end(testFault?.('server-response',{requestId,keyHash:digest(key)})==='non-json'?'{not json':JSON.stringify(responses[key]));
  }catch(error){
   const code=own(error,'syntheticCode'),failure=failureCodes.has(code)?code:'SERVER_IO';
   record('server-rejected',{key:descriptors.has(key)?key:null,requestId:descriptors.has(key)&&requestId===id(key)?requestId:null,socketId:socket.id,failure,native:nativeCode(error)});
   if(!res.destroyed&&!res.writableEnded){res.writeHead(409,{'content-type':'application/json',connection:'close'});res.end('{}');}
  }
 });
 server.on('connection',socket=>{const value={id:++socketCount,requests:0};sockets.set(socket,value);record('socket-open',{socketId:value.id});socket.on('close',()=>{if(!stopped)record('socket-close',{socketId:value.id});});});
 server.on('clientError',(error,socket)=>{record('server-native-failure',{failure:'SERVER_IO',native:nativeCode(error),socketId:sockets.get(socket)?.id??null});socket.destroy();});
 try{await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});}catch(error){closeSync(fd);throw error;}
 const endpoint='http://127.0.0.1:'+server.address().port+'/synthetic-responses';
 return Object.freeze({
  endpoint,logFile:file,
  async send({key,requestId,raw}){
   check(!stopped&&!sendBusy&&descriptors.has(key)&&requestId===id(key)&&typeof raw==='string','CLIENT_INPUT');sendBusy=true;const start=performance.now();
   try{
    record('client-start',{key,requestId,bodySha256:sha(raw)});let response;
    try{response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-synthetic-key':key,'x-synthetic-request':requestId,...(testKeepAlive?{}:{connection:'close'})},body:raw,signal:AbortSignal.timeout(10000)});}
    catch(error){record('client-failed',{key,requestId,failure:'NETWORK',native:nativeCode(error),elapsedMs:Math.round(performance.now()-start)});throw projectedError('NETWORK');}
    if(!response.ok){record('client-failed',{key,requestId,failure:'HTTP_STATUS',status:response.status,elapsedMs:Math.round(performance.now()-start)});await response.body?.cancel();throw projectedError('HTTP_STATUS',response.status);}
    let value;try{value=await response.json();}catch(error){record('client-failed',{key,requestId,failure:'BODY_JSON',native:nativeCode(error),status:response.status});throw projectedError('BODY_JSON',response.status);}
    record('client-completed',{key,requestId,status:response.status,elapsedMs:Math.round(performance.now()-start)});return value;
   }finally{sendBusy=false;}
  },
  inspect(){return {events:structuredClone(events),accepted:seen.size,sockets:socketCount,connectionPolicy:testKeepAlive?'test-keep-alive':'close-every-request',actualProviderCalls:0,actualKeyReads:0};},
  async stop(){check(!stopped&&!sendBusy,'CLIENT_INPUT');await new Promise(yes=>{server.close(yes);server.closeAllConnections();});record('stopped');stopped=true;fsyncSync(fd);closeSync(fd);return {stopped:true,accepted:seen.size,sockets:socketCount,logSha256:sha(readFileSync(file)),actualProviderCalls:0};}
 });
}
