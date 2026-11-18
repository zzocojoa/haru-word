// A branded read-only witness around the existing physical capture reader.
// No caller-supplied 'committed:true' object can stand in for actual files.
import {realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {openV3CaptureStore} from './ai-quality-v147-capture-v3.mjs';
import {digest} from './ai-quality-v147-budget-v3.mjs';
export const SETTLEMENT_PROOF_V3='ai-quality-v147-settlement-proof-v3';
const registered=new WeakMap(),check=(ok,code)=>{if(!ok)throw Error('S3_'+code);};
const scope=context=>digest({root:realpathSync(context.allowedRoot),directory:realpathSync(context.directory),specHash:digest(context.spec)});
export function openV3SettlementProof(options){
 const store=openV3CaptureStore(options),context=structuredClone(options.context),scopeHash=scope(context),bridge=Object.freeze({protocol:SETTLEMENT_PROOF_V3,noDispatchPerformed:true,providerReceiptAuthenticated:false});registered.set(bridge,{store,scopeHash,directory:resolve(context.allowedRoot,'v3-'+context.spec.runId+'-captures'),specHash:digest(context.spec),sourceSeal:context.spec.sourceSeal,runId:context.spec.runId});return bridge;
}
export function readV3SettlementProof({bridge,context,ledger,key,expectedResult}){
 const binding=registered.get(bridge);check(binding&&scope(context)===binding.scopeHash,'REGISTERED_SCOPE');const c=binding.store.read({ledger,key,expectedResult});
 check(c.committed===true&&c.physicalCaptureValidated===true&&c.specHash===binding.specHash&&c.sourceSeal===binding.sourceSeal&&c.runId===binding.runId&&c.directory===binding.directory&&c.receiptHash===digest(expectedResult)&&digest(c.result)===digest(expectedResult),'PHYSICAL_BINDING');
 check(Object.keys(c.files).length===5&&Object.entries(c.files).every(([n,h])=>n.startsWith(expectedResult.requestId+'.')&&/^[a-f0-9]{64}$/.test(h)),'FILE_WITNESS');
 return {protocol:SETTLEMENT_PROOF_V3,key,result:structuredClone(expectedResult),captureDirectoryHash:digest(c.directory),files:structuredClone(c.files),receiptHash:c.receiptHash,providerReceiptAuthenticated:false};
}
