'use client';
import {HaruHeading,HaruParagraph} from './haru-content';
import {HaruButton} from './haru-controls';

import {useState} from 'react';
import {HaruIcon} from '@/components/icons/haru-icon';
import {useLocalDrafts} from './local-draft-context';
import {useAiRequests} from './ai-request-context';
export function LocalDraftSettings({busy}:{busy:boolean}){
  const {store,state}=useLocalDrafts(),{pendingCount}=useAiRequests();
  const [confirm,setConfirm]=useState(false),[deleted,setDeleted]=useState(false);
  if(!store?.owner)return null;
  return <section className="settings-section" aria-label="이 기기의 임시 입력"><HaruHeading level={3}>이 기기의 임시 입력</HaruHeading>
    <HaruParagraph className="small-note">작성 중인 입력과 이전 AI 제안을 이 브라우저에 평문으로 최대 7일 보관해요. 계정별·기기별로 보관하고 만료하면 다음 접근 때 삭제해요.</HaruParagraph>
    <HaruParagraph className="small-note">보관 항목 {state.count}/20 · 총 1MiB 이내. 공용 기기에서는 임시 입력을 삭제하거나 아래 로그아웃을 이용해 주세요.</HaruParagraph>
    {state.error&&<HaruParagraph role="status">기기 보관 상태를 확인하지 못했어요. 화면의 입력을 먼저 백업해 주세요.</HaruParagraph>}
    <HaruButton label={["이 기기의 임시 입력 삭제"].join('')} variant="secondary" icon={<HaruIcon name="trash" size={18}/>} type="button" className="haru-migrated secondary-button" disabled={busy||pendingCount>0} onClick={()=>{setConfirm(true);setDeleted(false);}}>이 기기의 임시 입력 삭제</HaruButton>
    {confirm&&<div className="notice" role="group" aria-label="임시 입력 삭제 확인"><HaruParagraph>이 브라우저의 임시 입력과 AI 요청 확인 정보를 삭제해요.</HaruParagraph>
      <HaruParagraph>화면의 입력·서버 학습 기록·서버에 보관한 AI 결과는 유지돼요. 삭제 후 AI 버튼을 누르면 새 유료 요청이 될 수 있어요.</HaruParagraph>
      <HaruButton label={["기기 보관 항목 삭제"].join('')} variant="secondary" type="button" className="haru-migrated secondary-button" disabled={busy||pendingCount>0} onClick={()=>{if(store.clear()){setConfirm(false);setDeleted(true);}}}>기기 보관 항목 삭제</HaruButton>
      <HaruButton label={["취소"].join('')} variant="ghost" type="button" className="haru-migrated text-button" onClick={()=>setConfirm(false)}>취소</HaruButton></div>}
    {deleted&&<HaruParagraph role="status">기기 보관 항목을 삭제했어요. 다시 편집하는 입력부터 새로 임시 보관해요.</HaruParagraph>}
    <HaruParagraph><a className="local-draft-logout" href="/signout-with-chatgpt?return_to=%2F" data-local-draft-logout><HaruIcon name="log-out" size={18}/>임시 입력을 지우고 로그아웃</a></HaruParagraph>
  </section>;
}
