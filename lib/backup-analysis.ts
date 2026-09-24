import { parseBackup, restoreChunks, backupSummary, type ParsedBackup } from './backup';
import { serializeBackup } from './backup-format';
import { LARGE_BACKUP_BYTES, sha256, utf8Bytes, type RestoreManifest } from './restore-protocol';
import type { State } from './learning';
import { manifestSchema } from './restore-validation';
export type AnalyzedBackup={parsed:ParsedBackup;manifest:RestoreManifest;parts:string[];bytes:number};
export async function analyzeBackup(raw:string,maxBytes=LARGE_BACKUP_BYTES):Promise<AnalyzedBackup>{
 const parsed=parseBackup(raw,maxBytes),parts:string[]=[],manifest:RestoreManifest={fileHash:await sha256(raw),fileBytes:utf8Bytes(raw),settings:parsed.state.settings,parts:[]};
 for(const kind of ['progress','sessions']as const)for(const text of restoreChunks(parsed.state[kind])){
  parts.push(text);manifest.parts.push({kind,hash:await sha256(text),bytes:utf8Bytes(text),count:Object.keys(JSON.parse(text)).length});
 }
 // An explicit empty grammar part means replace with empty; no part means preserve (old backup).
 if(parsed.state.grammar !== undefined) {
  const grammarParts=restoreChunks(parsed.state.grammar);
  for(const text of grammarParts.length ? grammarParts : ['{}']) {
   parts.push(text);manifest.parts.push({kind:'grammar',hash:await sha256(text),bytes:utf8Bytes(text),count:Object.keys(JSON.parse(text)).length});
  }
 }
 if(!manifestSchema.safeParse(manifest).success)throw new Error('복원할 기록이 지원 범위를 넘었어요.');
 return {parsed,manifest,parts,bytes:utf8Bytes(raw)};
}
export async function analyzeExport(state:State,now:number,maxBytes:number){
 const raw=serializeBackup(state,new Date(now));let error='';
 try{await analyzeBackup(raw,maxBytes);}catch(e){error=e instanceof Error?e.message:'백업 검증에 실패했어요.';}
 return {raw,bytes:utf8Bytes(raw),summary:backupSummary(state),error};
}
