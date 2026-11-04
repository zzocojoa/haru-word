import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalLearningDrafts,DRAFT_RETENTION_MS,DRAFT_MAX_COUNT,DRAFT_PREFIX,DRAFT_OWNER_KEY} from '../lib/local-learning-drafts.ts';
class MemoryStorage {
 data=new Map();failRead=false;failWrite=false;
 get length(){if(this.failRead)throw Error('synthetic unavailable');return this.data.size;}
 key(i){return [...this.data.keys()][i]??null;}
 getItem(k){if(this.failRead)throw Error('synthetic unavailable');return this.data.get(k)??null;}
 setItem(k,v){if(this.failWrite)throw Error('synthetic quota');this.data.set(k,String(v));}
 removeItem(k){if(this.failWrite)throw Error('synthetic unavailable');this.data.delete(k);}
}
const A='a1111111-1111-4111-8111-111111111111',B='b1111111-1111-4111-8111-111111111111';
const values=(sentence='Synthetic unsaved sentence.')=>({meaning:'합성 뜻',expression:'a sample',expressionTranslation:'합성 표현',example:'Synthetic.',translation:'합성',answer:'',sentence,notes:'',spoken:false,revealed:false,hint:false});
const payload=(sentence='Synthetic unsaved sentence.')=>({kind:'word',base:values('Saved sentence.'),values:values(sentence)});
const scope=(storage,owner='owner-a',instance=A,now=()=>1000)=>{const s=new LocalLearningDrafts(owner,instance,()=>storage,now);s.connect();return s;};

test('validated word drafts survive a fresh page instance, including explicit empty values and help flags',()=>{
 const storage=new MemoryStorage(),s=scope(storage),p=payload('');p.values.answer='작성 중 답';p.values.hint=true;
 assert.equal(s.write('question-a',p),true);const reopened=scope(storage,'owner-a',B);
 const [row]=reopened.list('question-a','word');assert.equal(row.record.values.sentence,'');assert.equal(row.record.values.answer,'작성 중 답');assert.equal(row.record.values.hint,true);
 assert.deepEqual(row.record.base,p.base);assert.equal(row.record.instanceId,A);
});

test('grammar drafts cannot smuggle first answers, grades, user keys or server state into recovery',()=>{
 const storage=new MemoryStorage(),s=scope(storage);
 assert.equal(s.write('grammar-a',{kind:'grammar',base:{sentence:'Saved.'},values:{sentence:'Edited.',checks:{meaning:'uncertain'}}}),true);
 const before=JSON.stringify([...storage.data]);
 for(const forbidden of [{answers:{q1:{first:'overwrite'}}},{completedAt:'2026-11-03T00:00:00Z'},{apiKey:'SYNTHETIC_FORBIDDEN'},{grade:100}]){
  assert.equal(s.write('grammar-a',{kind:'grammar',base:{sentence:'Saved.'},values:{sentence:'Edited.',...forbidden}}),false);
  assert.equal(JSON.stringify([...storage.data]),before);
 }
});

test('account switching removes previous-account rows, and stale tabs cannot read/write/delete the new account',()=>{
 const storage=new MemoryStorage();storage.setItem('unrelated-backup','preserve');
 const a=scope(storage);a.write('question-a',payload());const old=a.list()[0];
 const b=scope(storage,'owner-b',B);b.write('question-b',payload('Owner B input.'));a.refresh();
 assert.deepEqual(a.list(),[]);assert.equal(a.getSnapshot().active,false);assert.equal(a.write('question-a',payload('Late old input.')),false);
 assert.equal(a.remove(old.id),false);assert.equal(a.clear(),false);assert.equal(a.retry(),false);
 assert.equal(b.list()[0].record.values.sentence,'Owner B input.');assert.equal(storage.getItem('unrelated-backup'),'preserve');
 assert.equal(storage.getItem(DRAFT_OWNER_KEY),'owner-b');
});

test('same-question drafts from two tabs remain separate recovery choices',()=>{
 const storage=new MemoryStorage(),a=scope(storage),b=scope(storage,'owner-a',B);
 a.write('same-question',payload('Tab A input.'));b.write('same-question',payload('Tab B input.'));a.refresh();
 assert.equal(a.list('same-question').length,2);assert.deepEqual(a.list('same-question').map(r=>r.record.values.sentence).sort(),['Tab A input.','Tab B input.']);
});

test('page markers distinguish a closed source from a live/crashed tab without expiring another unsaved variant',()=>{
 const storage=new MemoryStorage(),a=scope(storage);a.write('q',payload());
 const b=scope(storage,'owner-a',B);assert.equal(b.isInstanceActive(A),true);
 a.release();assert.equal(b.isInstanceActive(A),false);assert.equal(b.list('q').length,1);
 a.activate();assert.equal(b.isInstanceActive(A),true);
 // No timer claims that an unresponsive tab is closed. Only explicit release,
 // normal expiry or deletion may remove its draft row.
 assert.equal(b.refresh(),true);assert.equal(b.isInstanceActive(A),true);
 const other=scope(storage,'owner-b',crypto.randomUUID());assert.equal(a.activate(),false);assert.equal(other.getSnapshot().active,true);
});

