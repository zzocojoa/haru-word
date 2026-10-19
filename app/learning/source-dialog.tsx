"use client";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SheetDialog as Dialog, SheetDialogContent as DialogContent } from '../sheet-dialog';
export function SourceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog navigationKey="app.about" open={open} onOpenChange={onOpenChange}>
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
          American Oxford 3000의 단어 3,000개를 품사·수준별로 나눠 3,809개 항목으로 제공해요. 수준은 공식 목록을 따라요.
        </p>
        <a
          className="source-link"
          href="/sources/oxford-source.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Oxford 원문 PDF 보기
        </a>
        <details className="notes-details"><summary>원문·데이터 안내</summary><p>American Oxford 3000 by CEFR level PDF 13쪽에서 표제어 3,000개와 원문 행 3,308개를 추출했어요. 품사와 수준을 나눈 학습 항목은 3,809개예요.</p></details>
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
          표현의 한국어 해석은 학습용으로 작성했으며 사전의 공식 번역이 아니에요. 표현을 바꾸면 새 해석을 직접 입력할 수 있어요.
        </p>
        <a
          className="source-link"
          href="https://www.manythings.org/anki/"
          target="_blank"
          rel="noreferrer"
        >
          Tatoeba 문장 자료 · CC BY 2.0
        </a>
        <h3>미국식 발음 기호</h3>
        <p>현재 단어의 뜻·품사와 일치하는 미국식 IPA를 표시해요. Wiktionary와 CMU 자료를 교차 대조하고 일부 항목을 사전 원문으로 추가 확인한 편집본이며, Oxford 공식 발음 데이터는 아니에요.</p>
        <p>Wiktionary contributors의 자료를 선별하고 표기를 정리했어요. 해당 파생 부분은 CC BY-SA 4.0으로 제공해요. 기기 음성은 표시된 IPA와 다를 수 있어요.</p>
        <a className="source-link" href="/sources/american-ipa.json" target="_blank" rel="noreferrer">발음 데이터·출처·라이선스</a>
        <h3>기록과 점검</h3>
        <p>하루 목표는 새 단어를 절반 이상, 나머지는 복습으로 채워요. 목표가 1개면 학습한 날마다 번갈아 골라요. 후보가 부족하면 다른 쪽으로 채우며, ‘새 단어 쉬기’ 중에는 복습만 해요.</p>
        <p>
          친숙도는 뜻이 얼마나 익숙한지 확인하는 자기평가이며 정식 수준 판정은 아니에요. 영어→뜻, 뜻→영어, 문장 사용은 따로 기록해요. 아직 확인하지 않은 항목은 성공·실패에 넣지 않아요. 주간에는 목표 단어 전체, 월말에는 배운 단어 전체를 확인해요.
        </p>
        <p>
          AI 의견을 요청하면 문장과 학습 목표를 Google Gemini에 보내요. 한도·연결·응답 오류가 있으면 Groq에 한 번 더 보내요. Google 무료 API의 입력·응답은 서비스 개선에 사용될 수 있고, Groq의 보관은 해당 서비스 설정·정책을 따라요. AI 의견은 참고 자료이며 문장 평가 버튼은 자기평가예요. 하루단어는 Oxford University Press의 공식 제품이 아니에요.
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
