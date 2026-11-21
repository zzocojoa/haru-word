"use client";
import {HaruParagraph} from '../haru-content';
import {HaruButton} from '../haru-controls';

import { useEffect, useRef, type ReactNode } from "react";
import { Switch } from "@astryxdesign/core/Switch";
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
            변경하면 자동으로 저장돼요.
          </DialogDescription>
        </DialogHeader>
        <div className="dialog-scroll">
        {availability}
        <section className="settings-field" data-settings-field>
          <HaruParagraph className="settings-label">학습 수준</HaruParagraph>
          <LevelSelect value={state.settings.level} onChange={changeLevel} disabled={busy} triggerRef={levelTrigger}
            onBeforeChange={() => { if (levelTrigger.current) rememberSettingsFocus(levelTrigger.current); }} />
        </section>
        <section className="settings-field settings-goal-field" data-settings-field>
          <HaruParagraph className="settings-label">하루 단어 목표</HaruParagraph>
          <HaruSelector label="하루 목표" aria-label="하루 목표" isLabelHidden ref={goalTrigger} containerClassName="haru-settings-select" value={String(state.settings.dailyGoal)} disabled={busy}
            onChange={value=>{if(goalTrigger.current) rememberSettingsFocus(goalTrigger.current);changeGoal(Number(value));}}
            options={Array.from({length:MAX_DAILY_GOAL},(_,i)=>({value:String(i+1),label:(i+1)+'개'}))}/>
          <HaruParagraph className="small-note goal-allocation" role="status">{dailyAllocationRule(state.settings.dailyGoal, state.settings.newWordsPaused, true)}</HaruParagraph>
        </section>
        <section className="settings-field settings-switch-field" data-settings-field>
          <Switch label="복습만 하기" labelPosition="start" labelSpacing="spread" width="100%" value={!!state.settings.newWordsPaused} isDisabled={busy}
            onChange={(checked,event) => {
              if (document.activeElement === event.currentTarget) rememberSettingsFocus(event.currentTarget);
              void save({...state,settings:{...state.settings,newWordsPaused:checked}});
            }} />
        </section>
        <section className="settings-field" data-settings-field>
          <HaruParagraph className="settings-label">주간 점검 요일</HaruParagraph>
          <HaruSelector label="주간 점검 요일" aria-label="주간 점검 요일" isLabelHidden ref={reviewDayTrigger} containerClassName="haru-settings-select" value={String(state.settings.reviewDay??0)} disabled={busy}
            onChange={value=>{if(reviewDayTrigger.current) rememberSettingsFocus(reviewDayTrigger.current);return save({...state,settings:{...state.settings,reviewDay:Number(value)}});}}
            options={['일','월','화','수','목','금','토'].map((day,i)=>({value:String(i),label:day+'요일'}))}/>
        </section>
        {settings && <AiModelSettings state={state} busy={busy} save={save} triggerRef={aiModelTrigger}
          onBeforeChange={() => { if (aiModelTrigger.current) rememberSettingsFocus(aiModelTrigger.current); }}>
          <section className="settings-familiarity">
            <HaruButton label="친숙도 다시 확인" variant="secondary" className="haru-migrated secondary-button" disabled={busy}
              onClick={() => { setSettings(false); void beginAssessment(); }} />
          </section>
          <HelpDetails title="목표 배정 안내">
            <HaruParagraph>1~{MAX_DAILY_GOAL}개 · 기본 3개</HaruParagraph>
            <HaruParagraph>목표를 늘리면 현재 회차가 끝난 뒤 추가해요. 줄여도 기존 배정과 기록은 유지돼요. 후보가 부족하면 다른 쪽에서 채워요.</HaruParagraph>
          </HelpDetails>
        </AiModelSettings>}
        {settings && <LocalDraftSettings busy={busy} />}
        <HelpDetails title="학습일·기록 안내"><HaruParagraph>학습 기록과 AI 모델 선택은 계정별로 저장돼요. 학습일은 한국 시간 자정에 바뀌어요.</HaruParagraph></HelpDetails>
        <HelpDetails title="문제 진단">
          <HaruParagraph className="small-note">연결·대기 상태만 이 기기에 내려받아요. 진단 기록은 새로고침하면 초기화돼요.</HaruParagraph>
          <DiagnosticDownload />
        </HelpDetails>
        </div>
      </DialogContent>
    </Dialog>
  );
}
