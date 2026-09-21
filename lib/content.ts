import type { Content, Progress } from './learning';

export function resolveCardContent(base:Content,p?:Progress):Content {
 const differentSense=!!p?.meaning&&p.meaning.trim()!==base.meaning.trim();
 // Catalog corrections must not attach a new sense's examples to an older saved meaning.
 const fallback=differentSense?{expression:'',example:'',translation:''}:base;
 const edited=!!p&&((p.example!==undefined&&p.example!==base.example)||(p.translation!==undefined&&p.translation!==base.translation));
 const noExample=differentSense&&!p?.example&&!p?.translation&&!p?.personal;
 return {...base,meaning:p?.meaning??base.meaning,expression:p?.expression??fallback.expression,example:p?.example??fallback.example,translation:p?.translation??fallback.translation,
  ...(edited?{source:p?.personal?'개인 추가 예문':'내가 수정한 예문',attribution:undefined,url:undefined}:{}),
  ...(noExample?{source:'이 뜻의 예문은 사전에서 확인해 주세요.',attribution:undefined,url:undefined}:{})};
}
