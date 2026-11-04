/** Keep transmission and privacy visible before either feedback action. */
export function AiUseNotice({ grammar = false }: { grammar?: boolean }) {
  return <><p className="small-note ai-use-notice">요청하면 문장과 {grammar ? '수업 목표를' : '단어·뜻을'} 선택한 OpenAI 모델에 보내요. API 데이터는 기본적으로 모델 학습에 쓰이지 않지만 보관·안전 점검 정책이 적용돼요. 개인정보는 넣지 마세요.</p>
    <p className="small-note">응답이 끊기면 같은 요청을 다시 실행하지 않고 결과만 확인해요. 사이트에서 결과는 24시간 복구할 수 있고, 중복 방지용 요청 정보는 7일간 유지해요. 만료한 내용은 다음 접근 때 삭제해요.</p></>;
}
