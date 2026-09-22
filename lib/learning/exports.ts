import {
  type State,
  type Word,
  FAMILIARITY_TEXT,
  RESULT_TEXT,
  SENTENCE_TEXT,
} from "./model.ts";
import { emptyRecord, nextAction } from "./outcomes.ts";
import { entryIdFor } from "./targets.ts";

export function exportLog(state: State, words: Word[]): string {
  const map = new Map(words.map((w) => [w.id, w]));
  const rows = [
    [
      "학습일",
      "종류",
      "단어",
      "품사",
      "수준",
      "학습 뜻",
      "처음 표시",
      "영어→뜻",
      "뜻→영어",
      "문장 상태",
      "말하기",
      "내 문장",
      "보완점",
      "재시도 영어→뜻",
      "재시도 뜻→영어",
      "다음 할 일",
      "AI 검토 원문",
      "AI 교정 제안",
      "AI 설명",
      "회차 시작일",
      "실제 학습일",
      "마지막 연습일",
    ],
  ];
  for (const s of Object.values(state.sessions).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    for (const id of s.ids) {
      const w = map.get(entryIdFor(s, id));
      const r = s.records[id] || emptyRecord();
      rows.push([
        r.lastPracticedOn || r.learnedOn || s.date,
        s.kind,
        w?.word || id,
        w?.pos || "",
        w?.personal ? "개인 추가" : w?.level || "",
        r.meaning,
        r.familiarity ? FAMILIARITY_TEXT[r.familiarity] : "미표시",
        RESULT_TEXT[r.en],
        RESULT_TEXT[r.ko],
        SENTENCE_TEXT[r.sentenceStatus],
        r.spoken ? "말해 봄" : "미측정",
        r.sentence,
        r.notes,
        RESULT_TEXT[r.retryEn || "unmeasured"],
        RESULT_TEXT[r.retryKo || "unmeasured"],
        nextAction(r, s),
        r.aiFeedback?.original || "",
        r.aiFeedback?.correctedSentence || "",
        r.aiFeedback?.explanation || "",
        s.date,
        r.learnedOn || "기존 기록·미확인",
        r.lastPracticedOn || "기존 기록·미확인",
      ]);
    }
  }
  return (
    "\ufeff" +
    rows
      .map((row) =>
        row
          .map(
            (x) =>
              '"' +
              (/^(?:[\s\ufeff]*[=+@\-]|[\t\r\n])/.test(x) ? "'" : "") +
              x.replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}

export function exportTutor(state: State, words: Word[]): string {
  const latest = Object.values(state.sessions).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
  const snapshot = {
    ...state,
    sessions: latest ? { [latest.id]: latest } : {},
  };
  return `한국어로 짧게 설명하는 성인 기초 영어 어휘 튜터로 진행해 주세요.
학습 목록: American Oxford 3000 by CEFR level. 공식 단어·품사·수준은 함께 제공한 목록에서 확인하세요. 확인할 자료가 없으면 목록을 요청하고 공식 단어라고 추측하지 마세요.
선택 수준: ${state.settings.level} (정식 CEFR 판정 아님). 하루 목표: 이월 포함 ${state.settings.dailyGoal}개, 약 15분.
친숙도 미확인 시 목록 여러 부분의 20개를 한 개씩 보여 주고 ✓✓ 안다 / ✓ 불확실 / ? 처음으로 확인하세요. 미완료 → ✓ → ? 순으로 고르세요.
한 단어의 뜻 하나·품사·유용한 표현·짧은 예문과 해석·사전 링크를 제공하세요. 직접 만든 예문은 ‘학습용 작성 예문’으로 표시하세요.
영어→한국어, 한국어→영어, 문장을 한 문제씩 진행하고, 정답을 숨긴 채 답을 기다리세요. 다른 유효한 정답도 인정하세요.
도움을 받은 답과 독립 성공을 구분하고 다른 단어 2~3개 뒤 재시도하세요. 문법 오류만 있으면 ‘문장 보완’이며 친숙도를 낮추지 마세요.
주간은 그 주 목표 전체, 월말은 그달 학습 전체를 확인하세요. 누락을 통과로 처리하지 말고 미측정으로 남기세요.
‘오늘 종료’ 요청 시 학습일 | 단어·품사·뜻 | 처음 표시 | 영어→뜻 | 뜻→영어 | 내 문장·보완점 | 다음 할 일을 출력하세요. 실제 타이머 없이 경과 시간을 측정했다고 말하지 마세요.
이 파일은 자동 저장·알림·외부 AI 연결을 설정하지 않습니다. 아래 기록만 사용하고 과거 성적을 추측하지 마세요.

공식 목록 파일: 사이트의 /sources/learning-data.json (아래 해당 단어 정보와 별도로 함께 제공할 수 있습니다.)
마지막 회차의 단어 정보:
${JSON.stringify(
  words.filter((w) =>
    latest?.ids.some((id) => entryIdFor(latest, id) === w.id),
  ),
  null,
  2,
)}

마지막 학습 기록:
${exportLog(snapshot, words)}`;
}
