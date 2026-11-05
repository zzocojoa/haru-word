import { z } from 'zod';
import { sentenceFeedbackSchema } from './sentence-feedback.ts';
import { storedAiModelSchema } from './ai-contract.ts';
import {feedbackContextFields} from './feedback-context.ts';

export const DRAFT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const DRAFT_MAX_COUNT = 20;
export const DRAFT_MAX_BYTES = 1024 * 1024;
export const DRAFT_ENTRY_BYTES = 64 * 1024;
export const DRAFT_PREFIX = 'haru-words:local-input:v1:';
export const DRAFT_OWNER_KEY = 'haru-words:local-input-owner:v1';
const CLEAR_PREFIX = 'haru-words:local-input-clear:v1:';
const ACTIVE_PREFIX = 'haru-words:local-input-active:v1:';
const text = z.string().max(10_000);
export const wordDraftValuesSchema = z.object({
  meaning:text,expression:text,expressionTranslation:text,example:text,translation:text,answer:text,sentence:text,notes:text,
  spoken:z.boolean(),revealed:z.boolean(),hint:z.boolean(),
}).strict();
const check = z.enum(['appropriate','needs_work','uncertain']);
export const grammarDraftValuesSchema = z.object({ sentence:z.string().max(2000),frame:z.array(z.string().max(200)).max(4).optional(),
  check:check.optional(),checks:z.object({meaning:check.optional(),form:check.optional()}).strict().optional(),
}).strict();
export type WordDraftValues = z.infer<typeof wordDraftValuesSchema>;
export type GrammarDraftValues = z.infer<typeof grammarDraftValuesSchema>;
const common = { version:z.literal(1),question:z.string().min(1).max(500),instanceId:z.string().uuid(),epoch:z.string().min(1).max(128),updatedAt:z.number().int().nonnegative() };
const lastFeedback = sentenceFeedbackSchema.optional();
export const localDraftSchema = z.discriminatedUnion('kind', [
  z.object({...common,kind:z.literal('word'),base:wordDraftValuesSchema,values:wordDraftValuesSchema,lastFeedback}).strict(),
  z.object({...common,kind:z.literal('grammar'),base:grammarDraftValuesSchema,values:grammarDraftValuesSchema,lastFeedback}).strict(),
  z.object({...common,kind:z.literal('request'),values:z.object({requestId:z.string().uuid(),domain:z.enum(['word','grammar']),targetKey:z.string().min(1).max(500),
    sentence:z.string().min(1).max(2000),expectedModelId:storedAiModelSchema,contextNote:feedbackContextFields.contextNote,expectedContextFingerprint:feedbackContextFields.expectedContextFingerprint,startedAt:z.number().int().nonnegative(),
    state:z.enum(['pending','recovered','failed']),feedback:lastFeedback}).strict()}).strict(),
]);
export type LocalDraft = z.infer<typeof localDraftSchema>;
export type DraftPayload = LocalDraft extends infer T ? T extends LocalDraft ? Omit<T,'version'|'question'|'instanceId'|'epoch'|'updatedAt'> : never : never;
export type DraftChoice = { id:string; record:LocalDraft };
export type DraftStorage = Pick<Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
export type DraftStorageState = {ready:boolean;available:boolean;active:boolean;revision:number;count:number;cleared:number;error:'unavailable'|'capacity'|'invalid'|null};
export const EMPTY_DRAFT_STORAGE_STATE: DraftStorageState = {ready:false,available:false,active:true,revision:0,count:0,cleared:0,error:null};
export function draftFingerprint(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(draftFingerprint).join(',')+']';
  if (value && typeof value==='object') return '{'+Object.keys(value).filter(k=>(value as Record<string,unknown>)[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+draftFingerprint((value as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(value) ?? 'null';
}
export const draftBytes = (value:string) => new TextEncoder().encode(value).byteLength;
const ownerPrefix = (owner:string) => DRAFT_PREFIX+encodeURIComponent(owner)+':';
const payloadOf = (entry:LocalDraft):DraftPayload => {
  const {version:_v,question:_q,instanceId:_i,epoch:_e,updatedAt:_u,...payload}=entry;
  void _v;void _q;void _i;void _e;void _u;return payload;
};

// One key per question AND page instance: two tabs never replace each other's row.
// This store never reads credentials, starts requests or mutates the learner's server state.
export class LocalLearningDrafts {
  private state:DraftStorageState={...EMPTY_DRAFT_STORAGE_STATE};
  private storage:DraftStorage|null=null;
  private entries=new Map<string,LocalDraft>();
  private listeners=new Set<()=>void>();
  private attempted=new Map<string,string>();
  private suppressed=new Map<string,string>();
  private connected=false;
  private ownerConfirmed=false;
  private confirmationOwner:string|null|undefined;
  private epoch='initial';
  readonly owner:string|null;
  readonly instanceId:string;
  private storageFactory:()=>DraftStorage;
  private now:()=>number;
  private requireOwnerConfirmation:boolean;
  constructor(owner:string|null,instanceId:string,storageFactory:()=>DraftStorage,now:()=>number=Date.now,requireOwnerConfirmation=false) {
    this.owner=owner;this.instanceId=instanceId;this.storageFactory=storageFactory;this.now=now;this.requireOwnerConfirmation=requireOwnerConfirmation;
  }
  getSnapshot=()=>this.state;
  getServerSnapshot=()=>EMPTY_DRAFT_STORAGE_STATE;
  invalidate=()=>{this.entries.clear();this.publish({active:false,available:false});};
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);this.connect();return()=>{this.listeners.delete(listener);};};
  private publish(patch:Partial<DraftStorageState>={}) {
    this.state={...this.state,...patch,revision:this.state.revision+1,count:this.entries.size};
    for(const listener of this.listeners)listener();
  }
  connect() {
    if(this.connected)return;
    this.connected=true;
    if(!this.owner){this.publish({ready:true,available:false});return;}
    // A delayed SSR document is not proof that this is still the signed-in owner.
    // Wait for its authenticated, validated state read before touching shared keys.
    if(this.requireOwnerConfirmation&&!this.ownerConfirmed){
      try{this.storage=this.storageFactory();this.confirmationOwner=this.storage.getItem(DRAFT_OWNER_KEY);}
      catch{this.publish({ready:true,available:false,error:'unavailable'});return;}
      this.publish({ready:true,available:false});return;
    }
    try {
      this.storage=this.storageFactory();
      const prefix=ownerPrefix(this.owner),keys=this.keys();
      for(const key of keys)if((key.startsWith(DRAFT_PREFIX)&&!key.startsWith(prefix))||(key.startsWith(CLEAR_PREFIX)&&key!==CLEAR_PREFIX+encodeURIComponent(this.owner))||(key.startsWith(ACTIVE_PREFIX)&&!key.startsWith(ACTIVE_PREFIX+encodeURIComponent(this.owner)+':')))this.storage.removeItem(key);
      this.storage.setItem(DRAFT_OWNER_KEY,this.owner);
      if(!this.activate())throw Error('storage_unavailable');
      const available=this.refresh();this.publish({ready:true,available});
    } catch {this.publish({ready:true,available:false,error:'unavailable'});}
  }
  confirmOwner=()=>{
    if(!this.owner||!this.state.active)return false;
    if(this.ownerConfirmed)return this.state.available;
    try{
      const currentOwner=(this.storage??this.storageFactory()).getItem(DRAFT_OWNER_KEY);
      if(currentOwner!==this.confirmationOwner&&currentOwner!==this.owner){this.invalidate();return false;}
    }catch{this.publish({available:false,error:'unavailable'});return false;}
    this.ownerConfirmed=true;this.connected=false;this.connect();return this.state.available;
  };
  private keys() { const s=this.storage!;return Array.from({length:s.length},(_,i)=>s.key(i)).filter((k):k is string=>k!==null); }
  private active() {
    if(this.requireOwnerConfirmation&&!this.ownerConfirmed)return false;
    if(!this.owner||!this.storage||!this.state.active)return false;
    if(this.storage.getItem(DRAFT_OWNER_KEY)!==this.owner){this.entries.clear();this.publish({active:false,available:false});return false;}
    return true;
  }
  refresh=()=>{
    try {
      if(!this.active())return false;
      const epoch=this.storage!.getItem(CLEAR_PREFIX+encodeURIComponent(this.owner!))??'initial';
      if(epoch!==this.epoch){this.epoch=epoch;this.suppressed=new Map(this.attempted);this.publish({cleared:this.state.cleared+1});}
      const next=new Map<string,LocalDraft>(),prefix=ownerPrefix(this.owner!);
      for(const id of this.keys().filter(k=>k.startsWith(prefix))){
        const raw=this.storage!.getItem(id);if(!raw)continue;
        let record:LocalDraft|undefined;
        try {if(draftBytes(raw)+draftBytes(id)<=DRAFT_ENTRY_BYTES){const parsed=localDraftSchema.safeParse(JSON.parse(raw));if(parsed.success)record=parsed.data;}}catch{}
        if(!record || record.epoch!==this.epoch || this.now()-record.updatedAt>DRAFT_RETENTION_MS || id!==prefix+record.instanceId+':'+encodeURIComponent(record.question)){this.storage!.removeItem(id);continue;}
        next.set(id,record);
      }
      if(draftFingerprint([...next])!==draftFingerprint([...this.entries])){this.entries=next;this.publish({available:true,error:null});}
      const activePrefix=ACTIVE_PREFIX+encodeURIComponent(this.owner!)+':',instances=new Set([...next.values()].map(row=>row.instanceId));
      for(const key of this.keys())if(key.startsWith(activePrefix)&&key!==activePrefix+this.instanceId&&!instances.has(key.slice(activePrefix.length)))this.storage!.removeItem(key);
      return true;
    }catch{this.publish({available:false,error:'unavailable'});return false;}
  };
  // Pagehide/unmount releases a page marker. A crashed page remains conservatively
  // active until its rows expire: another tab's unsaved variant is never evicted.
  activate=()=>{try{if(!this.active())return false;this.storage!.setItem(ACTIVE_PREFIX+encodeURIComponent(this.owner!)+':'+this.instanceId,'1');return true;}catch{this.publish({available:false,error:'unavailable'});return false;}};
  release=()=>{try{if(this.storage&&this.owner&&this.storage.getItem(DRAFT_OWNER_KEY)===this.owner)this.storage.removeItem(ACTIVE_PREFIX+encodeURIComponent(this.owner)+':'+this.instanceId);}catch{}};
  isInstanceActive=(instanceId:string)=>{try{return !!this.owner&&this.storage?.getItem(ACTIVE_PREFIX+encodeURIComponent(this.owner)+':'+instanceId)==='1';}catch{return true;}};
  retry=()=>{
    if(this.requireOwnerConfirmation&&!this.ownerConfirmed)return false;
    if(!this.state.active||!this.owner)return false;
    try {
      const storage=this.storageFactory(),owner=storage.getItem(DRAFT_OWNER_KEY);
      if(owner!==null&&owner!==this.owner){this.entries.clear();this.publish({active:false,available:false});return false;}
      this.connected=false;this.connect();return this.state.available;
    }catch{this.publish({available:false,error:'unavailable'});return false;}
  };
  list(question?:string,kind?:LocalDraft['kind']):DraftChoice[] {
    if(!this.state.active||!this.state.available)return [];
    return [...this.entries].filter(([,r])=>(question===undefined||r.question===question)&&(kind===undefined||r.kind===kind))
      .sort((a,b)=>b[1].updatedAt-a[1].updatedAt).map(([id,record])=>({id,record:structuredClone(record)}));
  }
  read(id:string):DraftChoice|undefined { return this.list().find(row=>row.id===id); }
  write(question:string,payload:DraftPayload):boolean {
    try {
      const signature=draftFingerprint(payload);
      if(!this.active()||!this.state.available){this.attempted.set(question,signature);return false;}
      // Observe a cross-tab deletion before recording this edit, so genuinely
      // new input is not mistaken for the value that the user just deleted.
      this.refresh();if(!this.state.available||!this.state.active){this.attempted.set(question,signature);return false;}
      if(this.suppressed.get(question)===signature)return true;
      this.attempted.set(question,signature);this.suppressed.delete(question);
      const id=ownerPrefix(this.owner!)+this.instanceId+':'+encodeURIComponent(question),previous=this.entries.get(id);
      if(previous&&draftFingerprint(payloadOf(previous))===signature)return true;
      const parsed=localDraftSchema.safeParse({...payload,version:1,question,instanceId:this.instanceId,epoch:this.epoch,updatedAt:this.now()});
      if(!parsed.success){this.publish({error:'invalid'});return false;}
      const record=parsed.data,raw=JSON.stringify(record),bytes=draftBytes(raw)+draftBytes(id);
      const existing=[...this.entries].filter(([key])=>key!==id);
      const total=existing.reduce((n,[key,value])=>n+draftBytes(key)+draftBytes(JSON.stringify(value)),bytes);
      if(bytes>DRAFT_ENTRY_BYTES||existing.length>=DRAFT_MAX_COUNT||total>DRAFT_MAX_BYTES){this.publish({error:'capacity'});return false;}
      if(!this.activate())return false;
      this.storage!.setItem(id,raw);this.entries.set(id,record);this.publish({available:true,error:null});return true;
    }catch{this.publish({available:false,error:'unavailable'});return false;}
  }
  remove(id:string,expected?:LocalDraft):boolean {
    try {
      if(!this.active()||!id.startsWith(ownerPrefix(this.owner!)))return false;
      const raw=this.storage!.getItem(id);if(raw===null)return true;
      if(expected && draftFingerprint(JSON.parse(raw))!==draftFingerprint(expected))return false;
      this.storage!.removeItem(id);this.entries.delete(id);this.publish({error:null});return true;
    }catch{this.publish({error:'unavailable',available:false});return false;}
  }
  clear(logout=false):boolean {
    try {
      if(!this.owner||!this.storage)return false;
      // A stale tab can never delete a new account's cache or owner marker.
      if(!this.active())return false;
      this.epoch=this.instanceId+':'+this.now()+':'+(this.state.cleared+1);
      this.storage.setItem(CLEAR_PREFIX+encodeURIComponent(this.owner),this.epoch);
      for(const key of this.keys())if(key.startsWith(ownerPrefix(this.owner))){
        const raw=this.storage.getItem(key);let fresh=false;
        try{fresh=!!raw&&JSON.parse(raw).epoch===this.epoch;}catch{}
        if(!fresh)this.storage.removeItem(key);
      }
      this.entries.clear();this.suppressed=new Map(this.attempted);
      if(logout){this.release();this.storage.removeItem(DRAFT_OWNER_KEY);}
      this.publish({cleared:this.state.cleared+1,error:null,...(logout?{active:false,available:false}:{available:true})});return true;
    }catch{this.publish({error:'unavailable',available:false});return false;}
  }
}
