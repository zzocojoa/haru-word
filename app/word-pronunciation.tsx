"use client";
import {ExternalLink} from 'lucide-react';
import type {Word} from '@/lib/learning';
import {dictionaryUrl} from '@/lib/catalog-basics';
import {familyMeaningNote, pronunciationFor} from '@/lib/pronunciation';
import {resolveWordIpa} from '@/lib/american-ipa';
import {Speak} from './ui';

type WordPronunciationProps = {word:Word;meaning:string};

// Text only: safe inside the image card's flip button. Controls stay outside it.
export function WordIpa({word,meaning}:WordPronunciationProps) {
  const variants = resolveWordIpa(word,meaning);
  if (!variants) return null;
  return <span className="word-ipa">
    <span className="ipa-label">미국식</span>
    <span className="pronunciation-variants">{variants.map(([ipa,usage])=>
      <span key={`${ipa}:${usage}`}>{variants.length>1&&<span className="ipa-usage">{usage} </span>}<span lang="en-US" className="phonetic">{ipa}</span></span>)}</span>
  </span>;
}

export function WordPronunciation({word,meaning,showIpa=true}:WordPronunciationProps&{showIpa?:boolean}) {
  const pronunciation = pronunciationFor(word,meaning);
  const familyNote = familyMeaningNote(word.word);
  return <div className="word-pronunciation">
    {showIpa&&<WordIpa word={word} meaning={meaning}/>}
    {pronunciation.kind==='reviewed' ? <>
      <p className="small-note">{pronunciation.guide.note}</p>
      <a className="dictionary-audio" href={pronunciation.guide.url} target="_blank" rel="noreferrer">미국식 사전 발음 듣기 <ExternalLink size={14}/></a>
    </> : pronunciation.kind==='dictionary' ? <>
      <p className="small-note">품사·뜻·시제에 따라 발음이 달라요. 이 뜻의 발음은 사전에서 확인해 주세요.</p>
      <a className="dictionary-audio" href={dictionaryUrl(word.word)} target="_blank" rel="noreferrer">사전에서 발음 확인 <ExternalLink size={14}/></a>
    </> : <Speak text={word.word} dictionaryHref={dictionaryUrl(word.word)} showHelpInitially/>}
    {familyNote&&<p className="small-note">{familyNote}</p>}
  </div>;
}
