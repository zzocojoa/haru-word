import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('OPS-1: the actual attribution generator preserves the shipped explicit OpenAI transmission policy',()=>{
 const root=mkdtempSync(join(tmpdir(),'haru-attribution-'));
 for(const dir of ['data','work'])mkdirSync(join(root,dir));
 for(const file of ['words.json','content.json','source-audit.json'])copyFileSync(join('data',file),join(root,'data',file));
 copyFileSync('public/sources/dictionary-credits.md',join(root,'work/dictionary-credits.md'));
 const result=spawnSync('python',[resolve('scripts/prepare-attribution.py')],{cwd:root,encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
 assert.equal(result.status,0,result.stderr);
 const policy=text=>text.slice(text.indexOf('5. 학습 결과')).trim();
 const generated=policy(readFileSync(join(root,'public/sources/content-attribution.txt'),'utf8'));
 assert.equal(generated,policy(readFileSync('public/sources/content-attribution.txt','utf8')));
 assert.match(generated,/OpenAI Responses API/);assert.doesNotMatch(generated,/먼저 사용|보내 자동 전환/);
});

test('DOCS-1: README recovery entry points at current switch and the structure document is explicitly historical',()=>{
 const readme=readFileSync('README.md','utf8'),history=readFileSync('AI_SENTENCE_STRUCTURE.md','utf8');
 assert.match(readme,/현재 AI 계약·장애 차단·복구 지침은 \[OpenAI 운영 절차\]\(docs\/OPENAI_FEEDBACK.md\)/);
 assert.match(history.slice(0,900),/설계 이력/);assert.match(history.slice(0,900),/ai_feedback_enabled=false/);
 assert.match(readFileSync('docs/OPENAI_FEEDBACK.md','utf8'),/ai_feedback_enabled=false/);
});
