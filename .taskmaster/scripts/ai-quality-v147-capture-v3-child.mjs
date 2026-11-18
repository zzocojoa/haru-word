import {readFileSync} from 'node:fs';
import {openV3Journal} from './ai-quality-v147-journal-v3.mjs';
import {openV3CaptureStore} from './ai-quality-v147-capture-v3.mjs';
import {prepareV3Wire} from './ai-quality-v147-wire-v3.mjs';
import {compileBudgetV3} from './ai-quality-v147-budget-v3.mjs';
const [file,stage]=process.argv.slice(2),{context,bundle}=JSON.parse(readFileSync(file,'utf8'));
try{const k=compileBudgetV3(context.spec),session=openV3Journal(context),key=context.spec.order[0];session.append({kind:'reserve',groupId:k.groupIds[0]});const prepared=prepareV3Wire({seal:bundle.seal,current:bundle.current,spec:context.spec,ledger:session.current().ledger,key,wire:bundle.wires[key]});session.append(prepared.bindOperation);session.append({kind:'consume',key});
 const responseRaw=JSON.stringify({status:'completed',model:context.spec.requests[0].modelId,usage:{input_tokens:20,output_tokens:20},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:bundle.responses[key]}]}]});
 openV3CaptureStore({context,seal:bundle.seal,observeCurrent:()=>bundle.current}).capture({ledger:session.current().ledger,key,requestRaw:prepared.raw,responseRaw,status:200,contentType:'application/json'},point=>{if(point===stage)process.exit(87);});session.close();process.stdout.write('{"unexpectedComplete":true}\n');process.exitCode=1;
}catch{process.stdout.write('{"held":true,"code":"C3_CHILD_HELD"}\n');process.exitCode=75;}
