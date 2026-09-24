'use client';
import { useRef,useState } from 'react';
import { Download,Loader2,Upload } from 'lucide-react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { MAX_BACKUP_BYTES,parseBackup,prepareSafetyBackup,backupSummary,replacementChanges,type ParsedBackup } from '@/lib/backup';
import { KIND_TEXT,type State } from '@/lib/learning';
import { resumeMonthlyWriting } from '@/lib/learning/session-flow';
import { download } from './ui';

type Props={date:string;now:()=>number;state:State;busy:boolean;restoring:boolean;error:string;conflict:boolean;onClose:()=>void;onRestore:(state:State,expected:State)=>Promise<boolean>;onReload:()=>Promise<boolean>;onComplete:()=>void};
export default function BackupDialog({date,now,state,busy,restoring,error,conflict,onClose,onRestore,onReload,onComplete}:Props){
 const [backup,setBackup]=useState<ParsedBackup|null>(null);const [baseline,setBaseline]=useState<State|null>(null);const [name,setName]=useState('');const [reading,setReading]=useState(false);const [fileError,setFileError]=useState('');const [backedUpState,setBackedUpState]=useState<State|null>(null);const [safetyError,setSafetyError]=useState('');const [acknowledged,setAcknowledged]=useState(false);const [confirm,setConfirm]=useState(false);const [success,setSuccess]=useState(false);const attempt=useRef(0);
 async function select(file:File|undefined){
  const id=++attempt.current;setBackup(null);setBaseline(null);setBackedUpState(null);setSafetyError('');setAcknowledged(false);setConfirm(false);setFileError('');setReading(false);if(!file)return;setName(file.name);setReading(true);
  try{if(file.size>MAX_BACKUP_BYTES)throw new Error('백업 파일은 8 MB까지 복원할 수 있어요.');const parsed=parseBackup(await file.text());if(id===attempt.current){setBackup(parsed);setBaseline(state);}}
  catch(e){if(id===attempt.current)setFileError(e instanceof Error?e.message:'파일을 읽지 못했어요.');}finally{if(id===attempt.current)setReading(false);}
 }
 function saveSafetyBackup(){
  setBackedUpState(null);setAcknowledged(false);setSafetyError('');
  if(!baseline||baseline!==state||busy||reading||conflict)return;
  try{
   const raw=prepareSafetyBackup(state,new Date(now()));
   download('haru-before-restore-'+date+'.json',raw);
   setBackedUpState(state);
  }catch(e){setSafetyError('안전 백업을 준비하지 못해 기록 교체를 막았어요. '+(e instanceof Error?e.message:'백업을 내려받지 못했어요. 다시 시도해 주세요.'));}
 }
 async function apply(){setConfirm(false);if(!allowed||!backup||!baseline)return;if(await onRestore(backup.state,baseline)){setSuccess(true);onComplete();}}
 const before=backupSummary(baseline||state),after=backup?backupSummary(backup.state):null;const changes=backup&&baseline?replacementChanges(baseline,backup.state):null;
 const stale=!!baseline&&baseline!==state&&!success;const backedUp=backedUpState===state;const allowed=!!backup&&backedUp&&acknowledged&&!busy&&!reading&&!stale&&!conflict&&!success;
 return <><Dialog open onOpenChange={open=>{if(!open&&!restoring)onClose()}}><DialogContent className="backup-dialog framed-dialog" showCloseButton={!restoring} onCloseAutoFocus={e=>{e.preventDefault();document.querySelector<HTMLButtonElement>('[data-backup-trigger]')?.focus()}} onEscapeKeyDown={e=>{if(restoring)e.preventDefault()}} onInteractOutside={e=>e.preventDefault()}>
  <DialogHeader><DialogTitle>{success?'백업을 복원했어요.':'백업에서 복원'}</DialogTitle><DialogDescription>{success?'학습 기록과 설정을 서버에 저장했어요. 다른 기기에서도 이어갈 수 있어요.':'파일을 먼저 확인하고, 백업 시점의 학습 기록과 설정으로 되돌려요.'}</DialogDescription></DialogHeader>
  <div className="dialog-scroll">{success?<><p role="status">{after?.words.toLocaleString()}개 단어 기록 · {after?.sessions.toLocaleString()}개 회차를 복원했어요.</p></>:<>
   <label className="backup-file">하루단어 JSON 백업<input type="file" accept=".json,application/json" disabled={busy||reading} onChange={e=>void select(e.target.files?.[0])}/></label>
   <p className="small-note">‘전체 백업’과 이전 ‘현재 입력 백업’ 파일을 지원해요. 최대 8 MB · 단어 기록 5,000개 · 학습 회차 10,000개.</p>
   {reading&&<p role="status"><Loader2 size={16} className="spin"/> 파일을 확인하고 있어요.</p>}
   {fileError&&<p className="backup-error" role="alert">{fileError}</p>}
   {backup&&after&&changes&&<>
    <div className="backup-file-info"><b>{name}</b><p>{backup.exportedAt?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(backup.exportedAt))+' 백업':'백업 날짜가 없는 이전 형식이에요.'}</p>{backup.legacy&&<p>이전 형식의 기록을 검증했어요. 기록 내용은 그대로 복원해요.</p>}</div>
    <table className="backup-comparison"><caption>현재 기록과 복원할 기록</caption><thead><tr><th scope="col">항목</th><th scope="col">현재</th><th scope="col">백업</th></tr></thead><tbody>
     {([['단어 기록',before.words,after.words],['학습 회차',before.sessions,after.sessions],['개인 단어',before.personal,after.personal],['미완료 회차',before.unfinished,after.unfinished],['학습 수준',before.level,after.level],['하루 목표',before.goal+'개',after.goal+'개']]as const).map(([label,a,b])=><tr key={label}><th scope="row">{label}</th><td>{a}</td><td>{b}</td></tr>)}
    </tbody></table>
    <div className="backup-impact"><p>단어 기록: 추가 {changes.words.added} · 변경 {changes.words.changed} · 제거 {changes.words.removed}</p><p>학습 회차: 추가 {changes.sessions.added} · 변경 {changes.sessions.changed} · 제거 {changes.sessions.removed}</p><b>현재 기록 전체를 이 백업으로 교체해요. 백업 이후의 학습과 파일에 없는 기록은 사라져요.</b></div>
    <details className="notes-details"><summary>백업의 최근 회차 확인</summary>{Object.values(backup.state.sessions).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,3).map(s=><p key={s.id}>{s.date} · {KIND_TEXT[s.kind]} · {s.ids.length}개 · {resumeMonthlyWriting(s).finished?'회차 종료':'진행 중'}</p>)}{!after.sessions&&<p>학습 회차가 없는 백업이에요.</p>}</details>
    <button className="secondary-button full" disabled={busy||reading||stale||conflict} onClick={saveSafetyBackup}><Download size={16}/>현재 기록 먼저 백업받기</button>
    {safetyError&&<p className="backup-error" role="alert">{safetyError}</p>}
    {backedUp&&<p className="small-note" role="status">복원 검증을 통과한 백업이에요. 내려받은 파일을 보관해 주세요.</p>}
    <label className="backup-ack"><Checkbox checked={acknowledged} disabled={!backedUp||busy||stale} onCheckedChange={v=>setAcknowledged(v===true)}/><span>현재 기록의 백업을 보관했고, 위 내용으로 교체됨을 확인했어요.</span></label>
    {stale&&!conflict&&<p role="alert" className="backup-error">현재 기록이 바뀌었어요. 창을 닫고 복원 미리보기를 다시 열어 주세요.</p>}
    {error&&<p role="alert" className="backup-error">{error}</p>}

   </>}
  </>}
 </div>{success?<div className="dialog-actions"><button className="primary-button full" onClick={onClose}>학습 기록 확인하기</button></div>:backup&&<div className="dialog-actions">{conflict?<button className="secondary-button full" disabled={restoring||reading} onClick={async()=>{if(await onReload()){onComplete();onClose();}}}>서버 기록 확인하기</button>:<button className="primary-button full" disabled={!allowed} onClick={()=>setConfirm(true)}>{restoring?<Loader2 size={16} className="spin"/>:<Upload size={16}/>} {restoring?'서버에 복원 중':'이 백업으로 복원'}</button>}</div>}
 </DialogContent></Dialog>
 <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent className="backup-confirm"><AlertDialogHeader><AlertDialogTitle>현재 기록을 교체할까요?</AlertDialogTitle><AlertDialogDescription>백업의 단어 기록 {after?.words}개와 학습 회차 {after?.sessions}개로 교체합니다. 기존 기록으로 돌아가려면 방금 내려받은 백업이 필요합니다.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction disabled={!allowed} onClick={e=>{e.preventDefault();void apply();}}>기록 교체 · 복원</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
