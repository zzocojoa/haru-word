'use client';
import {useRef,useState} from 'react';
import {Stack} from '@astryxdesign/core/Layout';
import {Heading,Text} from '@astryxdesign/core/Text';
import {HaruButton,HaruIconButton,HaruTextInput,HaruTextArea,HaruSelector,HaruNotice,HaruProgress} from '../haru-controls';
import {HaruIcon} from '@/components/icons/haru-icon';
import {StatusBadge} from '../study-ui';
// Opt-in synthetic route only. No storage or AI action is attached to these controls.
export function HaruControlContracts(){
  const [word,setWord]=useState(''),[note,setNote]=useState(''),[kind,setKind]=useState('sentence');
  const [actions,setActions]=useState(0),[submits,setSubmits]=useState(0),[busy,setBusy]=useState(false),[events,setEvents]=useState('');
  const input=useRef<HTMLInputElement>(null),area=useRef<HTMLTextAreaElement>(null),button=useRef<HTMLButtonElement>(null),release=useRef<(()=>void)|null>(null);
  const hold=async()=>{setActions(n=>n+1);setBusy(true);try{await new Promise<void>(resolve=>{release.current=resolve;});}finally{setBusy(false);release.current=null;}};
  return <Stack direction="vertical" gap={3}>
    <Heading level={2}>공통 조작 계약 확인</Heading>
    <form id="haru-contract" onSubmit={event=>{event.preventDefault();if(!busy)setSubmits(n=>n+1);}}>
      <HaruTextInput ref={input} label="필수 입력 계약" name="contractWord" value={word} required maxLength={4} onChange={event=>{setWord(event.target.value);setEvents('input:'+event.currentTarget.value);}}/>
      <HaruTextArea ref={area} label="한국어 의도 계약" name="contractNote" value={note} required maxLength={4} rows={2} lang="ko" onChange={event=>{setNote(event.target.value);setEvents('textarea:'+event.currentTarget.value);}}/>
      <HaruTextInput label="읽기 전용 계약" name="readOnlyWord" value="읽기 전용" readOnly/>
      <HaruTextInput label="비활성 입력 계약" name="disabledWord" value="입력 금지" disabled onChange={()=>setActions(n=>n+1)}/>
      <HaruSelector label="선택 계약" name="kind" value={kind} onChange={setKind} options={[{value:'sentence',label:'일반 문장'},{value:'question',label:'질문'}]}/>
      <HaruSelector label="읽기 전용 선택 계약" value="sentence" readOnly options={[{value:'sentence',label:'일반 문장'}]}/>
      <HaruButton ref={button} label="폼 제출 계약" type="submit" name="contractSubmit" value="save" busy={busy}/>
      <HaruButton label="비활성 제출 계약" type="submit" disabled onClick={()=>setActions(n=>n+1)}/>
    </form>
    <HaruButton label="연속 실행 계약" onClick={hold} busy={busy}/>
    <HaruButton label="대기 해제 계약" onClick={()=>release.current?.()}/>
    <HaruIconButton label="비활성 아이콘 계약" icon={<HaruIcon name="settings"/>} disabled onClick={()=>setActions(n=>n+1)}/>
    <HaruButton label="입력 초점 계약" onClick={()=>input.current?.focus()}/>
    <HaruButton label="문장 초점 계약" onClick={()=>area.current?.focus()}/>
    <HaruButton label="제출 초점 계약" onClick={()=>button.current?.focus()}/>
    <Text type="body">계약 실행: {actions} · 제출: {submits} · 대기: {busy?'예':'아니오'}</Text>
    <Text type="body">계약 이벤트: {events}</Text>
    <HaruNotice title={'연결 오류가 길게 표시되어도 현재 입력은 보존돼요. '.repeat(10)} className="error-banner" status="error">
      <HaruButton label="복구 계약" onClick={()=>setActions(n=>n+1)}/>
    </HaruNotice>
    <HaruProgress label="아직 측정하지 않은 진행" value={0} className="session-progress"/>
    <HaruProgress label="기록 완료 진행" value={100}/>
    <StatusBadge tone="neutral">미측정 · 독립 회상 아님</StatusBadge>
    <StatusBadge tone="success">기록 완료 · 독립 회상 아님</StatusBadge>
  </Stack>;
}
