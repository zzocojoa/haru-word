"use client";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_DAILY_GOAL } from "@/lib/learning";
import { dailyAllocationRule } from "@/lib/learning/daily-allocation";
import { LevelSelect } from "../ui";
import type { LearningViewProps } from "./types";
import { HelpDetails } from "../study-ui";
import { DiagnosticDownload } from "./diagnostic-download";
type SettingsDialogProps = Pick<
  LearningViewProps,
  | "settings"
  | "setSettings"
  | "state"
  | "changeLevel"
  | "busy"
  | "changeGoal"
  | "save"
  | "beginAssessment"
> & { availability: ReactNode };
export function SettingsDialog({
  settings,
  setSettings,
  state,
  changeLevel,
  busy,
  changeGoal,
  save,
  beginAssessment,
  availability,
}: SettingsDialogProps) {
  return (
    <Dialog open={settings} onOpenChange={setSettings}>
      <DialogContent className="settings-dialog framed-dialog">
        <DialogHeader>
          <DialogTitle>학습 설정</DialogTitle>
          <DialogDescription>
            변경하면 계정에 바로 저장돼요.
          </DialogDescription>
        </DialogHeader>
        <div className="dialog-scroll">
        {availability}
        <label>
          학습 수준
          <LevelSelect
            value={state.settings.level}
            onChange={changeLevel}
            disabled={busy}
          />
        </label>
        <label>
          하루 목표 단어 수
          <Select
            value={String(state.settings.dailyGoal)}
            disabled={busy}
            onValueChange={(v) => changeGoal(Number(v))}
          >
            <SelectTrigger aria-label="하루 목표">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: MAX_DAILY_GOAL }, (_, i) => i + 1).map(
                (n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}개{n === 3 ? " · 기본 목표" : ""}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </label>
        <p className="small-note goal-allocation" role="status">{dailyAllocationRule(state.settings.dailyGoal, state.settings.newWordsPaused)} {state.settings.newWordsPaused ? '복습 후보가 없으면 새 단어를 배정하지 않아요.' : '한쪽이 부족하면 다른 쪽으로 채워요.'}</p>
        <label className="check-label">
          <input
            type="checkbox"
            checked={!!state.settings.newWordsPaused}
            disabled={busy}
            onChange={(e) =>
              save({
                ...state,
                settings: {
                  ...state.settings,
                  newWordsPaused: e.target.checked,
                },
              })
            }
          />{" "}
          신규 단어 잠시 쉬기 · 복습만 배정
        </label>
        <label>
          주간 점검 요일
          <Select
            value={String(state.settings.reviewDay ?? 0)}
            disabled={busy}
            onValueChange={(v) =>
              save({
                ...state,
                settings: { ...state.settings, reviewDay: Number(v) },
              })
            }
          >
            <SelectTrigger aria-label="주간 점검 요일">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                <SelectItem value={String(i)} key={day}>
                  {day}요일
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <HelpDetails title="목표 수를 바꾸면?"><p>1~{MAX_DAILY_GOAL}개 · 기본 3개. 늘린 목표는 회차를 마친 뒤 추가할 수 있어요. 줄여도 이미 배정한 단어와 기록은 유지해요.</p></HelpDetails>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            setSettings(false);
            void beginAssessment();
          }}
        >
          친숙도 다시 확인하기
        </button>
        <HelpDetails title="저장·날짜·AI 안내"><p>계정별 서버 저장 · 한국 시간 기준. AI 버튼을 누르면 Google을 먼저 사용하고, 응답 실패 시 Groq로 자동 전환해요. 결과에 사용한 제공사를 표시해요. 두 계정은 Free 상태를 유지해 주세요.</p></HelpDetails>
        <details className="notes-details">
          <summary>문제가 생겼을 때</summary>
          <p className="small-note">최근 연결 상태와 버튼 대기 이유를 파일로 받아요. 답안·문장·계정 정보·API 키는 포함하지 않으며 자동 전송하지 않아요. 새로고침하면 초기화됩니다.</p>
          <DiagnosticDownload />
        </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}
