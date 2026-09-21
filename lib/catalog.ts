import rawWords from "@/data/words.json";
import rawContent from "@/data/content.json";
import { senseProgress, type RecordItem, type Word, type Content, type Progress } from "./learning";
export const WORDS=rawWords as Word[];
export const WORD_MAP=new Map(WORDS.map(w=>[w.id,w]));
export const CONTENT=rawContent as Record<string,Content>;
export function cardContent(id:string,p?:Progress):Content {const base=CONTENT[id]||{meaning:"",expression:"",example:"",translation:"",source:"개인 추가"};const edited=!!p&&((p.example!==undefined&&p.example!==base.example)||(p.translation!==undefined&&p.translation!==base.translation));return {...base,meaning:p?.meaning??base.meaning,expression:p?.expression??base.expression,example:p?.example??base.example,translation:p?.translation??base.translation,...(edited?{source:p?.personal?"개인 추가 예문":"내가 수정한 예문",attribution:undefined,url:undefined}:{})};}
export function dictionaryUrl(word:string){return "https://www.oxfordlearnersdictionaries.com/search/american_english/direct/?q="+encodeURIComponent(word==="a, an"?"a":word);}
export function koreanDictionaryUrl(word:string){return "https://en.dict.naver.com/#/search?query="+encodeURIComponent(word==="a, an"?"a":word);}

export function studyContent(id:string,record:RecordItem|undefined,p?:Progress):Content{
 if(record?.material)return record.material;
 if(!record)return cardContent(id,p);
 const sense=senseProgress(p,record.meaning);const base=CONTENT[id];
 if(base?.meaning.trim()===record.meaning.trim()||sense.example!==undefined)return cardContent(id,{...sense,meaning:record.meaning});
 return {meaning:record.meaning,expression:"",example:"",translation:"",source:"이 뜻의 예문은 사전에서 확인해 주세요."};
}
