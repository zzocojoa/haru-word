// Registered only from the mounted browser page, never from a server render.
export const STUDY_OWNER_HEADER = 'X-Study-Owner';
export const OWNER_INVALIDATED_EVENT = 'haru-words:owner-invalidated';
export const LOCAL_RESTORE_APPLIED_EVENT = 'haru-words:local-restore-applied';
type Registration = { ownerId:string|null; token:object };
let registration:Registration|undefined;
export function registerClientOwner(ownerId:string|null) {
  const next={ownerId,token:{}};registration=next;
  return ()=>{if(registration===next)registration=undefined;};
}
export function captureLocalRestoreNotice(){
  const captured=registration;
  return ()=>{if(captured&&registration===captured&&typeof window!=='undefined')window.dispatchEvent(new Event(LOCAL_RESTORE_APPLIED_EVENT));};
}
export function clientOwnerRequest(url:string,init:RequestInit) {
  const captured=registration;
  if(!captured||!url.startsWith('/api/'))return {init,invalidated:()=>{}};
  const headers=new Headers(init.headers);
  // A caller cannot override the identity of the page currently owning the request.
  headers.set(STUDY_OWNER_HEADER,captured.ownerId??'');
  return {init:{...init,headers},invalidated:()=>{
    // An anonymous 401 is the normal sign-in boundary, not an account switch.
    if(captured.ownerId&&registration===captured&&typeof window!=='undefined')window.dispatchEvent(new Event(OWNER_INVALIDATED_EVENT));
  }};
}
