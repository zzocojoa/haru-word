import {sentenceFeedbackSchema,type SentenceFeedback} from './sentence-feedback.ts';
import {FeedbackIssueError,issueFromResponse} from './feedback-issue.ts';
import {receiptMetadataSchema,FEEDBACK_RECEIPT_TTL,type ReceiptRequest} from './feedback-receipt.ts';
import type {LocalLearningDrafts,DraftChoice,LocalDraft} from './local-learning-drafts.ts';
import {feedbackMatchesContext,feedbackOriginalMatches,type FeedbackContextRequest} from './feedback-context.ts';
type RequestRow=Extract<LocalDraft,{kind:'request'}>;
type Result={response:Response;data:unknown};
export type FeedbackRequestIo={send:(metadata:ReceiptRequest)=>Promise<Result>;lookup:(id:string)=>Promise<Result>};
export const feedbackRequestKey=(domain:'word'|'grammar',targetKey:string)=>JSON.stringify(['feedback-request',domain,targetKey]);
export type CurrentFeedbackContext={sentence:string;modelId:string;fingerprint?:string};
export function recoveredFeedback(store:LocalLearningDrafts|null,domain:'word'|'grammar',targetKey:string,current?:CurrentFeedbackContext):SentenceFeedback|undefined {
  const values=store?.list(feedbackRequestKey(domain,targetKey),'request').map(row=>row.record.kind==='request'?row.record.values.feedback:undefined)??[];
  return current?currentFeedback(values,current.sentence,current.modelId,current.fingerprint):latestFeedback(...values);
}
export function latestFeedback(...values:(SentenceFeedback|undefined)[]):SentenceFeedback|undefined {
  return values.filter((f):f is SentenceFeedback=>!!f).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
}
export function currentFeedback(values:(SentenceFeedback|undefined)[],sentence:string,modelId:string,fingerprint?:string){
  const matching=values.filter((f):f is SentenceFeedback=>!!f&&feedbackMatchesContext(f,sentence,modelId,fingerprint));
  return latestFeedback(...(matching.length?matching:values));
}

// Called by an explicit button only. An outstanding UUID is looked up first;
// this same click never replaces an unknown/expired/failed attempt with a new one.
export async function runRecoverableFeedback(store:LocalLearningDrafts|null,input:{domain:'word'|'grammar';targetKey:string;sentence:string;expectedModelId:string}&FeedbackContextRequest,io:FeedbackRequestIo,signal:AbortSignal,now=Date.now()){
  if(!store?.owner||!store.refresh()||!store.getSnapshot().active)throw new FeedbackIssueError({code:'draft_unavailable'});
  const question=feedbackRequestKey(input.domain,input.targetKey),cleared=store.getSnapshot().cleared;
  const previous=store.list(question,'request').filter((row):row is DraftChoice&{record:RequestRow}=>row.record.kind==='request'&&row.record.values.state==='pending').sort((a,b)=>a.record.values.startedAt-b.record.values.startedAt)[0];
  // The fingerprint already binds kind. Keep durable rows readable by older
  // clients, which strictly parse request values and must not delete new UUIDs.
  const {contextKind:_kind,...durableInput}=input;void _kind;
  const values:RequestRow['values']=previous?previous.record.values:{...durableInput,requestId:crypto.randomUUID(),startedAt:now,state:'pending'};
  const current=()=>!signal.aborted&&store.getSnapshot().active&&store.getSnapshot().cleared===cleared;
  const write=(next:RequestRow['values'])=>{
    if(!current())throw new DOMException('Request cancelled','AbortError');
    const stored=store.write(question,{kind:'request',values:next});
    if(stored&&previous&&previous.record.instanceId!==store.instanceId)store.remove(previous.id,previous.record);
    return stored;
  };
  if(!previous&&(!write(values)||!store.list(question,'request').some(row=>row.record.kind==='request'&&row.record.values.requestId===values.requestId)))throw new FeedbackIssueError({code:'draft_unavailable'});
  if(previous&&now-values.startedAt>=FEEDBACK_RECEIPT_TTL){write({...values,state:'failed'});throw new FeedbackIssueError({code:'receipt_expired'});}
  const result=previous?await io.lookup(values.requestId):await io.send({requestId:values.requestId,requestStartedAt:values.startedAt});
  if(!current())throw new DOMException('Request cancelled','AbortError');
  const body=(result.data&&typeof result.data==='object'?result.data:{}) as Record<string,unknown>;
  const metadata=receiptMetadataSchema.safeParse(body.receipt);
  if(metadata.success&&metadata.data.requestId!==values.requestId)throw new FeedbackIssueError({code:'invalid_response'});
  if(metadata.success&&metadata.data.state==='pending')throw new FeedbackIssueError({code:'receipt_pending'});
  if(result.response.ok&&(!metadata.success||metadata.data.state!=='completed'))throw new FeedbackIssueError({code:'invalid_response'});
  if(!result.response.ok||!metadata.success||metadata.data.state!=='completed'){
    // Known terminal errors or a missing receipt after a lookup acknowledge
    // this attempt. A network error/ambiguous POST keeps the pending UUID.
    if(previous||metadata.success&&metadata.data.state!=='unknown'||result.response.status>=400&&result.response.status<500)write({...values,state:'failed'});
    throw new FeedbackIssueError(issueFromResponse(body,result.response.status));
  }
  const parsed=sentenceFeedbackSchema.safeParse(body.feedback);
  if(!parsed.success||parsed.data.provider!=='openai'||parsed.data.requestedModel!==values.expectedModelId||!feedbackOriginalMatches(parsed.data.original,values.sentence)
    ||values.expectedContextFingerprint&&parsed.data.contextFingerprint!==values.expectedContextFingerprint)throw new FeedbackIssueError({code:'invalid_response'});
  write({...values,state:'recovered',feedback:parsed.data});
  return {feedback:parsed.data,recovered:!!previous};
}
