/** Explain the current feedback action and the site's result retention. */
export function AiUseNotice({ grammar = false, recovery = false }: { grammar?: boolean; recovery?: boolean }) {
  return <>
    {recovery ? (
      <p className="small-note ai-use-notice">이 버튼은 지난 요청의 결과만 확인해요. 복구 기간이 끝나면 다음 요청에 사용량이 발생할 수 있어요.</p>
    ) : (
      <p className="small-note ai-use-notice">요청하면 {grammar ? '문장·수업 목표와 추가한 문맥을' : '한국어·영어 문장과 단어·뜻을'} 선택한 OpenAI 모델에 보내요. API 데이터는 기본적으로 모델 학습에 쓰이지 않지만 보관·안전 점검 정책이 적용돼요. 개인정보는 넣지 마세요.</p>
    )}
    <details className="notes-details">
      <summary>AI 결과 보관 안내</summary>
      <p className="small-note">결과는 사이트에서 24시간 복구할 수 있어요. 중복 방지 요청 정보는 7일간 유지하고, 만료한 내용은 다음 접근 때 삭제해요.</p>
    </details>
  </>;
}
