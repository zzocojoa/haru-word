/** Keep transmission and privacy visible before either feedback action. */
export function AiUseNotice({ grammar = false }: { grammar?: boolean }) {
  return <p className="small-note ai-use-notice">Google 우선, 실패 시 Groq로 문장·{grammar ? '수업 목표' : '단어·뜻'} 전송. 개인정보는 빼 주세요. Google 무료 API의 입력·응답은 서비스 개선에 쓰일 수 있어요.</p>;
}
