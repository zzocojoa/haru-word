"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
export function SourceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="source-dialog framed-dialog">
        <DialogHeader>
          <DialogTitle>학습 방식과 자료 출처</DialogTitle>
          <DialogDescription>
            공식 목록과 학습을 돕는 풀이·예문을 구분합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="dialog-scroll">
        <h3>전체 목록</h3>
        <p>
          첨부 American Oxford 3000 by CEFR level PDF 13쪽의 표제어 3,000개,
          원문 행 3,308개를 추출했습니다. 품사와 수준을 분리한 학습 항목은
          3,809개입니다. 공식 목록의 수준을 그대로 사용합니다.
        </p>
        <a
          className="source-link"
          href="/sources/oxford-source.pdf"
          target="_blank"
          rel="noreferrer"
        >
          첨부 원문 PDF 보기
        </a>
        <h3>한국어 풀이와 예문</h3>
        <p>
          한국어 참고 풀이: LexiSnap Open English-Korean Dictionary를 바탕으로
          일부 뜻을 수정했습니다. 이 사전의 CEFR 등급은 사용하지 않습니다.
        </p>
        <a
          className="source-link"
          href="https://github.com/jhseo1211/open-english-korean-dict"
          target="_blank"
          rel="noreferrer"
        >
          사전 출처 · CC BY-SA 4.0
        </a>
        <p>
          ‘Tatoeba 참고 예문’은 문장별 기여자와 원문 링크를 표시합니다. ‘학습용
          작성 예문’은 이 학습 도구를 위해 작성했으며 Oxford 사전 예문이
          아닙니다. 뜻과 용례는 연결된 사전으로 확인하고 수정할 수 있습니다.
        </p>
        <p>
          ‘함께 익힐 표현’의 한국어 뜻은 3,809개 기본 항목에 별도로 작성한 학습용
          해석입니다. 사전 공식 번역이 아니며 학습 중 API 호출 없이 표시됩니다.
          표현을 바꾸면 새 표현에 맞는 해석을 직접 입력할 수 있습니다.
        </p>
        <a
          className="source-link"
          href="https://www.manythings.org/anki/"
          target="_blank"
          rel="noreferrer"
        >
          Tatoeba 문장 자료 · CC BY 2.0
        </a>
        <h3>기록과 점검</h3>
        <p>하루 목표의 절반 이상을 새 단어로, 나머지를 복습으로 배정합니다. 목표가 1개면 학습한 날마다 번갈아 고릅니다. 후보 부족 시 다른 쪽으로 채우며, ‘신규 단어 쉬기’에서는 복습만 배정합니다. 이는 새 단어 학습 기회를 위한 이 앱의 운영 규칙입니다.</p>
        <p>
          친숙도는 뜻의 익숙함이며 정식 CEFR 판정이 아닙니다. 영어→뜻, 뜻→영어,
          문장 사용을 따로 기록합니다. 미측정 항목은 성공이나 실패로 계산하지
          않습니다. 주간에는 목표 전체, 월말에는 배운 단어 전체를 확인합니다.
        </p>
        <p>
          AI 문장 점검을 누르면 Google Gemini를 먼저 사용하고, 한도·연결·응답 오류가 있으면 Groq에 같은 문장과 학습 목표를 보내 한 번 더 점검합니다.
          Google 무료 API의 입력·응답은 서비스 개선에 사용될 수 있습니다. Groq의 데이터 보관은 해당 서비스 설정·정책을 따릅니다.
          두 서비스 모두 무료 계정 상태를 유지해야 하며, 앱은 결제 설정이나 유료 등급을 변경하지 않습니다. AI 의견은 참고 자료이며, 문장 평가 버튼은 학습자의 자기
          평가입니다. 서비스는 Oxford University Press의 공식 제품이 아닙니다.
        </p>
        <a
          className="source-link"
          href="/sources/content-attribution.txt"
          target="_blank"
          rel="noreferrer"
        >
          데이터 변경·라이선스 안내
        </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
