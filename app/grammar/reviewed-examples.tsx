import { REVIEWED_EXAMPLES } from '@/lib/grammar/content-v4';
import { exampleReviewSources } from '@/lib/grammar/review-sources';
import type { LessonId } from '@/lib/grammar/model';
import { SentenceStructureView } from '../sentence-structure';
import { Speak } from '../ui';

export function ReviewedExamples({ id }: { id: LessonId }) {
  return <div className="grammar-reviewed-examples">
    <p className="small-note">공식 문법 자료와 대조한 작성 예문 · 이 예문에만 적용되는 분석이에요.</p>
    {REVIEWED_EXAMPLES[id].map(example => <div className="grammar-example" key={example.id} data-reviewed-example={example.id}>
      <p lang="en">{example.sentence}</p><Speak text={example.sentence} />
      <SentenceStructureView structure={example.structure} origin="curriculum" />
      <details className="notes-details"><summary>예문 검토 근거</summary><ul>{exampleReviewSources(example.id).map(source =>
        <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p className="small-note">{source.summary}</p></li>
      )}</ul></details>
    </div>)}
  </div>;
}
