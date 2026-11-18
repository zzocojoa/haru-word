// Structural projection only. The provider supplies the complete sentence;
// this code never selects an interpretation of an ambiguous short edit.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
function occurrences(text,needle){
 if(!needle)return Infinity;
 let count=0,start=0;
 while((start=text.indexOf(needle,start))!==-1){count++;start++;}
 return count;
}
export function projectFullSentenceReferenceV1(assignment,wire){
 const original=assignment.sentence,corrected=wire.correction;
 assert.equal(typeof original,'string');assert(original.length>0&&original.length<=2000&&original.isWellFormed());
 assert.equal(typeof corrected,'string');assert(corrected.length<=2000&&corrected.isWellFormed());
 assert(!Object.hasOwn(wire,'edits'));
 const canonical={...wire};delete canonical.correction;
 const proof={protocol:'ai-quality-v147-full-sentence-projection-v1',originalSha256:sha(original),providerCorrectionSha256:sha(corrected),
  providerSentenceModified:false,englishMeaningOrCorrectnessVerified:false,rawResponsePreserved:true};
 if(wire.contextNeeded!=='none'){
  assert.equal(corrected,'','withheld result cannot contain a forced completion');canonical.edits=[];
  return{canonical,proof:{...proof,withheld:true,exactReconstruction:null}};
 }
 assert(corrected.trim().length>0,'a complete result must supply its sentence');
 if(corrected===original){canonical.edits=[];return{canonical,proof:{...proof,withheld:false,exactReconstruction:true}};}
 let start=0;while(start<original.length&&start<corrected.length&&original[start]===corrected[start])start++;
 let oldEnd=original.length,newEnd=corrected.length;
 while(oldEnd>start&&newEnd>start&&original[oldEnd-1]===corrected[newEnd-1]){oldEnd--;newEnd--;}
 let before=original.slice(start,oldEnd),after=corrected.slice(start,newEnd);
 while(!before||occurrences(original,before)!==1||!before.isWellFormed()||!after.isWellFormed()){
  assert(before.length<180&&after.length<180,'projection exceeds frozen edit-span limit');
  if(start>0){assert.equal(original[start-1],corrected[start-1]);start--;}
  else{assert(oldEnd<original.length&&newEnd<corrected.length,'no exact unique context');assert.equal(original[oldEnd],corrected[newEnd]);oldEnd++;newEnd++;}
  before=original.slice(start,oldEnd);after=corrected.slice(start,newEnd);
 }
 assert(before.length<=180&&after.length<=180,'projection exceeds frozen edit-span limit');
 const rebuilt=original.slice(0,start)+after+original.slice(oldEnd);assert.equal(rebuilt,corrected);
 canonical.edits=[{before,after}];
 return{canonical,proof:{...proof,withheld:false,exactReconstruction:true,originalStartUtf16:start,originalEndUtf16:oldEnd,
  originalAnchorOccurrences:occurrences(original,before),canonicalEditCount:1}};
}
