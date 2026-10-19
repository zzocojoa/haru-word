"use client";
import type { LearningViewProps } from "./types";
import { HelpDetails } from "../study-ui";
type LearningAsideProps = Pick<LearningViewProps, "loading" | "metrics">;
export function LearningAside({ loading, metrics }: LearningAsideProps) {
  return (
    <aside className="study-aside">
      <HelpDetails title="학습 순서 · 약 15분" className="routine-panel">
        <div className="routine-list">
          {[
            ["01", "기억 깨우기", "이전 단어 떠올리기"],
            ["02", "오늘의 단어", "뜻과 표현 익히기"],
            ["03", "스스로 떠올리기", "뜻과 영어 떠올리기"],
            ["04", "내 문장으로", "내 문장 쓰고 말하기"],
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
          <span>지금까지 학습한 단어·뜻</span>
          <b>
            {loading ? "—" : metrics.officialLearned.toLocaleString()}
            <small> / 3,809</small>
          </b>
        </div>
        <div>
          <span>도움 없이 떠올린 비율</span>
          <b>
            {loading
              ? "—"
              : metrics.measured
                ? Math.round((metrics.successes / metrics.measured) * 100) + "%"
                : "아직 확인 안 함"}
          </b>
        </div>
        <p className="small-note">
          확인한 항목만 집계 · 영어→뜻, 뜻→영어 기준
          {metrics.personalLearned > 0 &&
            ` 개인 추가 ${metrics.personalLearned}개도 학습했어요.`}
        </p>
      </section>
    </aside>
  );
}
