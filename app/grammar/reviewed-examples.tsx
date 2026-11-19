import {HaruParagraph} from '../haru-content';
import { REVIEWED_EXAMPLES } from '@/lib/grammar/content-v4';
import { exampleReviewSources } from '@/lib/grammar/review-sources';
import type { LessonId } from '@/lib/grammar/model';
import { SentenceStructureView } from '../sentence-structure';
import { Speak } from '../ui';

export function ReviewedExamples({ id }: { id: LessonId }) {
  return <div className="grammar-reviewed-examples">
    <HaruParagraph className="small-note">학습용 예문 분석이에요. 이 예문에만 적용돼요.</HaruParagraph>
    {REVIEWED_EXAMPLES[id].map(example => <div className="grammar-example" key={example.id} data-reviewed-example={example.id}>
      <HaruParagraph lang="en">{example.sentence}</HaruParagraph><Speak text={example.sentence} />
      <SentenceStructureView structure={example.structure} origin="curriculum" />
      <details className="notes-details"><summary>예문 검토 근거</summary><ul>{exampleReviewSources(example.id).map(source =>
        <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><HaruParagraph className="small-note">{source.summary}</HaruParagraph></li>
      )}</ul></details>
    </div>)}
  </div>;
}
