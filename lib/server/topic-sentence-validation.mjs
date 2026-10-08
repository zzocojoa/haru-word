import { handleCardAutomationRelay } from './card-automation.generated.mjs';

const origin = 'https://wordgrain-oxford-study.hoihou-o.chatgpt.site';
const path = '/api/card-automation';
const topics = ['영화 대사','영화 감상 영어','여행 영어','면접 영어'];
const json = (value,status=200) => Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hex = bytes => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,'0')).join('');
const encode = value => new TextEncoder().encode(value);
async function hmac(key,text) {
  const imported = await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return crypto.subtle.sign('HMAC',imported,encode(text));
}
function matches(actual,expected) {
  if (!/^[a-f0-9]{64}$/.test(actual) || !/^[a-f0-9]{64}$/.test(expected)) return false;
  let difference=0; for(let i=0;i<64;i++) difference |= actual.charCodeAt(i)^expected.charCodeAt(i);
  return difference===0;
}
async function signed(body,config,now) {
  const key = await hmac(encode(config.card_studio_bridge_secret),`en-card:ai-relay:v1:${config.card_studio_owner_id}`);
  const text=JSON.stringify(body),time=String(now),nonce=crypto.randomUUID();
  const signature=hex(await hmac(key,`POST\n${path}\n${time}\n${nonce}\n${text}`));
  return new Request(origin+path,{method:'POST',body:text,headers:{'Content-Type':'application/json','X-Card-Time':time,'X-Card-Nonce':nonce,'X-Card-Signature':signature}});
}
async function boundedBody(request) {
  if (!request.body || Number(request.headers.get('Content-Length'))>65536) throw new Error();
  const reader=request.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(5000)]);
  let abort;
  const aborted=new Promise((_,reject)=>{ abort=()=>reject(new Error()); signal.addEventListener('abort',abort,{once:true}); });
  let bytes=0,text='';
  try {
    for (;;) {
      signal.throwIfAborted();
      const chunk=await Promise.race([reader.read(),aborted]);
      if(chunk.done) break;
      bytes+=chunk.value.byteLength;
      if(bytes>65536) throw new Error();
      text+=decoder.decode(chunk.value,{stream:true});
    }
    text+=decoder.decode();
    return JSON.parse(text);
  } finally { signal.removeEventListener('abort',abort); void reader.cancel().catch(()=>{}); reader.releaseLock(); }
}
// Disabled by default. Separate short-lived secret; existing provider/bridge secrets never leave the server.
export async function handleTopicSentenceValidation(request,config,transport=fetch,clock=Date.now) {
  const now=clock(),expires=Date.parse(config.topic_sentence_validation_expires??'');
  const token=config.topic_sentence_validation_key??'';
  if(!/^[a-f0-9]{64}$/.test(token)||!Number.isFinite(expires)||expires<=now||expires>now+86400000) return json({error:'validation_disabled'},404);
  if(new URL(request.url).origin!==origin||new URL(request.url).pathname!=='/api/card-automation-validation'||request.method!=='POST') return json({error:'invalid'},404);
  if(!matches(request.headers.get('X-Topic-Validation-Key')??'',token)) return json({error:'auth'},403);
  if(request.headers.has('Origin')||request.headers.has('Cookie')||request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json') return json({error:'auth'},403);
  if(config.card_studio_enabled!=='true'||!config.card_studio_owner_id||!config.card_studio_bridge_secret||config.card_studio_bridge_secret.length<32||!config.DB) return json({error:'config'},503);
  let body;
  try { body=await boundedBody(request); } catch { return json({error:'invalid'},400); }
  if(body?.action==='status'&&Object.keys(body).length===1) return handleCardAutomationRelay(await signed({action:'status'},config,now),config,transport,clock);
  const input=body?.input;
  if(body?.action!=='call'||Object.keys(body).sort().join(',')!=='action,input,number'||!Number.isInteger(body.number)||body.number<1||body.number>48||
    !topics.includes(input?.settings?.topic)||input.settings.level!=='초급'||input.settings.template!=='expression'||input.settings.base_expression!==''||
    !['interpret','select','draft','review'].includes(input.stage)) return json({error:'invalid'},400);
  // At most 48 provider attempts per authorization across concurrent requests and restarts.
  // Only the existing security nonce table is written; no card, learner, schedule or send data.
  const authorization=hex(await crypto.subtle.digest('SHA-256',encode(token)));
  try {
    const used=await config.DB.batch([config.DB.prepare('INSERT INTO card_automation_nonces(nonce,expires_at) VALUES(?,?) ON CONFLICT(nonce) DO NOTHING')
      .bind(`topic-validation:${authorization}:${body.number}`,expires+300000)]);
    if(used[0]?.meta.changes!==1) return json({error:'validation_call_used'},409);
  } catch { return json({error:'unavailable'},503); }
  return handleCardAutomationRelay(await signed({action:'call',free:'google_groq_free',input},config,now),config,transport,clock);
}
