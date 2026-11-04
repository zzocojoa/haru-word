'use client';
import {useMemo} from 'react';
import {useLocalDrafts} from './local-draft-context';
import {runRecoverableFeedback,recoveredFeedback,feedbackRequestKey,type FeedbackRequestIo,type CurrentFeedbackContext} from '@/lib/recoverable-feedback';
import {requestJson,REQUEST_TIMEOUT_MS} from '@/lib/client-request';
import {AI_CONTRACT_HEADERS} from '@/lib/ai-contract';
import {FEEDBACK_STRUCTURE_HEADERS} from '@/lib/feedback-compatibility';
import type {FeedbackContextRequest} from '@/lib/feedback-context';
export function useFeedbackRecovery(domain:'word'|'grammar',targetKey:string,current?:CurrentFeedbackContext){
  const {store,state}=useLocalDrafts();
  const retainedFeedback=useMemo(()=>state.available&&state.active?recoveredFeedback(store,domain,targetKey,current):undefined,[store,state,domain,targetKey,current]);
  const hasPending=!!store?.list(feedbackRequestKey(domain,targetKey),'request').some(row=>row.record.kind==='request'&&row.record.values.state==='pending');
  return {retainedFeedback,hasPending,
    run:(sentence:string,expectedModelId:string,send:FeedbackRequestIo['send'],signal:AbortSignal,context:FeedbackContextRequest={})=>runRecoverableFeedback(store,{domain,targetKey,sentence,expectedModelId,...context},{send,
      lookup:id=>requestJson('/api/feedback-requests/'+encodeURIComponent(id),{cache:'no-store',headers:{...AI_CONTRACT_HEADERS,...FEEDBACK_STRUCTURE_HEADERS},signal},REQUEST_TIMEOUT_MS.load)},signal)};
}
