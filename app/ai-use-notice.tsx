/** Keep transmission and privacy visible before either feedback action. */
export function AiUseNotice({ grammar = false }: { grammar?: boolean }) {
  return <p className="small-note ai-use-notice">AI 요청 시 문장과 {grammar ? '수업 목표를' : '단어·뜻을'} Google에 보내요. 응답 실패 시 Groq에도 보내요. 개인정보는 넣지 마세요. Google 무료 API의 입력·응답은 서비스 개선에 쓰일 수 있어요.</p>;
}
