import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {profileConfig}=createRequire(import.meta.url)('./qa/worker-profile.cjs');
test('version QA Workers isolate new grammar generation without inheriting live credentials or bindings',()=>{
  const built={main:'index.js',assets:{directory:'../client'},vars:{OPENAI_API_KEY:'live-must-not-copy',ai_feedback_enabled:'true'},d1_databases:[{database_id:'live-must-not-copy'}],r2_buckets:[{bucket_name:'live-must-not-copy'}]};
  for(const version of [2,3,4]){
    const profile=profileConfig(built,version);
    assert.equal(profile.vars.grammar_practice_v4_enabled,String(version>=4));assert.equal(profile.vars.grammar_practice_v3_enabled,String(version>=3));
    assert.equal(profile.vars.ai_feedback_enabled,'false');assert.equal(profile.vars.OPENAI_API_KEY,'synthetic-disabled');
    assert.ok(!JSON.stringify(profile).includes('live-must-not-copy'));
  }
  assert.throws(()=>profileConfig(built,1),/Unsupported/);
});
