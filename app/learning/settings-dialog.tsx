"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { HaruIcon } from "@/components/icons/haru-icon";
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
import { AiModelSettings } from './ai-model-settings';
import { LocalDraftSettings } from '../local-draft-settings';
import { useViewRestoration } from '../use-view-restoration';
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
  const levelTrigger = useRef<HTMLButtonElement>(null);
  const aiModelTrigger = useRef<HTMLButtonElement>(null);
  const goalTrigger = useRef<HTMLButtonElement>(null);
  const reviewDayTrigger = useRef<HTMLButtonElement>(null);
  const pendingSettingsFocus = useRef<{ control: HTMLButtonElement | HTMLInputElement; dialog: HTMLElement } | null>(null);
  const restoration = useViewRestoration();

  useEffect(() => {
    if (!settings) {
      pendingSettingsFocus.current = null;
      return;
    }
    const cancelOnFocus = (event: FocusEvent) => {
      const pending = pendingSettingsFocus.current;
      if (pending && event.target !== pending.dialog && event.target !== pending.control && event.target !== document.body) {
        pendingSettingsFocus.current = null;
      }
    };
    const cancelOnPointer = () => { pendingSettingsFocus.current = null; };
    document.addEventListener('focusin', cancelOnFocus);
    document.addEventListener('pointerdown', cancelOnPointer, true);
    return () => {
      pendingSettingsFocus.current = null;
      document.removeEventListener('focusin', cancelOnFocus);
      document.removeEventListener('pointerdown', cancelOnPointer, true);
    };
  }, [settings]);

  useEffect(() => {
    if (!settings || busy) return;
    const pending = pendingSettingsFocus.current;
    if (!pending) return;
    return restoration.schedule('destination', () => {
      if (pendingSettingsFocus.current !== pending) return;
      pendingSettingsFocus.current = null;
      if (!pending.control.isConnected || pending.control.disabled || pending.dialog.getAttribute('data-state') !== 'open') return;
      const active = document.activeElement;
      if (!active || active === document.body || active === pending.dialog) {
        pending.control.focus({ preventScroll: true });
      }
    });
  }, [settings, busy, restoration]);

  function rememberSettingsFocus(control: HTMLButtonElement | HTMLInputElement) {
    const dialog = control.closest<HTMLElement>('[data-slot="dialog-content"]');
    if (!control.isConnected || dialog?.getAttribute('data-state') !== 'open') return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== dialog && active !== control) return;
    pendingSettingsFocus.current = { control, dialog };
  }

  function deferSelectFocus(event: Event, trigger: HTMLButtonElement | null) {
    if (!trigger?.disabled) return;
    // Saving disables the trigger before Radix can return focus to it.
    event.preventDefault();
    rememberSettingsFocus(trigger);
  }

  return (
    <Dialog navigationKey="app.settings" open={settings} onOpenChange={setSettings}>
      <DialogContent className="settings-dialog framed-dialog">
        <DialogHeader>
          <DialogTitle>학습 설정</DialogTitle>
          <DialogDescription>
            변경하면 자동으로 저장해요. 상단에서 저장 상태를 확인해 주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="dialog-scroll">
        {availability}
        {settings && <AiModelSettings
          state={state}
          busy={busy}
          save={save}
          triggerRef={aiModelTrigger}
          onCloseAutoFocus={(event) => deferSelectFocus(event, aiModelTrigger.current)}
        />}
        {settings && <LocalDraftSettings busy={busy} />}
        <label>
          <span className="settings-label"><HaruIcon name="learning-level" size={18} />학습 수준</span>
          <LevelSelect
            value={state.settings.level}
            onChange={changeLevel}
            disabled={busy}
            triggerRef={levelTrigger}
            onCloseAutoFocus={(event) => deferSelectFocus(event, levelTrigger.current)}
          />
        </label>
        <label>
          <span className="settings-label"><HaruIcon name="target" size={18} />하루 목표 단어 수</span>
          <Select
            value={String(state.settings.dailyGoal)}
            disabled={busy}
            onValueChange={(v) => changeGoal(Number(v))}
          >
            <SelectTrigger ref={goalTrigger} aria-label="하루 목표">
              <SelectValue />
            </SelectTrigger>
            <SelectContent onCloseAutoFocus={(event) => deferSelectFocus(event, goalTrigger.current)}>
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
            onChange={(e) => {
              if (document.activeElement === e.currentTarget) rememberSettingsFocus(e.currentTarget);
              return save({
                ...state,
                settings: {
                  ...state.settings,
                  newWordsPaused: e.target.checked,
                },
              });
            }}
          />{" "}
          <span className="settings-label"><HaruIcon name="repeat" size={18} />새 단어 쉬기 · 복습만 하기</span>
        </label>
        <label>
          <span className="settings-label"><HaruIcon name="calendar-repeat" size={18} />주간 점검 요일</span>
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
            <SelectTrigger ref={reviewDayTrigger} aria-label="주간 점검 요일">
              <SelectValue />
            </SelectTrigger>
            <SelectContent onCloseAutoFocus={(event) => deferSelectFocus(event, reviewDayTrigger.current)}>
              {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                <SelectItem value={String(i)} key={day}>
                  {day}요일
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <HelpDetails title="목표 수를 바꾸면?"><p>1~{MAX_DAILY_GOAL}개 · 기본 3개. 목표를 늘리면 회차를 마친 뒤 추가해요. 줄여도 기존 배정·기록은 유지해요.</p><p>후보가 부족하면 다른 쪽으로 채워요. 신규 쉬기 중에는 복습만 배정해요.</p></HelpDetails>
        <section className="settings-section" aria-label="친숙도 다시 확인"><h3>친숙도 다시 확인</h3><button
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            setSettings(false);
            void beginAssessment();
          }}
        >
          <HaruIcon name="eye" size={18} />친숙도 다시 확인하기
        </button></section>
        <HelpDetails title="저장·날짜·AI 안내"><p>기록과 AI 모델 선택은 계정별로 저장하며, 학습일은 한국 시간 기준이에요. 한국 시간 자정에 다음 학습일로 바뀌어요. AI는 ‘참고 의견 요청’을 누를 때만 사용해요. 모델 변경이나 기록 조회만으로 요청하지 않아요.</p><p>OpenAI 사용 한도에 따라 요청이 제한될 수 있어요. 실패해도 다른 모델로 자동 전송하지 않아요.</p></HelpDetails>
        <HelpDetails title="문제가 생겼을 때">
          <p className="small-note">연결·대기 상태를 내려받아요. 답안·문장·계정·키는 제외해요. 자동 전송은 없으며 새로고침 시 초기화돼요.</p>
          <DiagnosticDownload />
        </HelpDetails>
        </div>
      </DialogContent>
    </Dialog>
  );
}
