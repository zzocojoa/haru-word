import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { wordFeedbackInput, feedbackContextFingerprint, feedbackMatchesContext } from '../lib/feedback-context.ts';
import { AI_PROMPT_VERSION, AI_VALIDATION_VERSION } from '../lib/ai-models.ts';

mkdirSync('work/korean-intent-tests', { recursive: true });
await build({stdin:{contents:"export {SentenceFeedbackPanel} from './app/sentence-feedback';export {createElement} from 'react';export {renderToStaticMarkup} from 'react-dom/server';",resolveDir:process.cwd(),loader:'tsx'},outfile:'work/korean-intent-tests/runtime.mjs',bundle:true,format:'esm',platform:'node',external:['react','react-dom','react/jsx-runtime','lucide-react'],jsx:'automatic',logLevel:'silent'});
const {SentenceFeedbackPanel,createElement:h,renderToStaticMarkup}=await import(pathToFileURL(process.cwd()+'/work/korean-intent-tests/runtime.mjs'));

test('the Korean intention is visible and required before the English answer and explicit AI button', () => {
 const html=renderToStaticMarkup(h(SentenceFeedbackPanel,{sessionId:'synthetic',entryId:'over',target:{word:'over',pos:'prep.',meaning:'위로',expression:'over'},sentence:'A person walk over the water.',busy:false,onPending:()=>{},onFeedback:async()=>true,onUse:()=>{}},
   h('label',null,'내 영어 문장',h('textarea',{id:'my-sentence',defaultValue:'A person walk over the water.'}))));
 assert.ok(html.includes('의도한 한국어 문장'));
 assert.ok(html.indexOf('의도한 한국어 문장')<html.indexOf('내 영어 문장'));
 assert.ok(html.indexOf('내 영어 문장')<html.indexOf('AI 참고 의견 요청'));
 assert.match(html, /<textarea[^>]*required=""/);
 assert.match(html, /<button[^>]*disabled=""[^>]*>AI 참고 의견 요청/);
});

test('Korean intent is bounded input data and changing it changes result freshness', async () => {
 const sentence='A person walk over the water.',model='gpt-6.1-sol';
 const a=wordFeedbackInput({word:'over',pos:'prep.'},'위로',sentence,'사람이 물 위에 걸어가고 있어.');
 const b={...a,contextNote:'사람이 물 위를 걸어갔어.'};
 assert.equal(a.contextNote,'사람이 물 위에 걸어가고 있어.');
 const first=await feedbackContextFingerprint('word','synthetic-over',a,model),second=await feedbackContextFingerprint('word','synthetic-over',b,model);
 assert.notEqual(first,second);
 const feedback={original:sentence,model,promptVersion:AI_PROMPT_VERSION,validationVersion:AI_VALIDATION_VERSION,contextFingerprint:first};
 assert.equal(feedbackMatchesContext(feedback,sentence,model,first),true);
 assert.equal(feedbackMatchesContext(feedback,sentence,model,second),false);
});
