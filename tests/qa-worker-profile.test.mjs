import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const {profileConfig}=createRequire(import.meta.url)('./qa/worker-profile.cjs');
test('version QA Workers isolate new grammar generation without inheriting live credentials or bindings',()=>{
  const built={main:'index.js',assets:{directory:'../client'},vars:{OPENAI_API_KEY:'live-must-not-copy',ai_feedback_enabled:'true'},d1_databases:[{database_id:'live-must-not-copy'}],r2_buckets:[{bucket_name:'live-must-not-copy'}]};
  for(const version of [2,3,4]){
    const profile=profileConfig(built,version);
    assert.equal(profile.vars.grammar_practice_v4_enabled,String(version>=4));assert.equal(profile.vars.grammar_practice_v3_enabled,String(version>=3));
    assert.equal(profile.vars.ai_feedback_enabled,'false');assert.equal(profile.vars.OPENAI_API_KEY,'synthetic-disabled');
    assert.equal(profile.vars.astryx_foundation_enabled,'false');
    assert.ok(!JSON.stringify(profile).includes('live-must-not-copy'));
  }
  assert.throws(()=>profileConfig(built,1),/Unsupported/);
  assert.equal(profileConfig(built,4,{imagePracticeEnabled:false}).vars.word_image_pilot_enabled,'false');
  assert.equal(profileConfig(built,4).vars.word_image_pilot_enabled,'true');
  assert.throws(()=>profileConfig(built,4,{imagePracticeEnabled:'false'}),/boolean/);
  assert.equal(profileConfig(built,4,{astryxFoundationEnabled:true}).vars.astryx_foundation_enabled,'true');
  assert.throws(()=>profileConfig(built,4,{astryxFoundationEnabled:'true'}),/boolean/);
});

test('archived builds serve matching Worker and assets with synthetic credentials',()=>{
  const serverRoot=path.resolve('outputs/archived-build/server');
  const built={main:'index.js',assets:{directory:'../client'},vars:{OPENAI_API_KEY:'not-a-qa-credential'}};
  const profile=profileConfig(built,2,{serverRoot});
  assert.equal(profile.main,path.join(serverRoot,'index.js'));
  assert.equal(profile.assets.directory,path.resolve(serverRoot,'../client'));
  assert.equal(profile.vars.ai_feedback_enabled,'false');
  assert.equal(profile.vars.OPENAI_API_KEY,'synthetic-disabled');
  assert.throws(()=>profileConfig(built,2,{serverRoot:'relative/server'}),/absolute/);
});
