import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/db/store";
import { EMPTY } from "@/lib/learning";
import { saveSchema } from "@/lib/validation";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store","Content-Type":"application/json"};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers});}
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:"로그인이 필요합니다."},401);
 try{
  const db=database();await db.prepare("INSERT OR IGNORE INTO learner_states (user_id,revision,settings,updated_at) VALUES (?,0,?,?)").bind(user.userId,JSON.stringify(EMPTY.settings),new Date().toISOString()).run();
  const rows=await db.batch([
   db.prepare("SELECT revision,settings FROM learner_states WHERE user_id=?").bind(user.userId),
   db.prepare("SELECT entry_id,document FROM word_progress WHERE user_id=?").bind(user.userId),
   db.prepare("SELECT session_id,document FROM study_sessions WHERE user_id=?").bind(user.userId),
  ]);
  const profile=rows[0].results[0] as {revision:number;settings:string};
  return json({revision:profile.revision,state:{settings:JSON.parse(profile.settings),progress:Object.fromEntries((rows[1].results as {entry_id:string;document:string}[]).map(r=>[r.entry_id,JSON.parse(r.document as string)])),sessions:Object.fromEntries((rows[2].results as {session_id:string;document:string}[]).map(r=>[r.session_id,JSON.parse(r.document as string)]))}});
 }catch{console.error(JSON.stringify({event:"learning_state_load_failed"}));return json({error:"기록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요."},503);}
}
export async function PUT(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"로그인이 필요합니다."},401);
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return json({error:"요청 출처를 확인할 수 없습니다."},403);
 if(!request.headers.get("content-type")?.startsWith("application/json"))return json({error:"JSON 요청만 지원합니다."},415);
 let body:unknown;
 try{const raw=await request.text();if(raw.length>1_800_000)return json({error:"기록이 너무 큽니다. 회차를 나눠 주세요."},413);body=JSON.parse(raw);}catch{return json({error:"요청 형식이 잘못되었습니다."},400);}
 const parsed=saveSchema.safeParse(body);if(!parsed.success)return json({error:"저장할 기록의 형식을 확인해 주세요."},400);
 const data=parsed.data;
 try{
  const db=database(); const statements:D1PreparedStatement[]=[];
  // All mutations are conditional on the same revision; D1 batch is transactional.
  // Updating the revision LAST ensures either every delta applies or none do.
  for(const [id,p] of Object.entries(data.progress))statements.push(db.prepare("INSERT INTO word_progress(user_id,entry_id,document) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND revision=?) ON CONFLICT(user_id,entry_id) DO UPDATE SET document=excluded.document").bind(user.userId,id,JSON.stringify(p),user.userId,data.revision));
  for(const [id,s] of Object.entries(data.sessions))statements.push(db.prepare("INSERT INTO study_sessions(user_id,session_id,document) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND revision=?) ON CONFLICT(user_id,session_id) DO UPDATE SET document=excluded.document").bind(user.userId,id,JSON.stringify(s),user.userId,data.revision));
  statements.push(data.settings?db.prepare("UPDATE learner_states SET revision=revision+1,settings=?,updated_at=? WHERE user_id=? AND revision=?").bind(JSON.stringify(data.settings),new Date().toISOString(),user.userId,data.revision):db.prepare("UPDATE learner_states SET revision=revision+1,updated_at=? WHERE user_id=? AND revision=?").bind(new Date().toISOString(),user.userId,data.revision));
  const results=await db.batch(statements); if(results[results.length-1].meta.changes!==1)return json({error:"다른 기기에서 기록이 바뀌었습니다. 현재 입력을 백업한 뒤 최신 기록을 불러와 주세요.",conflict:true},409);
  return json({revision:data.revision+1});
 }catch{console.error(JSON.stringify({event:"learning_state_save_failed",wordCount:Object.keys(data.progress).length,sessionCount:Object.keys(data.sessions).length}));return json({error:"저장하지 못했습니다. 입력은 화면에 남아 있습니다. 다시 저장해 주세요."},503);}
}
