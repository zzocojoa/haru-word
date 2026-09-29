import { POS } from '@/lib/learning';
import { POS_ENGLISH, SENTENCE_ROLES } from '@/lib/grammar-terms';

export function PartOfSpeechLabel({ pos }: { pos: string }) {
  return <span className="pos-label">{POS[pos] || pos}{POS[pos] && <> <span className="pos-code" lang="en">({pos})</span></>}</span>;
}

/** Optional reading help only: no answer, progress or persistence callbacks. */
export function GrammarTermsHelp({ pos }: { pos?: string }) {
  return <details className="grammar-terms notes-details">
    <summary>품사·S/V/O 뜻 보기</summary>
    {pos && POS[pos] && <p className="grammar-current-term">이 단어의 품사: <b>{POS[pos]}</b> · <span lang="en">{POS_ENGLISH[pos]}{POS_ENGLISH[pos] !== pos && ` (${pos})`}</span></p>}
    <p>품사는 단어의 종류, S·V·O는 문장 속 역할을 나타내는 기호예요.</p>
    <dl className="grammar-term-list">
      {SENTENCE_ROLES.map(role => <div key={role.code}>
        <dt><b lang="en">{role.code}</b> {role.ko} <span lang="en">{role.en}</span></dt>
        <dd>{role.meaning}</dd>
      </div>)}
    </dl>
    <figure className="grammar-role-example">
      <figcaption>문장에 대입하면</figcaption>
      <div className="grammar-role-tokens">
        <span><b lang="en">I</b><span>S · 주어</span></span>
        <span><b lang="en">like</b><span>V · 동사</span></span>
        <span><b lang="en">music.</b><span>O · 목적어</span></span>
      </div>
      <p>나는 음악을 좋아해요.</p>
      <p><span lang="en">music</span>은 <b>명사(n.)</b>이면서 이 문장의 <b>목적어(O)</b>예요.</p>
    </figure>
    <p><span lang="en">She is kind.</span>에서 <span lang="en">kind</span>는 <b>형용사(adj.)</b>이며, 주어의 성질을 설명하는 <b>보어(C)</b>예요.</p>
    <p className="small-note">모든 문장이 S+V+O는 아니에요. <span lang="en">I sleep.</span>은 S+V예요.</p>
    <details className="grammar-term-extra"><summary>M과 수식어</summary>
      <p><b lang="en">M · Modifier</b>는 수식어를 뜻하는 표기로, 시간·장소·방법 등의 설명을 더해요. <span lang="en">I work here.</span>의 <span lang="en">here</span>는 장소를 더하는 부사(adv.)예요.</p>
      <p className="small-note">수식어 표기는 교재마다 달라요. 부사어를 A(<span lang="en">Adverbial</span>)로 표시하기도 해요.</p>
    </details>
    <details className="grammar-term-extra"><summary>품사 표기 15개</summary>
      <dl className="grammar-pos-list">{Object.entries(POS).map(([code, ko]) => <div key={code}>
        <dt>{ko}</dt><dd><span lang="en">{code}</span>{POS_ENGLISH[code] !== code && <> · <span lang="en">{POS_ENGLISH[code]}</span></>}</dd>
      </div>)}</dl>
      <p className="small-note">Oxford 목록의 학습 표기예요. 관사는 한정사의 한 종류이며, 조동사는 동사와 연결해 배워요. <span lang="en">v.</span>는 사전의 품사 표기, <span lang="en">V</span>는 문장 분석 기호예요.</p>
    </details>
    <p className="small-note">학습용 작성 예문 · <a href="https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/clause-structure-verb-patterns" target="_blank" rel="noreferrer">문장 구조 참고</a></p>
  </details>;
}
