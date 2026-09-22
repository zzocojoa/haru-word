import { beginRequestDiagnostic } from './client-diagnostics.ts';

export const REQUEST_TIMEOUT_MS={load:20_000,save:25_000,restore:45_000,feedback:35_000} as const;
export class RequestTimeoutError extends Error {
 constructor(){super('Request timed out');this.name='RequestTimeoutError';}
}

// Covers both response headers and JSON body. No automatic retries for writes or AI.
export async function requestJson<T>(url:string,init:RequestInit,timeoutMs:number):Promise<{response:Response;data:T}>{
 const finish=beginRequestDiagnostic(url,init.method);let status:number|undefined;
 const controller=new AbortController();const upstream=init.signal;let timedOut=false;
 const cancel=()=>controller.abort(upstream?.reason);
 if(upstream?.aborted)cancel();else upstream?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs);
 try{const response=await fetch(url,{...init,signal:controller.signal});status=response.status;const data=await response.json() as T;finish(response.ok?'success':'http_error',status);return {response,data};}
 catch(error){finish(timedOut?'timeout':controller.signal.aborted?'cancelled':error instanceof SyntaxError?'invalid_response':'network_error',status);if(timedOut)throw new RequestTimeoutError();throw error;}
 finally{clearTimeout(timer);upstream?.removeEventListener('abort',cancel);}
}