test('old acknowledgements cannot remove a later edit, even in the same tab and question',()=>{
 const storage=new MemoryStorage(),s=scope(storage);s.write('question-a',payload('Earlier edit.'));const old=s.list()[0];
 s.write('question-a',payload('Later edit.'));assert.equal(s.remove(old.id,old.record),false);
 const current=s.list()[0];assert.equal(current.record.values.sentence,'Later edit.');assert.equal(s.remove(current.id,current.record),true);assert.equal(s.list().length,0);
});

test('expired/corrupt owned records are removed while unrelated storage remains intact',()=>{
 let now=1000;const storage=new MemoryStorage(),s=scope(storage,'owner-a',A,()=>now);s.write('question-a',payload());
 storage.setItem(DRAFT_PREFIX+'owner-a:corrupt','{broken');storage.setItem('other-app','untouched');
 now+=DRAFT_RETENTION_MS+1;s.refresh();assert.equal(s.list().length,0);assert.equal(storage.getItem('other-app'),'untouched');
 assert.equal([...storage.data.keys()].filter(k=>k.startsWith(DRAFT_PREFIX)).length,0);
});

test('capacity does not evict any unsaved input, and deletion does not recreate unchanged drafts',()=>{
 const storage=new MemoryStorage(),s=scope(storage);
 for(let i=0;i<DRAFT_MAX_COUNT;i++)assert.equal(s.write('question-'+i,payload('Input '+i)),true);
 const before=JSON.stringify([...storage.data]);assert.equal(s.write('overflow',payload()),false);assert.equal(s.getSnapshot().error,'capacity');assert.equal(JSON.stringify([...storage.data]),before);
 assert.equal(s.clear(),true);assert.equal(s.list().length,0);assert.equal(s.write('question-0',payload('Input 0')),true);assert.equal(s.list().length,0);
 assert.equal(s.write('question-0',payload('New edit after deletion.')),true);assert.equal(s.list().length,1);
});

test('cross-tab deletion epochs suppress old rewrites but allow genuinely new edits',()=>{
 const storage=new MemoryStorage(),a=scope(storage),b=scope(storage,'owner-a',B);
 a.write('same',payload('A'));b.write('same',payload('B'));a.clear();
 assert.equal(b.write('same',payload('B')),true);assert.equal(b.list().length,0);
 assert.equal(b.write('same',payload('B after clearing')),true);assert.equal(b.list().length,1);
 a.refresh();assert.equal(a.list()[0].record.values.sentence,'B after clearing');
});

test('entry and total byte limits are independent of the row count',()=>{
 const storage=new MemoryStorage(),s=scope(storage),huge=payload();huge.base.answer='가'.repeat(10000);huge.values.answer=huge.base.answer;huge.base.sentence=huge.base.answer;huge.values.sentence=huge.base.answer;
 assert.equal(s.write('too-large',huge),false);assert.equal(s.getSnapshot().error,'capacity');assert.equal(s.list().length,0);
 const big=payload();big.base.answer='가'.repeat(9000);big.values.answer=big.base.answer;
 let written=0;for(;written<20;written++)if(!s.write('big-'+written,big))break;
 assert.ok(written>0&&written<20);assert.equal(s.list().length,written);assert.equal(s.getSnapshot().error,'capacity');
});

test('storage failure leaves input handling usable and explicit retry can restore storage',()=>{
 const storage=new MemoryStorage();storage.failRead=true;const s=scope(storage);
 assert.equal(s.getSnapshot().ready,true);assert.equal(s.getSnapshot().available,false);assert.equal(s.write('q',payload()),false);
 storage.failRead=false;assert.equal(s.retry(),true);assert.equal(s.write('q',payload()),true);const before=JSON.stringify([...storage.data]);
 storage.failWrite=true;assert.equal(s.write('q',payload('Cannot persist.')),false);assert.equal(JSON.stringify([...storage.data]),before);
 storage.failWrite=false;assert.equal(s.retry(),true);assert.equal(s.write('q',payload('Retry explicit.')),true);
});

test('logout purges owned drafts and prevents the old scope from recreating them',()=>{
 const storage=new MemoryStorage(),a=scope(storage),b=scope(storage,'owner-a',B);a.write('q',payload());b.refresh();
 assert.equal(a.clear(true),true);b.refresh();assert.equal(b.getSnapshot().active,false);assert.equal(b.write('q',payload()),false);
 assert.equal(storage.getItem(DRAFT_OWNER_KEY),null);assert.equal([...storage.data.keys()].filter(k=>k.startsWith(DRAFT_PREFIX)).length,0);
});
