import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { WORD_MAP } from '@/lib/catalog';
import { currentId,today,type Session,type Progress } from '@/lib/learning';
import { FEEDBACK_DAILY_LIMIT,FEEDBACK_MODEL,feedbackRequestSchema } from '@/lib/sentence-feedback';
import { FeedbackError,FEEDBACK_QUOTA_SQL,generateSentenceFeedback } from '@/lib/gemini-feedback';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Content-Type':'application/json'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const enabled=()=>!!env.google_api?.trim()&&env.google_ai_enabled==='true';

export async function GET(){
  if(!await getChatGPTUser())return json({error:'로그인이 필요합니다.'},401);
  return json({available:enabled(),configured:!!env.google_api?.trim(),model:FEEDBACK_MODEL,dailyLimit:FEEDBACK_DAILY_LIMIT});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return json({error:'로그인이 필요합니다.'},401);
  const origin=request.headers.get('origin');
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'요청 출처를 확인할 수 없습니다.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON 요청만 지원합니다.'},415);
  let raw:unknown;
  try{const text=await request.text();if(text.length>12000)return json({error:'문장이 너무 깁니다.'},413);raw=JSON.parse(text)}catch{return json({error:'요청 형식이 잘못되었습니다.'},400)}
  const parsed=feedbackRequestSchema.safeParse(raw);if(!parsed.success)return json({error:'문장을 2,000자 이내로 입력해 주세요.'},400);
  if(!enabled())return json({error:'AI 교정이 아직 활성화되지 않았어요. 지금은 자기 점검으로 이어가세요.'},503);
  const {sessionId,entryId,sentence}=parsed.data;
  try{
    const db=database();
    const row=await db.prepare('SELECT document FROM study_sessions WHERE user_id=? AND session_id=?').bind(user.userId,sessionId).first<{document:string}>();
    if(!row)return json({error:'학습 회차를 찾지 못했습니다.'},404);
    const session=JSON.parse(row.document) as Session;
    if(session.finished||session.stage!=='sentence'||currentId(session)!==entryId)return json({error:'현재 문장 연습에서만 교정할 수 있어요.'},409);
    let word=WORD_MAP.get(entryId);
    if(!word){const p=await db.prepare('SELECT document FROM word_progress WHERE user_id=? AND entry_id=?').bind(user.userId,entryId).first<{document:string}>();word=p?(JSON.parse(p.document) as Progress).personal:undefined;}
    const meaning=session.records[entryId]?.meaning;
    if(!word||!meaning)return json({error:'단어와 오늘의 뜻을 먼저 저장해 주세요.'},400);
    const now=Date.now();
    const quota=await db.prepare(FEEDBACK_QUOTA_SQL).bind(user.userId,today(),now,FEEDBACK_DAILY_LIMIT,now-10000).first<{request_count:number}>();
    if(!quota)return json({error:`잠시 뒤 다시 시도하거나 자기 점검으로 계속하세요. AI 교정은 10초 간격, 하루 ${FEEDBACK_DAILY_LIMIT}회까지 요청할 수 있어요.`},429);
    const feedback=await generateSentenceFeedback(env.google_api!,{word:word.word,pos:word.pos,meaning,sentence});
    console.info(JSON.stringify({event:'sentence_feedback_succeeded',model:FEEDBACK_MODEL}));
    return json({feedback,remaining:FEEDBACK_DAILY_LIMIT-quota.request_count});
  }catch(error){
    const known=error instanceof FeedbackError;
    console.error(JSON.stringify({event:'sentence_feedback_failed',code:known?error.code:'storage_or_internal'}));
    return json({error:known?error.message:'교정을 준비하지 못했어요. 자기 점검으로 계속할 수 있어요.'},known?error.status:503);
  }
}
