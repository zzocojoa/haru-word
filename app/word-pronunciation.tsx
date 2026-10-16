"use client";
import {ExternalLink} from 'lucide-react';
import type {Word} from '@/lib/learning';
import {dictionaryUrl} from '@/lib/catalog-basics';
import {familyMeaningNote, pronunciationFor} from '@/lib/pronunciation';
import {Speak} from './ui';

export function WordPronunciation({word,meaning}:{word:Word;meaning:string}) {
  const pronunciation = pronunciationFor(word,meaning);
  const familyNote = familyMeaningNote(word.word);
  return <div className="word-pronunciation">
    {pronunciation.kind==='reviewed' ? <>
      <div className="pronunciation-variants">{pronunciation.guide.variants.map(variant=>
        <span key={variant.ipa}><span lang="en" className="phonetic">{variant.ipa}</span> · {variant.usage}</span>)}</div>
      <p className="small-note">{pronunciation.guide.note}</p>
      <a className="dictionary-audio" href={pronunciation.guide.url} target="_blank" rel="noreferrer">미국식 사전 발음 듣기 <ExternalLink size={14}/></a>
    </> : pronunciation.kind==='dictionary' ? <>
      <p className="small-note">품사·뜻·시제에 따라 발음이 달라요. 이 뜻의 발음은 사전에서 확인해 주세요.</p>
      <a className="dictionary-audio" href={dictionaryUrl(word.word)} target="_blank" rel="noreferrer">사전에서 발음 확인 <ExternalLink size={14}/></a>
    </> : <Speak text={word.word} dictionaryHref={dictionaryUrl(word.word)} showHelpInitially/>}
    {familyNote&&<p className="small-note">{familyNote}</p>}
  </div>;
}
