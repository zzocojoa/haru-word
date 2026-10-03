import { STRUCTURE_ROLES, type SentenceStructure } from '@/lib/sentence-structure';

export function SentenceStructureView({ structure, origin = 'ai' }: { structure?: SentenceStructure; origin?: 'ai' | 'curriculum' }) {
  if (!structure) return <p className="small-note">이전 교정에는 문장 구조 설명이 없어요.</p>;
  if (structure.status === 'unavailable') return <p className="small-note">문장 구조를 설명하기 어려워요. {structure.note}</p>;
  return <figure className="sentence-structure">
    <figcaption>{origin === 'curriculum' ? '교재 예문 분석' : '교정문 구조'}</figcaption>
    <ol className="sentence-structure-parts" aria-label={origin === 'curriculum' ? '교재 예문을 순서대로 나눈 역할' : '교정문을 순서대로 나눈 역할'}>
      {structure.parts.map((part, index) => <li key={index} data-role={part.role}>
        <b lang="en">{part.text}</b>
        <span className="structure-role"><span lang="en">{part.role}</span> · {STRUCTURE_ROLES[part.role].ko} <span lang="en">{STRUCTURE_ROLES[part.role].en}</span></span>
      </li>)}
    </ol>
    <p className="structure-translation">{structure.translation}</p>
    {structure.note && <p className="small-note">{structure.note}</p>}
    <details className="structure-explanations notes-details"><summary>부분별 설명</summary>
      <dl>{structure.parts.map((part,index) => <div key={index}><dt><span lang="en">{part.text}</span> · {part.role}</dt><dd>{part.explanation}</dd></div>)}</dl>
    </details>
  </figure>;
}
