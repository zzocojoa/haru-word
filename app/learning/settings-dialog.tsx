"use client";
import {HaruParagraph,HaruHeading} from '../haru-content';
import {HaruButton} from '../haru-controls';

import { useEffect, useRef, type ReactNode } from "react";
import { HaruIcon } from "@/components/icons/haru-icon";
import {
  DialogHeader,
} from "@/components/ui/dialog";
import { SheetDialog as Dialog, SheetDialogContent as DialogContent, SheetDialogTitle as DialogTitle, SheetDialogDescription as DialogDescription } from '../sheet-dialog';
import {HaruSelector} from '../haru-controls';
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
          onBeforeChange={() => { if(aiModelTrigger.current) rememberSettingsFocus(aiModelTrigger.current); }}
        />}
        {settings && <LocalDraftSettings busy={busy} />}
        <section className="settings-field" data-settings-field>
          <span className="settings-label"><HaruIcon name="learning-level" size={18} />학습 수준</span>
          <LevelSelect
            value={state.settings.level}
            onChange={changeLevel}
            disabled={busy}
            triggerRef={levelTrigger}
            onBeforeChange={() => { if(levelTrigger.current) rememberSettingsFocus(levelTrigger.current); }}
          />
        </section>
        <section className="settings-field" data-settings-field>
          <span className="settings-label"><HaruIcon name="target" size={18} />하루 목표 단어 수</span>
          <HaruSelector label="하루 목표" aria-label="하루 목표" isLabelHidden ref={goalTrigger} containerClassName="haru-settings-select" value={String(state.settings.dailyGoal)} disabled={busy}
            onChange={value=>{if(goalTrigger.current) rememberSettingsFocus(goalTrigger.current);changeGoal(Number(value));}}
            options={Array.from({length:MAX_DAILY_GOAL},(_,i)=>({value:String(i+1),label:(i+1)+'개'+(i+1===3?' · 기본 목표':'')}))}/>
        </section>
        <HaruParagraph className="small-note goal-allocation" role="status">{dailyAllocationRule(state.settings.dailyGoal, state.settings.newWordsPaused)}</HaruParagraph>
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
        <section className="settings-field" data-settings-field>
          <span className="settings-label"><HaruIcon name="calendar-repeat" size={18} />주간 점검 요일</span>
          <HaruSelector label="주간 점검 요일" aria-label="주간 점검 요일" isLabelHidden ref={reviewDayTrigger} containerClassName="haru-settings-select" value={String(state.settings.reviewDay??0)} disabled={busy}
            onChange={value=>{if(reviewDayTrigger.current) rememberSettingsFocus(reviewDayTrigger.current);return save({...state,settings:{...state.settings,reviewDay:Number(value)}});}}
            options={['일','월','화','수','목','금','토'].map((day,i)=>({value:String(i),label:day+'요일'}))}/>
        </section>
        <HelpDetails title="목표 수를 바꾸면?"><HaruParagraph>1~{MAX_DAILY_GOAL}개 · 기본 3개. 목표를 늘리면 회차 후 추가해요. 줄여도 기존 배정·기록은 유지돼요. 후보가 부족하면 다른 쪽으로 채워요.</HaruParagraph></HelpDetails>
        <section className="settings-section" aria-label="친숙도 다시 확인"><HaruHeading level={3}>친숙도 다시 확인</HaruHeading><HaruButton label={["친숙도 다시 확인하기"].join('')} variant="secondary" icon={<HaruIcon name="eye" size={18} />}
          className="haru-migrated secondary-button"
          disabled={busy}
          onClick={() => {
            setSettings(false);
            void beginAssessment();
          }}
        >
          친숙도 다시 확인하기
        </HaruButton></section>
        <HelpDetails title="저장·날짜·AI 안내"><HaruParagraph>기록과 AI 모델 선택은 계정별로 저장하며, 학습일은 한국 시간 기준이에요. 한국 시간 자정에 다음 학습일로 바뀌어요. AI는 ‘참고 의견 요청’을 누를 때만 사용해요. 모델 변경이나 기록 조회만으로 요청하지 않아요.</HaruParagraph><HaruParagraph>OpenAI 사용 한도에 따라 요청이 제한될 수 있어요. 실패해도 다른 모델로 자동 전송하지 않아요.</HaruParagraph></HelpDetails>
        <HelpDetails title="문제가 생겼을 때">
          <HaruParagraph className="small-note">연결·대기 상태를 내려받아요. 답안·문장·계정·키는 제외해요. 자동 전송은 없으며 새로고침 시 초기화돼요.</HaruParagraph>
          <DiagnosticDownload />
        </HelpDetails>
        </div>
      </DialogContent>
    </Dialog>
  );
}
