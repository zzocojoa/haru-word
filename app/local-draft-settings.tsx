'use client';
import {useState} from 'react';
import {useLocalDrafts} from './local-draft-context';
import {useAiRequests} from './ai-request-context';
export function LocalDraftSettings({busy}:{busy:boolean}){
  const {store,state}=useLocalDrafts(),{pendingCount}=useAiRequests();
  const [confirm,setConfirm]=useState(false),[deleted,setDeleted]=useState(false);
  if(!store?.owner)return null;
  return <section className="settings-section" aria-label="이 기기의 임시 입력"><h3>이 기기의 임시 입력</h3>
    <p className="small-note">작성 중 문장·답·이전 AI 제안을 이 브라우저에 평문으로 최대 7일 임시 보관해요. 계정별로 분리하고 이 기기의 임시 보관은 다른 기기로 동기화하지 않아요. 만료한 내용은 다음 접근 때 삭제해요.</p>
    <p className="small-note">보관 항목 {state.count}/20 · 총 1MiB 이내. 공용 기기에서는 임시 입력을 삭제하거나 아래 로그아웃을 이용해 주세요.</p>
    {state.error&&<p role="status">기기 보관 상태를 확인하지 못했어요. 화면의 입력을 먼저 백업해 주세요.</p>}
    <button type="button" className="secondary-button" disabled={busy||pendingCount>0} onClick={()=>{setConfirm(true);setDeleted(false);}}>이 기기의 임시 입력 삭제</button>
    {confirm&&<div className="notice" role="group" aria-label="임시 입력 삭제 확인"><p>이 브라우저의 임시 입력과 요청 확인 정보를 삭제할까요? 화면의 입력·서버 학습 기록·서버의 AI 결과 복구 보관은 유지해요. 결과 확인 정보를 지운 뒤 AI 버튼을 누르면 새 유료 요청이 될 수 있어요.</p>
      <button type="button" className="secondary-button" disabled={busy||pendingCount>0} onClick={()=>{if(store.clear()){setConfirm(false);setDeleted(true);}}}>기기 보관 항목 삭제</button>
      <button type="button" className="text-button" onClick={()=>setConfirm(false)}>취소</button></div>}
    {deleted&&<p role="status">기기 보관 항목을 삭제했어요. 다시 편집하는 입력부터 새로 임시 보관해요.</p>}
    <p><a className="local-draft-logout" href="/signout-with-chatgpt?return_to=%2F" data-local-draft-logout>임시 입력을 지우고 로그아웃</a></p>
  </section>;
}
