const fs=require('node:fs'),path=require('node:path');
function validateEnvironment(env=process.env){
  const url=new URL(env.QA_BASE_URL||'http://127.0.0.1:8787');
  if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('QA_BASE_URL must be a loopback origin.');
  if(env.QA_GRAMMAR_VERSION&&!['2','3','4'].includes(env.QA_GRAMMAR_VERSION))throw Error('QA_GRAMMAR_VERSION must be 2, 3 or 4.');
  if(env.QA_NEW_GRAMMAR_VERSION&&!['3','4'].includes(env.QA_NEW_GRAMMAR_VERSION))throw Error('QA_NEW_GRAMMAR_VERSION must be 3 or 4.');
  if(env.QA_WORKER_CONFIG){
    const config=JSON.parse(fs.readFileSync(env.QA_WORKER_CONFIG,'utf8')),vars=config.vars||{};
    if(vars.ai_feedback_enabled!=='false')throw Error('QA Worker must keep real AI generation disabled.');
    const version=vars.grammar_practice_v4_enabled==='true'?4:vars.grammar_practice_v3_enabled==='true'?3:2;
    if(env.QA_GRAMMAR_VERSION&&Number(env.QA_GRAMMAR_VERSION)!==version)throw Error('QA grammar version differs from the configured Worker profile.');
  }
  let imageFiles=0;
  if(['enabled','development'].includes(env.QA_IMAGE_PILOT_MODE)){
    if(!env.QA_WORD_IMAGE_ASSET_ROOT)throw Error('Enabled full-image QA requires QA_WORD_IMAGE_ASSET_ROOT.');
    const rows=JSON.parse(fs.readFileSync(path.resolve('data/word-image-web-manifest.json'),'utf8')).entries;
    for(const entry of rows){if(!fs.existsSync(path.join(env.QA_WORD_IMAGE_ASSET_ROOT,entry.sha256+'.webp')))throw Error('Approved QA WebP assets are missing; check QA_WORD_IMAGE_ASSET_ROOT.');imageFiles++;}
  }
  return {origin:url.origin,imageFiles,realAiGeneration:env.QA_WORKER_CONFIG?'disabled-by-profile':'not-verified'};
}
async function requireDisabledAiStatus(base,headers,fetcher=fetch,signal){
  signal?.throwIfAborted();
  const timeout=AbortSignal.timeout(10000);
  const response=await fetcher(base+'/api/sentence-feedback',{headers:{...headers,'X-Study-AI-Contract':'4'},signal:signal?AbortSignal.any([signal,timeout]):timeout});
  if(!response.ok||(await response.json()).enabled!==false)throw Error('Local QA Worker must confirm AI generation is disabled before tests run.');
}
function imagePracticeStage(env=process.env,requested){
  const enabled=env.QA_WORKER_CONFIG?JSON.parse(fs.readFileSync(env.QA_WORKER_CONFIG,'utf8')).vars?.word_image_pilot_enabled==='true':undefined;
  const stage=requested||(['enabled','development'].includes(env.QA_IMAGE_PILOT_MODE)?'all':enabled?'matrix':'production');
  if(enabled!==undefined&&enabled===(stage==='production'))throw Error('Image QA stage differs from the configured Worker profile: production requires images disabled; other stages require images enabled.');
  return stage;
}
module.exports={validateEnvironment,requireDisabledAiStatus,imagePracticeStage};
