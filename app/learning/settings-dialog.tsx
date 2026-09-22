"use client";
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
import { LevelSelect } from "../ui";
import type { LearningController } from "./use-learning-controller";
type SettingsDialogProps = Pick<
  LearningController,
  | "settings"
  | "setSettings"
  | "state"
  | "changeLevel"
  | "busy"
  | "changeGoal"
  | "save"
  | "beginAssessment"
>;
export function SettingsDialog({
  settings,
  setSettings,
  state,
  changeLevel,
  busy,
  changeGoal,
  save,
  beginAssessment,
}: SettingsDialogProps) {
  return (
    <Dialog open={settings} onOpenChange={setSettings}>
      <DialogContent className="settings-dialog">
        <DialogHeader>
          <DialogTitle>나의 학습 속도</DialogTitle>
          <DialogDescription>
            학습 목표에는 이월 단어가 먼저 포함됩니다.
          </DialogDescription>
        </DialogHeader>
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
          신규 단어 잠시 쉬기 · 이월만 배정
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
        <p className="small-note">
          하루 목표는 1~{MAX_DAILY_GOAL}개로 선택할 수 있어요. 기본은 3개예요.
          목표를 늘리면 오늘 학습을 마친 뒤 학습 홈에서 남은 개수를 추가할 수
          있어요. 목표를 줄여도 이미 배정한 단어와 기록은 유지해요. 15분 안에
          마치지 못한 단어는 다음에 이어서 학습해요.
        </p>
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
        <p className="small-note">
          계정별 서버 저장 · 한국 시간 기준. AI 문장 점검은 버튼을 누를 때만
          Google Gemini API를 사용해요. 무료 한도나 연결 오류가 있으면 자기
          점검으로 계속할 수 있어요.
        </p>
      </DialogContent>
    </Dialog>
  );
}
