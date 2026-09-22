import type { State } from './learning';

// State updates preserve untouched objects. Skip serialization of those
// references, but still compare cloned records by value before sending them.
function changedEntries<T>(before:Record<string,T>,after:Record<string,T>):Record<string,T>{
 if(before===after)return {};
 return Object.fromEntries(Object.entries(after).filter(([id,value])=>
  before[id]!==value&&JSON.stringify(before[id])!==JSON.stringify(value)
 ));
}

export function stateDelta(before:State,after:State){
 return {
  settings:before.settings!==after.settings&&JSON.stringify(before.settings)!==JSON.stringify(after.settings)?after.settings:undefined,
  progress:changedEntries(before.progress,after.progress),
  sessions:changedEntries(before.sessions,after.sessions),
 };
}
