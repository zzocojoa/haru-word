"use client";
import type { LearningViewProps } from "./types";
import { HelpDetails } from "../study-ui";
type LearningAsideProps = Pick<LearningViewProps, "loading" | "metrics">;
export function LearningAside({ loading, metrics }: LearningAsideProps) {
  return (
    <aside className="study-aside">
      <HelpDetails title="15분 학습 루틴" className="routine-panel">
        <div className="routine-list">
          {[
            ["01", "기억 깨우기", "이전 단어 확인 · 3분"],
            ["02", "오늘의 단어", "뜻과 표현 익히기 · 6분"],
            ["03", "스스로 떠올리기", "양방향 회상 · 3분"],
            ["04", "내 문장으로", "말하고 써 보기 · 3분"],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span>{n}</span>
              <p>
                <b>{t}</b>
                <small>{d}</small>
              </p>
            </div>
          ))}
        </div>
      </HelpDetails>
      <section className="progress-note">
        <div>
          <span>지금까지 배운 항목</span>
          <b>
            {loading ? "—" : metrics.officialLearned.toLocaleString()}
            <small> / 3,809</small>
          </b>
        </div>
        <div>
          <span>회상 독립 성공</span>
          <b>
            {loading
              ? "—"
              : metrics.measured
                ? Math.round((metrics.successes / metrics.measured) * 100) + "%"
                : "미측정"}
          </b>
        </div>
        <p className="small-note">
          미측정 제외 · 양방향 회상 기준
          {metrics.personalLearned > 0 &&
            ` 개인 추가 ${metrics.personalLearned}개도 학습했어요.`}
        </p>
      </section>
    </aside>
  );
}
