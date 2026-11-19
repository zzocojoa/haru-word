import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {AI_PROMPT_VERSION,AI_VALIDATION_VERSION} from '../lib/ai-models.ts';
const {currentOpenaiFeedback,openaiFeedback}=createRequire(import.meta.url)('./qa/openai-fixture.cjs');
test('current synthetic replies match the product policy while historical fixture metadata stays historical',()=>{
 const input={expectedContextFingerprint:'a'.repeat(64),contextNote:'합성 한국어 의도'};
 const route={request:()=>({postDataJSON:()=>input})};
 const result=currentOpenaiFeedback(route,{original:'A sample.',correctedSentence:'A sample.'});
 assert.equal(result.promptVersion,AI_PROMPT_VERSION);assert.equal(result.validationVersion,AI_VALIDATION_VERSION);
 assert.equal(result.contextFingerprint,input.expectedContextFingerprint);assert.equal(result.contextNote,input.contextNote);
 assert.equal(openaiFeedback({}).validationVersion,'structured-v1');
 assert.throws(()=>currentOpenaiFeedback({request:()=>({postDataJSON:()=>({})})},{}),/fingerprint/);
});
