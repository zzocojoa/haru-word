import React,{useCallback,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {useLearningStore} from '../app/use-learning-store';
import {useLearningTools} from '../app/learning/use-learning-tools';

declare global{interface Window{savedSummaryHarness:{store:ReturnType<typeof useLearningStore>;unmount:()=>void}}}
function Harness(){
 const store=useLearningStore();
 const visit=useCallback(async()=>true,[]),date=useCallback(()=>'2026-11-04',[]);
 useLearningTools(store.readSavedState,visit,date);
 useLayoutEffect(()=>{window.savedSummaryHarness={store,unmount:()=>root.unmount()};});
 return <main><p id="harness-status">{JSON.stringify({loading:store.loading,unsaved:store.unsaved,conflict:store.conflict,error:store.error,goal:store.state.settings.dailyGoal})}</p>
  <button onClick={()=>void store.load()}>read server</button>
  <button onClick={()=>{const current=store.current.current;void store.restore({...current,settings:{...current.settings,dailyGoal:8}},current);}}>restore eight</button>
 </main>;
}
const root=createRoot(document.getElementById('root')!);root.render(<Harness/>);
