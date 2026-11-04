import {FEEDBACK_RESPONSE_TTL,FEEDBACK_RECEIPT_TTL,FEEDBACK_PENDING_WINDOW,type ReceiptRequest,type FeedbackReceipt} from '@/lib/feedback-receipt';
import {feedbackErrorBody} from '@/lib/feedback-issue';
import {FeedbackError} from '@/lib/provider-feedback-error';
import {json} from '@/lib/server/http';

type Row={request_id:string;fingerprint:string;status:'pending'|'completed'|'failed'|'invalidated';started_at:number;expires_at:number;response_expires_at:number;response_status:number|null;response:string|null};
const lookup=(db:D1Database,user:string,id:string)=>db.prepare('SELECT * FROM feedback_requests WHERE user_id=? AND request_id=?').bind(user,id).first<Row>();
const receipt=(requestId:string,state:FeedbackReceipt['state'],persisted=true):FeedbackReceipt=>({requestId,state,persisted});
async function cleanup(db:D1Database,user:string,now:number){
  await db.batch([
    db.prepare('UPDATE feedback_requests SET response=NULL WHERE user_id=? AND response_expires_at<=? AND response IS NOT NULL').bind(user,now),
    db.prepare('DELETE FROM feedback_requests WHERE user_id=? AND expires_at<=?').bind(user,now),
  ]);
}
function existingResponse(row:Row,now:number):Response {
  const meta=(state:FeedbackReceipt['state'])=>receipt(row.request_id,state);
  if(row.expires_at<=now||row.status!=='pending'&&row.status!=='invalidated'&&row.response_expires_at<=now)return json({...feedbackErrorBody('receipt_expired'),receipt:meta('expired')},410);
  if(row.status==='invalidated')return json({...feedbackErrorBody('receipt_invalidated'),receipt:meta('invalidated')},409);
  if(row.status==='pending'){
    const pending=now-row.started_at<FEEDBACK_PENDING_WINDOW;
    return json({...feedbackErrorBody(pending?'receipt_pending':'receipt_unknown'),receipt:meta(pending?'pending':'unknown')},pending?202:409);
  }
  if(!row.response||!row.response_status)return json({...feedbackErrorBody('receipt_unknown'),receipt:meta('unknown')},409);
  return json({...JSON.parse(row.response),receipt:meta(row.status)},row.response_status);
}
export async function getFeedbackRequest(db:D1Database,user:string,id:string,now=Date.now()){
  const row=await lookup(db,user,id);
  await cleanup(db,user,now);
  return row?existingResponse(row,now):json({...feedbackErrorBody('receipt_unknown'),receipt:receipt(id,'unknown')},404);
}

// An atomic owner+UUID claim is durable BEFORE the one provider attempt. No
// automatic retries, leases or takeovers: an unknown attempt is never rerun.
export async function withFeedbackRequest(db:D1Database,user:string,input:ReceiptRequest,scope:{domain:'word'|'grammar';targetId:string;fingerprint:unknown;revision?:number},run:()=>Promise<Response>,now=Date.now()):Promise<Response>{
  if(!input.requestId)return run(); // Headerless v142 clients retain their contract.
  const id=input.requestId,started=input.requestStartedAt;
  if(started===undefined||started>now+60_000)return json(feedbackErrorBody('invalid_request'),400);
  if(now-started>=FEEDBACK_RECEIPT_TTL)return json({...feedbackErrorBody('receipt_expired'),receipt:receipt(id,'expired',false)},410);
  const data=new TextEncoder().encode(JSON.stringify([scope.domain,scope.targetId,started,scope.fingerprint]));
  const digest=await crypto.subtle.digest('SHA-256',data),fingerprint=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  await cleanup(db,user,now);
  const claimed=await db.prepare("INSERT INTO feedback_requests(user_id,request_id,fingerprint,domain,target_id,status,started_at,expires_at,response_expires_at) SELECT ?,?,?,?,?,'pending',?,?,? WHERE EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND (? IS NULL OR revision=?)) ON CONFLICT(user_id,request_id) DO NOTHING RETURNING request_id")
    .bind(user,id,fingerprint,scope.domain,scope.targetId,now,started+FEEDBACK_RECEIPT_TTL,now+FEEDBACK_RESPONSE_TTL,user,scope.revision??null,scope.revision??null).first<{request_id:string}>();
  if(!claimed){
    const previous=await lookup(db,user,id);
    if(!previous)return json({...feedbackErrorBody('stale_input'),receipt:receipt(id,'unknown',false)},409);
    if(previous.fingerprint!==fingerprint)return json(feedbackErrorBody('receipt_conflict'),409);
    return existingResponse(previous,now);
  }
  let response:Response;
  try {response=await run();}
  catch(error){
    const known=error instanceof FeedbackError;
    console.error(JSON.stringify({event:'feedback_request_failed',code:known?error.code:'storage_or_internal',...(known&&error.validationStage?{validationStage:error.validationStage}:{}),...(known&&error.judgmentReason?{judgmentReason:error.judgmentReason}:{})}));
    response=json(known?feedbackErrorBody(error.code,error.issue):feedbackErrorBody('site_error'),known?error.status:503);
  }
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('invalid_internal_receipt_body');
  const body=raw as Record<string,unknown>,status=response.ok?'completed':'failed';
  let persisted=false;
  try {
    const serialized=JSON.stringify(body);
    if(new TextEncoder().encode(serialized).byteLength>64*1024)throw Error('receipt_size');
    const saved=await db.prepare("UPDATE feedback_requests SET status=?,response_status=?,response=? WHERE user_id=? AND request_id=? AND status='pending'")
      .bind(status,response.status,serialized,user,id).run();
    if(saved.meta.changes!==1)return json({...feedbackErrorBody('receipt_invalidated'),receipt:receipt(id,'invalidated')},409);
    persisted=true;
  }catch{console.warn(JSON.stringify({event:'feedback_receipt_write_failed',code:'storage_unavailable'}));}
  // A returned result is usable even if caching it failed; callers retain the
  // UUID and the result locally. Never imply durable server recovery here.
  return json({...body,receipt:receipt(id,status,persisted)},response.status);
}
