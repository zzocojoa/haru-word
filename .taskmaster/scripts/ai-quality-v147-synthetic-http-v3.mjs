// Owned loopback-only fake endpoint. Deliberately closes every connection;
// neither production transport nor a diagnosis of the old socket failure.
import {createServer,request} from 'node:http';
import {openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileBudgetV3} from './ai-quality-v147-budget-v3.mjs';
import {responseEnvelopeV3} from './ai-quality-v147-panel-fixture-v3.mjs';
import {materializeReferenceReviewV4} from './ai-quality-v147-reference-v4.mjs';
import {materializeOperationalReferenceWireV1} from './ai-quality-v147-operational-reference-v1.mjs';
const check=(ok,code)=>{if(!ok)throw Error('PX3_HTTP_'+code);};
const sha=x=>createHash('sha256').update(x).digest('hex');
export function syntheticExpectedWireV3(bundle,key){
 const d=bundle.spec.requests.find(d=>d.key===key),w=bundle.wires[key];check(d&&w,'SLOT');if(d.bodyKind==='static')return w.raw;const b=JSON.parse(w.templateRaw),v=JSON.parse(b.input[0].content),p=JSON.parse(bundle.responses[d.parentKey]);if(b.text.format.name==='reference_review_operational_v1')return materializeOperationalReferenceWireV1(w.templateRaw,p);let content=v;if(d.role==='review')v.EVALUATION_DATA.feedback=p;else if(b.text.format.name==='reference_review_v4')content=materializeReferenceReviewV4(v,p);else v.REFERENCE_DATA.draft=p;b.input[0].content=JSON.stringify(content);return JSON.stringify(b);
}
export async function startSyntheticHttpV3({bundle,logFile,responseFor=null}){
 const k=compileBudgetV3(bundle.spec);check(k.spec.mode==='synthetic','SYNTHETIC_ONLY');const frozen=structuredClone(bundle),byId=new Map(k.spec.requests.map(d=>[k.requestId(d.key),d])),seen=new Set(),events=[],sockets=new Set(),fd=openSync(logFile,'wx',0o600);let closed=false;
 const event=v=>{const row={sequence:events.length,...v};writeFileSync(fd,JSON.stringify(row)+'\n');fsyncSync(fd);events.push(row);};
 const server=createServer(async(req,res)=>{res.setHeader('Connection','close');let raw='',id=req.headers['x-synthetic-request-id'],d=byId.get(id);try{
  check(req.method==='POST'&&req.url==='/responses'&&!req.headers.authorization&&d,'ROUTE');const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;check(size<=131072,'REQUEST_BYTES');chunks.push(chunk);}raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));check(!seen.has(id),'DUPLICATE');check(raw===syntheticExpectedWireV3(frozen,d.key),'BODY');seen.add(id);
  const r=responseFor?await responseFor({key:d.key,requestId:id,requestRaw:raw,descriptor:d}):{status:200,contentType:'application/json',responseRaw:responseEnvelopeV3(frozen,d.key)};event({key:d.key,requestId:id,bodySha256:sha(raw),status:r.disconnect?'disconnected':r.status,accepted:true});if(r.disconnect){req.socket.destroy();return;}res.statusCode=r.status;res.setHeader('Content-Type',r.contentType);res.end(r.responseRaw);
 }catch(e){event({requestId:typeof id==='string'&&byId.has(id)?id:null,bodySha256:sha(raw),accepted:false,code:/^PX3_HTTP_[A-Z_]+$/.test(e?.message??'')?e.message:'PX3_HTTP_IO'});res.statusCode=409;res.setHeader('Content-Type','application/json');res.end('{"error":"synthetic-held"}');}});
 server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});const address=server.address();check(address.address==='127.0.0.1','BIND');const endpoint=`http://127.0.0.1:${address.port}/responses`;
 function send({requestId,requestRaw}){check(!closed&&byId.has(requestId)&&typeof requestRaw==='string','SEND');return new Promise((done,reject)=>{const q=request(endpoint,{method:'POST',agent:false,headers:{'content-type':'application/json','content-length':Buffer.byteLength(requestRaw),'x-synthetic-request-id':requestId,'connection':'close'}},r=>{const chunks=[];let size=0;r.on('data',b=>{size+=b.length;if(size>262144){r.destroy();reject(Error('PX3_HTTP_RESPONSE_BYTES'));}else chunks.push(b);});r.on('error',()=>reject(Error('PX3_HTTP_RECEIVE')));r.on('end',()=>{try{done({status:r.statusCode,contentType:String(r.headers['content-type']??''),responseRaw:new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))});}catch{reject(Error('PX3_HTTP_UTF8'));}});});q.setTimeout(15000,()=>q.destroy());q.on('error',()=>reject(Error('PX3_HTTP_SEND')));q.end(requestRaw);});}
 return Object.freeze({endpoint,send,events:()=>structuredClone(events),async close(){check(!closed,'CLOSED');closed=true;try{await new Promise((done,reject)=>server.close(e=>e?reject(e):done()));}finally{for(const s of sockets)s.destroy();fsyncSync(fd);closeSync(fd);}return {events:events.length,accepted:seen.size,sockets:sockets.size,listening:server.listening,ownedServerStopped:!server.listening,actualProviderCalls:0,actualKeyReads:0};}});
}
