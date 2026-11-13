import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {Miniflare,Response as LocalResponse} from 'miniflare';

const source=`
import {generateOpenAiFeedback,generateStructuredOpenAiFeedback} from './lib/openai-feedback';
import {systemInstruction,legacySystemInstruction} from './lib/feedback-prompts';
import {generateGrammarFeedback} from './lib/grammar/feedback';
import {LESSON_MAP} from './lib/grammar/content';
import {lessonForVersion} from './lib/grammar/content-v4';
export async function run(domain,modelId,structured,fetcher) {
 const config={apiKey:'SYNTHETIC_NEVER_REAL',modelId,allowedModels:modelId,judgmentEnabled:!structured};
 if(domain==='grammar')return generateGrammarFeedback(config,lessonForVersion(LESSON_MAP.get('auxiliary'),4),'I am reading.',fetcher);
 const input={word:'book',pos:'n.',meaning:'책',sentence:'This is a book.'};
 return (structured?generateStructuredOpenAiFeedback:generateOpenAiFeedback)(config,input,structured?legacySystemInstruction:systemInstruction,fetcher);
}
export default {async fetch(request){
 const u=new URL(request.url),fault=u.searchParams.get('fault');
 const fetcher=fault==='body'?async(url,init)=>{await fetch(url,init);return new Response(new ReadableStream({start(c){c.error(new Error('Synthetic body read fault'));}}),{headers:{'content-type':'application/json'}});}:fetch;
 try{const {createdAt,...feedback}=await run(u.searchParams.get('domain'),u.searchParams.get('model'),u.searchParams.has('structured'),fetcher);return Response.json({feedback});}
 catch(e){return Response.json({code:e.code,status:e.status,stage:e.validationStage,judgmentReason:e.judgmentReason});}
}};
`;
await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'ts'},outfile:'work/ai-quality-worker-equivalence/node.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const node=await import(pathToFileURL(process.cwd()+'/work/ai-quality-worker-equivalence/node.mjs'));
const {outputFiles}=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'ts'},write:false,bundle:true,format:'esm',platform:'browser',logLevel:'silent'});

const snapshot=(url,method,headers,body)=>({url,method,contentType:headers.get('content-type'),authorization:headers.get('authorization'),body});
function wireResponse(body,fault=''){
 const input=JSON.parse(body.input[0].content),judgment=body.text.format.name==='study_judgment';
 const wire=judgment?{meaningUsage:'appropriate',grammar:'natural',correctedSentence:input.sentence,targetReason:'합성 목표',grammarReason:'합성 문법',correctionReason:'',contextNeeded:'none'}:{meaningUsage:'appropriate',grammar:'natural',correctedSentence:input.sentence,explanation:'합성 의견',structure:{status:'unavailable',translation:'',parts:[],note:'합성'}};
 if(fault==='fields')wire.grammar='SYNTHETIC_INVALID_ENUM';
 return fault==='envelope'?{status:'completed',output:'SYNTHETIC_INVALID_ENVELOPE'}:{status:'completed',model:body.model,output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(wire)}]}]};
}
async function worker(t,handler){
 const instance=new Miniflare({host:'127.0.0.1',port:0,inspectorPort:0,workers:[{config:{name:'ai-quality-equivalence',compatibilityDate:'2026-05-22',manifest:{mainModule:'worker.mjs',modules:{'worker.mjs':{type:'esm',contents:outputFiles[0].text}}}},dev:{outboundService:{type:'fetcher',handler}}}]});
 t.after(()=>instance.dispose());return instance;
}

test('real Worker and Node produce identical request bodies and visible results for both domains, contracts and three models',async t=>{
 t.mock.method(console,'info',()=>{});
 const requests=[];
 const instance=await worker(t,async request=>{const text=await request.text();requests.push(snapshot(request.url,request.method,request.headers,text));return LocalResponse.json(wireResponse(JSON.parse(text)));});
 for(const model of ['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra'])for(const domain of ['word','grammar'])for(const structured of [false,true]){
  let expected,calls=0;
  const {createdAt,...feedback}=await node.run(domain,model,structured,async(url,init)=>{calls++;assert.equal(init.redirect,'manual');expected=snapshot(url,init.method,new Headers(init.headers),init.body);return Response.json(wireResponse(JSON.parse(init.body)));});
  const before=requests.length,url='http://local.test/?domain='+domain+'&model='+model+(structured?'&structured=1':'');
  const response=await instance.dispatchFetch(url);assert.deepEqual(await response.json(),{feedback},domain+'/'+model+'/'+structured);assert.ok(Number.isFinite(Date.parse(createdAt)));
  assert.equal(calls,1);assert.equal(requests.length,before+1);assert.deepEqual(requests.at(-1),expected);
  const body=JSON.parse(expected.body);assert.equal(body.max_output_tokens,4096);assert.equal(body.store,false);assert.equal(body.stream,false);assert.equal(body.text.format.strict,true);
 }
 assert.equal(requests.length,12);
});

test('actual workerd distinguishes a native body read fault from post-response envelope and field rejection',async t=>{
 let fault='',calls=0;
 const instance=await worker(t,async request=>{calls++;return LocalResponse.json(wireResponse(await request.json(),fault));});
 for(const [kind,expected]of [['body',{code:'provider_network',status:503,stage:'envelope'}],['envelope',{code:'provider_invalid_response',status:502,stage:'envelope'}],['fields',{code:'provider_invalid_response',status:502,stage:'fields'}]]){
  fault=kind;const response=await instance.dispatchFetch('http://local.test/?domain=word&model=gpt-6.1-sol&fault='+kind);assert.deepEqual(await response.json(),expected,kind);
 }
 assert.equal(calls,3);
});
