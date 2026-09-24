import { z } from 'zod';
import { requestJson, InvalidResponseError, RequestTimeoutError } from './client-request';
import { LARGE_BACKUP_BYTES, RESTORE_PART_BYTES, type RestoreManifest } from './restore-protocol';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
export class RestoreRequestError extends Error {
 constructor(message:string,public status:number,public code:string){super(message);}
}
export const restoreJobSchema=z.object({id:z.string().uuid(),baseRevision:z.number().int().nonnegative().safe(),fileHash:hash,status:z.enum(['uploading','validating','ready','committed','cancelled']),received:z.array(z.number().int().min(0).max(63)).max(64),validated:z.number().int().min(0).max(64),total:z.number().int().min(0).max(64),expiresAt:z.number().int().positive().safe(),revision:z.number().int().nonnegative().safe().nullable()}).strict().refine(j=>
 j.validated<=j.total&&new Set(j.received).size===j.received.length&&j.received.every(i=>i<j.total)&&
 (j.status==='committed'?j.revision===j.baseRevision+1&&j.validated===j.total&&j.received.length===0:j.revision===null)&&
 (!['validating','ready'].includes(j.status)||j.received.length===j.total)&&
 (j.status!=='ready'||j.validated===j.total)&&
 (j.status!=='uploading'||j.validated===0)
);
const capabilitiesSchema=z.object({enabled:z.boolean(),maxBytes:z.union([z.literal(8_000_000),z.literal(LARGE_BACKUP_BYTES)]),partBytes:z.literal(RESTORE_PART_BYTES)}).strict();
async function call<T>(path:string,schema:z.ZodType<T>,method='GET',body?:string,signal?:AbortSignal):Promise<T>{
 const result=await requestJson(path,{method,cache:'no-store',headers:method==='GET'?undefined:{'Content-Type':'application/json'},body,signal},method==='GET'?20_000:45_000,(data,response)=>{
  if(response.ok&&!schema.safeParse(data).success)throw new InvalidResponseError();
  return data;
 }).catch(error=>{
  if(signal?.aborted)throw error;
  if(error instanceof SyntaxError)throw new InvalidResponseError();
  if(error instanceof RequestTimeoutError||error instanceof TypeError)throw new Error('연결이 끊기거나 응답이 늦어졌어요. 같은 파일을 선택해 이어갈 수 있어요.');
  throw error;
 });
 if(!result.response.ok){const data=z.object({error:z.string(),code:z.enum(['revision_conflict','invalid_restore','internal_error']).optional()}).safeParse(result.data);throw new RestoreRequestError(data.success?data.data.error:'복원 요청을 처리하지 못했어요.',result.response.status,data.success?data.data.code||'invalid_restore':'invalid_response');}
 const parsed=schema.safeParse(result.data);if(!parsed.success)throw new InvalidResponseError();return parsed.data;
}
const root='/api/state/restore/jobs';
const jobResponse=(id:string)=>restoreJobSchema.refine(job=>job.id===id);
export const restoreCapabilities=()=>call('/api/state/restore',capabilitiesSchema);
export const pendingRestore=()=>call(root,z.object({job:restoreJobSchema.nullable()}).strict());
export const restoreStatus=(id:string)=>call(root+'/'+encodeURIComponent(id),jobResponse(id));
export const cancelRestore=(id:string)=>call(root+'/'+encodeURIComponent(id),jobResponse(id),'DELETE');
export const startRestore=(revision:number,manifest:RestoreManifest,signal?:AbortSignal)=>call(root,restoreJobSchema.refine(job=>job.baseRevision===revision&&job.fileHash===manifest.fileHash&&job.total===manifest.parts.length),'POST',JSON.stringify({revision,manifest}),signal);
export const sendRestorePart=(id:string,index:number,raw:string,signal?:AbortSignal)=>call(`${root}/${encodeURIComponent(id)}/chunks/${index}`,jobResponse(id),'PUT',raw,signal);
export const checkRestore=(id:string,signal?:AbortSignal)=>call(`${root}/${encodeURIComponent(id)}/validate`,jobResponse(id),'POST',undefined,signal);
export async function commitRestore(id:string){
 try{return await call(`${root}/${encodeURIComponent(id)}/commit`,jobResponse(id).refine(job=>job.status==='committed'),'POST');}
 catch(error){const status=await restoreStatus(id).catch(()=>null);if(status?.status==='committed')return status;throw error;}
}
