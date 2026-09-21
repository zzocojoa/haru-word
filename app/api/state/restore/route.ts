import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { MAX_BACKUP_BYTES,parseBackup,restoreChunks } from '@/lib/backup';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});

export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'로그인이 필요합니다.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'요청 출처를 확인할 수 없습니다.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON 요청만 지원합니다.'},415);
 const revision=Number(request.headers.get('x-study-revision'));if(!request.headers.has('x-study-revision')||!Number.isSafeInteger(revision)||revision<0)return json({error:'현재 기록을 다시 불러와 주세요.'},400);
 let raw='';const reader=request.body?.getReader();if(!reader)return json({error:'백업 파일이 비어 있어요.'},400);
 try{
  let length=0;const decoder=new TextDecoder('utf-8',{fatal:true});
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BACKUP_BYTES){await reader.cancel();return json({error:'백업 파일은 8 MB까지 복원할 수 있어요.'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
 }catch{return json({error:'백업 파일을 읽지 못했어요.'},400);}
 let state;try{state=parseBackup(raw).state;}catch(e){return json({error:e instanceof Error?e.message:'백업 파일을 확인해 주세요.'},400);}
 const started=Date.now();
 try{
  const db=database();
  // Every statement observes the same revision in ONE atomic D1 transaction.
  // The revision is advanced last: conflicts change no rows, failures roll back deletions.
  const condition='EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND revision=?)';
  const statements=[
   db.prepare(`DELETE FROM word_progress WHERE user_id=? AND ${condition}`).bind(user.userId,user.userId,revision),
   db.prepare(`DELETE FROM study_sessions WHERE user_id=? AND ${condition}`).bind(user.userId,user.userId,revision),
  ];
  for(const chunk of restoreChunks(state.progress))statements.push(db.prepare(`INSERT INTO word_progress(user_id,entry_id,document) SELECT ?,entry.key,entry.value FROM json_each(?) AS entry WHERE ${condition}`).bind(user.userId,chunk,user.userId,revision));
  for(const chunk of restoreChunks(state.sessions))statements.push(db.prepare(`INSERT INTO study_sessions(user_id,session_id,document) SELECT ?,entry.key,entry.value FROM json_each(?) AS entry WHERE ${condition}`).bind(user.userId,chunk,user.userId,revision));
  statements.push(db.prepare('UPDATE learner_states SET settings=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?').bind(JSON.stringify(state.settings),new Date().toISOString(),user.userId,revision));
  const results=await db.batch(statements);if(results.at(-1)?.meta.changes!==1)return json({error:'다른 기기에서 기록이 바뀌었어요. 최신 기록을 확인하고 다시 복원해 주세요.',conflict:true},409);
  console.info(JSON.stringify({event:'learning_backup_restored',words:Object.keys(state.progress).length,sessions:Object.keys(state.sessions).length,durationMs:Date.now()-started}));
  return json({revision:revision+1});
 }catch{console.error(JSON.stringify({event:'learning_backup_restore_failed',durationMs:Date.now()-started}));return json({error:'복원을 완료하지 못했어요. 서버 기록을 확인한 뒤 다시 시도해 주세요.'},503);}
}
