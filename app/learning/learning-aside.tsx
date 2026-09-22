"use client";
import type { LearningController } from "./use-learning-controller";
type LearningAsideProps = Pick<LearningController, "loading" | "metrics">;
export function LearningAside({ loading, metrics }: LearningAsideProps) {
  return (
    <aside className="study-aside">
      <section className="routine-panel">
        <p className="eyebrow">LITTLE BY LITTLE</p>
        <div className="routine-minutes">
          15<span>분</span>
        </div>
        <h2>기억에 남는 하루의 루틴</h2>
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
        <p className="routine-note">
          완벽하게 외우기보다,
          <br />
          다시 꺼내 보는 경험을 쌓아요.
        </p>
      </section>
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
        <p>
          뜻별로 확인한 두 방향의 결과만 계산해요.
          {metrics.personalLearned > 0 &&
            ` 개인 추가 ${metrics.personalLearned}개도 학습했어요.`}
        </p>
      </section>
    </aside>
  );
}
