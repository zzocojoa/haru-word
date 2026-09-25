"use client";
import type { ReactNode } from "react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SheetDialog as Dialog, SheetDialogContent as DialogContent } from '../sheet-dialog';
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
    <Dialog navigationKey="app.settings" open={settings} onOpenChange={setSettings}>
      <DialogContent className="settings-dialog framed-dialog">
        <DialogHeader>
          <DialogTitle>학습 설정</DialogTitle>
          <DialogDescription>
            변경 사항은 자동 저장돼요.
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
        <p className="small-note goal-allocation" role="status">{dailyAllocationRule(state.settings.dailyGoal, state.settings.newWordsPaused)}</p>
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
        <HelpDetails title="목표 수를 바꾸면?"><p>1~{MAX_DAILY_GOAL}개 · 기본 3개. 목표를 늘리면 회차 종료 후 추가해요. 줄여도 기존 배정·기록은 유지해요.</p><p>후보가 부족하면 다른 쪽으로 채워요. 신규 쉬기 중에는 복습만 배정해요.</p></HelpDetails>
        <section className="settings-section" aria-label="학습 범위 다시 확인"><h3>학습 범위 다시 확인</h3><button
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            setSettings(false);
            void beginAssessment();
          }}
        >
          친숙도 다시 확인하기
        </button></section>
        <HelpDetails title="저장·날짜·AI 안내"><p>계정별 서버 저장 · 한국 시간 기준. AI 버튼을 누르면 Google을 먼저 사용하고, 응답 실패 시 Groq로 자동 전환해요. 결과에 사용한 제공사를 표시해요. 두 계정은 Free 상태를 유지해 주세요.</p><p>앱 자체 횟수 제한은 없으며, 서비스의 실제 한도를 따라요.</p></HelpDetails>
        <HelpDetails title="문제가 생겼을 때">
          <p className="small-note">연결·대기 상태를 내려받아요. 답안·문장·계정·키는 제외해요. 자동 전송은 없으며 새로고침 시 초기화돼요.</p>
          <DiagnosticDownload />
        </HelpDetails>
        </div>
      </DialogContent>
    </Dialog>
  );
}
