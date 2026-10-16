import rawContent from "@/data/content.json";
import { senseProgress, type RecordItem, type Content, type Progress } from "./learning";
import { resolveCardContent, withExpressionTranslation } from './content';
export { WORDS, WORD_MAP, dictionaryUrl, koreanDictionaryUrl } from './catalog-basics';
export const CONTENT=rawContent as Record<string,Content>;
export function cardContent(id:string,p?:Progress):Content {return resolveCardContent(CONTENT[id]||{meaning:"",expression:"",example:"",translation:"",source:"개인 추가"},p);}

export function studyContent(id:string,record:RecordItem|undefined,p?:Progress):Content{
 if(record?.material){
  if(record.material.meaning.trim()!==record.meaning.trim())return record.material;
  return withExpressionTranslation(record.material,senseProgress(p,record.meaning),CONTENT[id]);
 }
 if(!record)return cardContent(id,p);
 const sense=senseProgress(p,record.meaning);const base=CONTENT[id];
 if(base?.meaning.trim()===record.meaning.trim()||sense.example!==undefined)return cardContent(id,{...sense,meaning:record.meaning});
 return {meaning:record.meaning,expression:"",example:"",translation:"",source:"이 뜻의 예문은 사전에서 확인해 주세요."};
}
