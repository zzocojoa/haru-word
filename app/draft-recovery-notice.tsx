'use client';
import {useState} from 'react';
import {draftFingerprint,type DraftChoice} from '@/lib/local-learning-drafts';
import type {InputRecovery} from './use-persistent-input';
import {RecordText} from './record-text';
const LABELS:Record<string,string>={meaning:'뜻',expression:'표현',expressionTranslation:'표현의 뜻',example:'예문',translation:'해석',answer:'작성 중 답',sentence:'내 문장',notes:'보완할 점',spoken:'말하기 표시',revealed:'답 공개 표시',hint:'도움 표시',frame:'문장 틀',check:'자기 점검',checks:'뜻·형태 자기 점검'};
const display=(value:unknown)=>typeof value==='string'?value:typeof value==='boolean'?(value?'표시함':'표시 안 함'):JSON.stringify(value??'');
export function DraftRecoveryNotice({input,labels={},format}:{input:InputRecovery;labels?:Record<string,string>;format?:(key:string,value:unknown)=>string|undefined}){
  const {recovery,storage}=input;
  const [comparison,setComparison]=useState<{row:DraftChoice;current:string;candidate:string}|null>(null);
  const selected=comparison&&recovery.choices.find(row=>row.id===comparison.row.id);
  const valid=!!comparison&&!!selected&&draftFingerprint(recovery.current)===comparison.current&&draftFingerprint(selected.record)===comparison.candidate;
  function compare(row:DraftChoice){setComparison({row,current:draftFingerprint(recovery.current),candidate:draftFingerprint(row.record)});}
  if(!storage.enabled)return null;
  return <div className="local-draft-notice">
    <p className="small-note">작성 중 입력은 이 브라우저에 최대 7일간 임시 보관해요. 공용 기기에서는 학습 설정의 임시 입력 삭제·로그아웃을 이용해 주세요.</p>
    {storage.error&&<div className="notice" role="status"><p>{storage.error==='capacity'?'이 기기의 임시 보관 공간이 가득 찼어요. 현재 입력을 백업한 뒤 임시 입력을 정리해 주세요.':'이 기기에 임시 입력을 보관하지 못했어요. 화면의 입력을 백업해 주세요.'}</p><button type="button" className="text-button" onClick={storage.retry}>기기 보관 다시 확인</button></div>}
    {recovery.restored&&<div className="notice" role="status"><p>이 기기에 남은 입력·이전 AI 의견을 복구했어요. 복구만으로 채점하거나 AI를 요청하지 않아요.</p>{recovery.hasUndo&&<button type="button" className="text-button" disabled={!recovery.canUndo} onClick={recovery.undo}>복구한 입력 되돌리기</button>}</div>}
    {recovery.choices.length>0&&<details><summary>이 기기에 남은 다른 입력 확인 ({recovery.choices.length})</summary>
      {recovery.choices.map((row,i)=><div key={row.id}><p>임시 입력 {i+1} · {new Date(row.record.updatedAt).toLocaleString('ko-KR')}</p><button type="button" className="secondary-button" onClick={()=>compare(row)}>현재 입력과 비교</button><button type="button" className="text-button" onClick={()=>recovery.discard(row)}>이 임시 입력 삭제</button></div>)}
    </details>}
    {comparison&&comparison.row.record.kind!=='request'&&<div className="notice" role="group" aria-label="임시 입력 복구 확인">
      <p>기존 입력을 확인한 뒤 기기에 보관한 입력으로 바꿔 주세요. 성적과 첫 답은 바꾸지 않아요.</p>
      {Object.keys(comparison.row.record.values).map(key=>{
        const value=(comparison.row.record.kind!=='request'?comparison.row.record.values:{} as Record<string,unknown>) as Record<string,unknown>;
        const current=recovery.current as unknown as Record<string,unknown>;
        return <div key={key}><p className="small-note">{labels[key]??LABELS[key]??key} · 현재</p><RecordText text={format?.(key,current[key])??display(current[key])} label="현재 입력"/><p className="small-note">기기 보관</p><RecordText text={format?.(key,value[key])??display(value[key])} label="보관한 입력"/></div>;
      })}
      {!valid&&<p role="status">입력이 바뀌었어요. 다시 비교해 주세요.</p>}
      <button type="button" className="secondary-button" disabled={!valid} onClick={()=>{if(comparison&&recovery.choose(comparison.row.id,comparison.current,comparison.candidate))setComparison(null);}}>비교한 입력으로 이어쓰기</button>
      {!valid&&selected&&<button type="button" className="text-button" onClick={()=>compare(selected)}>다시 비교</button>}
      <button type="button" className="text-button" onClick={()=>setComparison(null)}>취소</button>
    </div>}
  </div>;
}
