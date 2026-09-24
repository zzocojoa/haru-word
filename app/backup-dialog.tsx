'use client';
import { useEffect,useMemo,useRef,useState } from 'react';
import { Download,Loader2,Upload } from 'lucide-react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { backupSummary,replacementChanges,type ParsedBackup } from '@/lib/backup';
import { restoreCapabilities,pendingRestore,startRestore,sendRestorePart,checkRestore,cancelRestore,RestoreRequestError } from '@/lib/restore-client';
import type { RestoreJob,RestoreCapabilities } from '@/lib/restore-protocol';
import type { AnalyzedBackup } from '@/lib/backup-analysis';
import { inspectBackupFile } from './backup-worker-client';
import { useBackupPreview } from './use-backup-preview';
import { Progress } from '@/components/ui/progress';
import { KIND_TEXT,type State } from '@/lib/learning';
import { resumeMonthlyWriting } from '@/lib/learning/session-flow';
import { download } from './ui';
import { useNavigationState } from './navigation';

type Props={date:string;now:()=>number;state:State;getRevision?:()=>number;busy:boolean;restoring:boolean;error:string;conflict:boolean;onClose:()=>void;onRestore:(state:State,expected:State,jobId?:string)=>Promise<boolean>;onReload:()=>Promise<boolean>;onComplete:()=>void};
export default function BackupDialog({date,now,state,getRevision=()=>0,busy,restoring,error,conflict,onClose,onRestore,onReload,onComplete}:Props){
 const [backup,setBackup]=useState<ParsedBackup|null>(null);const [baseline,setBaseline]=useState<State|null>(null);const [name,setName]=useState('');const [reading,setReading]=useState(false);const [fileError,setFileError]=useState('');const [backedUpState,setBackedUpState]=useState<State|null>(null);const [safetyError,setSafetyError]=useState('');const [acknowledged,setAcknowledged]=useState(false);const [confirm,setConfirm]=useNavigationState('backup.confirm',false,true);const [success,setSuccess]=useState(false);const attempt=useRef(0);
 const [caps,setCaps]=useState<RestoreCapabilities|null>(null),[analysis,setAnalysis]=useState<AnalyzedBackup|null>(null),[job,setJob]=useState<RestoreJob|null>(null),[working,setWorking]=useState(false),[phase,setPhase]=useState('');
 const task=useRef<AbortController|null>(null),current=useRef(state);
 const [reloadRequired,setReloadRequired]=useState(false);
 const safetyPreview=useBackupPreview(state,now,caps?.maxBytes,!!backup);
 useEffect(()=>{current.current=state;},[state]);
 useEffect(()=>{let alive=true;void Promise.all([restoreCapabilities(),pendingRestore()]).then(([c,p])=>{if(alive){setCaps(c);setJob(p.job);}}).catch(()=>{if(alive)setFileError('복원 도구를 열지 못했어요. 창을 닫고 다시 열어 주세요.');});return()=>{alive=false;task.current?.abort();};},[]);
 async function select(file:File|undefined){
  task.current?.abort();const controller=new AbortController();task.current=controller;
  const id=++attempt.current;setBackup(null);setAnalysis(null);setBaseline(null);setBackedUpState(null);setSafetyError('');setAcknowledged(false);setConfirm(false);setFileError('');setReading(false);if(!file||!caps)return;setName(file.name);setReading(true);
  try{const result=await inspectBackupFile(file,caps.maxBytes,controller.signal);if(id===attempt.current){setBackup(result.parsed);setAnalysis(result);setBaseline(state);}}
  catch(e){if(id===attempt.current)setFileError(e instanceof Error?e.message:'파일을 읽지 못했어요.');}finally{if(id===attempt.current)setReading(false);}
 }
 function saveSafetyBackup(){
  setBackedUpState(null);setAcknowledged(false);setSafetyError('');
  if(!baseline||baseline!==state||busy||reading||conflict||reloadRequired||!safetyPreview||safetyPreview.error)return;
  try{
   download('haru-before-restore-'+date+'.json',safetyPreview.raw);
   setBackedUpState(state);
  }catch(e){setSafetyError('안전 백업을 준비하지 못해 기록 교체를 막았어요. '+(e instanceof Error?e.message:'백업을 내려받지 못했어요. 다시 시도해 주세요.'));}
 }
 async function prepare(){
  if(!allowed||!analysis||!caps)return;
  if(!caps.enabled){setConfirm(true);return;}
  setWorking(true);setPhase('전송 준비');setFileError('');const controller=new AbortController();task.current=controller;
  try{
   let next=await startRestore(getRevision(),analysis.manifest,controller.signal);setJob(next);
   for(let i=0;i<analysis.parts.length;i++)if(!next.received.includes(i)){
    setPhase(`전송 중 ${i+1}/${analysis.parts.length}`);next=await sendRestorePart(next.id,i,analysis.parts[i],controller.signal);setJob(next);
   }
   while(next.status!=='ready'){
    if(!['uploading','validating'].includes(next.status))throw new Error('진행 상태가 바뀌었어요. 파일을 다시 선택해 주세요.');
    setPhase(`전체 검증 ${next.validated}/${next.total}`);next=await checkRestore(next.id,controller.signal);setJob(next);
   }
   if(current.current!==baseline)throw new Error('현재 기록이 바뀌었어요. 창을 닫고 다시 진행해 주세요.');
   setConfirm(true);
  }catch(e){if(!controller.signal.aborted){if(e instanceof RestoreRequestError&&e.code==='revision_conflict')setReloadRequired(true);setFileError(e instanceof Error?e.message:'전송을 마치지 못했어요. 같은 파일로 이어갈 수 있어요.');const pending=await pendingRestore().catch(()=>null);if(pending)setJob(pending.job);}}
  finally{setWorking(false);setPhase('');}
 }
 async function cancel(){if(!job||working||restoring||conflict)return;setWorking(true);try{await cancelRestore(job.id);setJob(null);if(!reloadRequired)setFileError('');}catch(e){setFileError(e instanceof Error?e.message:'취소하지 못했어요.');}finally{setWorking(false);}}
 async function reload(){
  setWorking(true);
  try{
   // Only a pre-commit revision conflict may discard staging. An uncertain
   // commit must be reconciled by loading; it must never be cancelled here.
   if(reloadRequired&&!conflict&&job)await cancelRestore(job.id);
   if(await onReload()){onComplete();onClose();}
  }catch{setFileError('최신 기록을 불러오지 못했어요. 다시 시도해 주세요.');}
  finally{setWorking(false);}
 }
 async function apply(){setConfirm(false);if(!allowed||!backup||!baseline||caps?.enabled&&job?.status!=='ready')return;if(await onRestore(backup.state,baseline,caps?.enabled?job?.id:undefined)){setSuccess(true);onComplete();}}
 const before=useMemo(()=>backupSummary(baseline||state),[baseline,state]);
 const after=useMemo(()=>success?backupSummary(state):backup?backupSummary(backup.state):null,[backup,state,success]);
 const changes=useMemo(()=>backup&&baseline?replacementChanges(baseline,backup.state):null,[backup,baseline]);
 const recent=useMemo(()=>backup?Object.values(backup.state.sessions).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,3):[],[backup]);
 const stale=!!baseline&&baseline!==state&&!success;const backedUp=backedUpState===state;const allowed=!!backup&&!!caps&&backedUp&&acknowledged&&!busy&&!working&&!reading&&!stale&&!conflict&&!reloadRequired&&!success;
 const readyToConfirm=job?.status==='ready'&&job.fileHash===analysis?.manifest.fileHash&&allowed;
 const step=success?'6/6 · 반영 완료':restoring?'5/6 · 서버에 반영 중':confirm||readyToConfirm?'5/6 · 최종 확인':phase.startsWith('전체 검증')?'4/6 · 전체 검증':phase.startsWith('전송')?'3/6 · 전송':backup?'2/6 · 안전 백업 보관':'1/6 · 파일 확인';
 return <><Dialog open onOpenChange={open=>{if(!open&&!restoring)onClose()}}><DialogContent className="backup-dialog framed-dialog" showCloseButton={!restoring} onCloseAutoFocus={e=>{e.preventDefault();document.querySelector<HTMLButtonElement>('[data-backup-trigger]')?.focus()}} onEscapeKeyDown={e=>{if(restoring)e.preventDefault()}} onInteractOutside={e=>e.preventDefault()}>
  <DialogHeader><DialogTitle>{success?'백업을 복원했어요.':'백업에서 복원'}</DialogTitle><DialogDescription>{success?'학습 기록과 설정을 서버에 저장했어요. 다른 기기에서도 이어갈 수 있어요.':'파일을 먼저 확인하고, 백업 시점의 학습 기록과 설정으로 되돌려요.'}</DialogDescription></DialogHeader>
  <p className="small-note" data-backup-step role="status">{conflict?'복원 결과 확인 필요':reloadRequired?'최신 기록 확인 필요':step}</p>
  <div className="dialog-scroll">{success?<><p role="status">{after?.words.toLocaleString()}개 단어 기록 · {after?.sessions.toLocaleString()}개 회차를 복원했어요.</p></>:<>
   <label className="backup-file">하루단어 JSON 백업<input type="file" accept=".json,application/json" disabled={busy||working||reading||conflict||reloadRequired||!caps} onChange={e=>void select(e.target.files?.[0])}/></label>
   <p className="small-note">‘전체 백업’과 이전 ‘현재 입력 백업’을 지원해요. {caps?`최대 ${caps.maxBytes/1_000_000} MB · 단어 기록 5,000개 · 회차 10,000개.`:'지원 범위 확인 중'}</p>
   {job&&job.status!=='committed'&&<div className="backup-impact"><p>이어서 할 복원 · 전송 {job.received.length}/{job.total}</p><p className="small-note">같은 파일을 다시 선택하면 이어갈 수 있어요. 작업은 시작 후 24시간 동안 유지돼요.</p><button className="text-button" disabled={working||restoring||conflict} onClick={()=>void cancel()}>기존 복원 작업 취소</button></div>}
   {phase&&<div role="status"><p>{phase}</p><Progress aria-label="복원 준비 진행률" value={job?.total?Math.round((job.received.length+job.validated)/(job.total*2)*100):0}/><button className="text-button" disabled={restoring} onClick={()=>{task.current?.abort();onClose();}}>나중에 이어서</button></div>}
   {reading&&<p role="status"><Loader2 size={16} className="spin"/> 파일을 확인하고 있어요.</p>}
   {fileError&&<p className="backup-error" role="alert">{fileError}</p>}
   {backup&&after&&changes&&<>
    <div className="backup-file-info"><b>{name}</b><p>{backup.exportedAt?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(backup.exportedAt))+' 백업':'백업 날짜가 없는 이전 형식이에요.'}</p>{backup.legacy&&<p>이전 형식의 기록을 검증했어요. 기록 내용은 그대로 복원해요.</p>}</div>
    <table className="backup-comparison"><caption>현재 기록과 복원할 기록</caption><thead><tr><th scope="col">항목</th><th scope="col">현재</th><th scope="col">백업</th></tr></thead><tbody>
     {([['단어 기록',before.words,after.words],['학습 회차',before.sessions,after.sessions],['개인 단어',before.personal,after.personal],['미완료 회차',before.unfinished,after.unfinished],['학습 수준',before.level,after.level],['하루 목표',before.goal+'개',after.goal+'개']]as const).map(([label,a,b])=><tr key={label}><th scope="row">{label}</th><td>{a}</td><td>{b}</td></tr>)}
    </tbody></table>
    <p className="small-note">품사 수업: 현재 {Object.keys((baseline || state).grammar ?? {}).length}개 · {backup.state.grammar === undefined ? '이전 백업에 품사 진도가 없어 현재 진도를 유지해요.' : `백업의 ${Object.keys(backup.state.grammar).length}개 진도로 교체해요.`}</p>
    {analysis&&<p className="small-note">파일 {(analysis.bytes/1_000_000).toFixed(2)} MB · 파일 검증 완료</p>}
    <div className="backup-impact"><p>단어 기록: 추가 {changes.words.added} · 변경 {changes.words.changed} · 제거 {changes.words.removed}</p><p>학습 회차: 추가 {changes.sessions.added} · 변경 {changes.sessions.changed} · 제거 {changes.sessions.removed}</p><b>단어 기록과 설정을 이 백업으로 교체해요. 품사 수업은 위에 표시된 보관 방식이 적용돼요.</b></div>
    <details className="notes-details"><summary>백업의 최근 회차 확인</summary>{recent.map(s=><p key={s.id}>{s.date} · {KIND_TEXT[s.kind]} · {s.ids.length}개 · {resumeMonthlyWriting(s).finished?'회차 종료':'진행 중'}</p>)}{!after.sessions&&<p>학습 회차가 없는 백업이에요.</p>}</details>
    <p className="small-note" data-safety-preview role="status">{safetyPreview?.raw?`안전 백업 ${(safetyPreview.bytes/1_000_000).toFixed(2)} MB · 단어 ${before.words.toLocaleString()}개 · 회차 ${before.sessions.toLocaleString()}개 · ${safetyPreview.error?'복원 불가':'복원 가능'}`:safetyPreview?.error?'안전 백업의 크기와 복원 여부를 확인하지 못했어요.':'현재 기록의 안전 백업을 확인하고 있어요.'}</p>
    <button className="secondary-button full" disabled={busy||working||reading||stale||conflict||reloadRequired||!safetyPreview||!!safetyPreview.error} onClick={saveSafetyBackup}><Download size={16}/>현재 기록 먼저 백업받기</button>
    {(safetyError||safetyPreview?.error)&&<p className="backup-error" role="alert">{safetyError||'안전 백업을 준비하지 못해 기록 교체를 막았어요. '+safetyPreview?.error}</p>}
    {backedUp&&<p className="small-note" role="status">복원 검증을 통과한 백업이에요. 내려받은 파일을 보관해 주세요.</p>}
    <label className="backup-ack"><Checkbox checked={acknowledged} disabled={!backedUp||busy||working||stale} onCheckedChange={v=>setAcknowledged(v===true)}/><span>현재 기록의 백업을 보관했고, 위 내용으로 교체됨을 확인했어요.</span></label>
    {stale&&!conflict&&<p role="alert" className="backup-error">현재 기록이 바뀌었어요. 창을 닫고 복원 미리보기를 다시 열어 주세요.</p>}
    {error&&<p role="alert" className="backup-error">{error}</p>}

   </>}
  </>}
 </div>{success?<div className="dialog-actions"><button className="primary-button full" onClick={onClose}>학습 기록 확인하기</button></div>:backup&&<div className="dialog-actions">{conflict||reloadRequired?<button className="secondary-button full" disabled={restoring||reading||working} onClick={()=>void reload()}>서버 기록 확인하기</button>:<button className="primary-button full" disabled={!allowed} onClick={()=>void prepare()}>{restoring?<Loader2 size={16} className="spin"/>:<Upload size={16}/>} {restoring?'서버에 복원 중':'이 백업으로 복원'}</button>}</div>}
 </DialogContent></Dialog>
 <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent className="backup-confirm"><AlertDialogHeader><AlertDialogTitle>현재 기록을 교체할까요?</AlertDialogTitle><AlertDialogDescription>백업의 단어 기록 {after?.words}개와 학습 회차 {after?.sessions}개로 교체합니다. 기존 기록으로 돌아가려면 방금 내려받은 백업이 필요합니다.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction disabled={!allowed} onClick={e=>{e.preventDefault();void apply();}}>기록 교체 · 복원</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
