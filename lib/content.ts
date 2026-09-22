import type { Content, Progress } from './learning';

// A phrase gloss belongs to both its exact English phrase and its learning sense.
// Missing legacy fields may inherit a match; an explicitly cleared field must not.
export function withExpressionTranslation<T extends {meaning: string; expression: string; expressionTranslation?: string}>(
 content:T,...candidates:(Partial<Content>|undefined)[]
):T {
 if(content.expressionTranslation!==undefined||!content.expression.trim())return content;
 const match=candidates.find(candidate=>candidate?.expressionTranslation!==undefined
  &&candidate.expression?.trim()===content.expression.trim()
  &&candidate.meaning?.trim()===content.meaning.trim());
 return match?{...content,expressionTranslation:match.expressionTranslation}:content;
}

export function resolveCardContent(base:Content,p?:Progress):Content {
 if(!p)return base;
 const differentSense=!!p?.meaning&&p.meaning.trim()!==base.meaning.trim();
 // Catalog corrections must not attach a new sense's examples to an older saved meaning.
 const fallback=differentSense?{expression:'',example:'',translation:''}:base;
 const edited=!!p&&((p.example!==undefined&&p.example!==base.example)||(p.translation!==undefined&&p.translation!==base.translation));
 const noExample=differentSense&&!p?.example&&!p?.translation&&!p?.personal;
 return withExpressionTranslation({...base,meaning:p?.meaning??base.meaning,expression:p?.expression??fallback.expression,expressionTranslation:p?.expressionTranslation,example:p?.example??fallback.example,translation:p?.translation??fallback.translation,
  ...(edited?{source:p?.personal?'개인 추가 예문':'내가 수정한 예문',attribution:undefined,url:undefined}:{}),
  ...(noExample?{source:'이 뜻의 예문은 사전에서 확인해 주세요.',attribution:undefined,url:undefined}:{})},base);
}
