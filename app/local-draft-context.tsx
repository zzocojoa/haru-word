'use client';
import {createContext,useContext,useEffect,useLayoutEffect,useMemo,useSyncExternalStore,type ReactNode} from 'react';
import {LocalLearningDrafts,EMPTY_DRAFT_STORAGE_STATE,DRAFT_PREFIX,DRAFT_OWNER_KEY} from '@/lib/local-learning-drafts';
import {OWNER_INVALIDATED_EVENT,LOCAL_RESTORE_APPLIED_EVENT,registerClientOwner} from '@/lib/client-owner';
const Context=createContext<LocalLearningDrafts|null>(null);
const noopSubscribe=()=>()=>{};
const emptySnapshot=()=>EMPTY_DRAFT_STORAGE_STATE;
export function useLocalDrafts(){
  const store=useContext(Context);
  const state=useSyncExternalStore(store?.subscribe??noopSubscribe,store?.getSnapshot??emptySnapshot,emptySnapshot);
  return {store,state};
}
export function LocalDraftProvider({ownerId,children}:{ownerId:string|null;children:ReactNode}){
  const store=useMemo(()=>new LocalLearningDrafts(ownerId,crypto.randomUUID(),()=>window.localStorage),[ownerId]);
  const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
  useLayoutEffect(()=>registerClientOwner(ownerId),[ownerId]);
  useEffect(()=>{
    store.activate();
    const invalidated=()=>store.invalidate();
    const restored=()=>{store.clear();};
    const refresh=()=>{store.activate();store.refresh();};
    const release=(event:PageTransitionEvent)=>{if(!event.persisted)store.release();};
    const storage=(event:StorageEvent)=>{if(event.key===null||event.key===DRAFT_OWNER_KEY||event.key.startsWith(DRAFT_PREFIX)||event.key.startsWith('haru-words:local-input-clear:v1:'))refresh();};
    const logout=(event:MouseEvent)=>{
      const target=event.target instanceof Element?event.target.closest('a[data-local-draft-logout]'):null;
      if(!(target instanceof HTMLAnchorElement))return;
      event.preventDefault();
      if(!store.clear(true)){store.invalidate();window.alert('이 기기의 임시 입력을 삭제하지 못했어요. 로그아웃은 계속해요. 공용 기기에서는 브라우저의 이 사이트 데이터를 삭제해 주세요.');}
      window.location.assign(target.href);
    };
    window.addEventListener('storage',storage);window.addEventListener('pageshow',refresh);window.addEventListener('focus',refresh);
    document.addEventListener('click',logout);
    window.addEventListener(OWNER_INVALIDATED_EVENT,invalidated);
    window.addEventListener(LOCAL_RESTORE_APPLIED_EVENT,restored);
    window.addEventListener('pagehide',release);
    return()=>{store.release();window.removeEventListener('storage',storage);window.removeEventListener('pageshow',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('pagehide',release);document.removeEventListener('click',logout);window.removeEventListener(OWNER_INVALIDATED_EVENT,invalidated);window.removeEventListener(LOCAL_RESTORE_APPLIED_EVENT,restored);};
  },[store]);
  if(!state.active)return <main className="page-shell"><div className="notice" role="alert"><p>로그인 상태를 다시 확인해야 해요. 새로고침해 현재 계정의 기록을 불러와 주세요.</p><button type="button" className="primary-button" onClick={()=>window.location.reload()}>새로고침</button></div></main>;
  return <Context.Provider key={ownerId??'anonymous'} value={store}>{children}</Context.Provider>;
}
