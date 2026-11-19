'use client';

import {useLayoutEffect, useRef, type ReactNode} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Theme} from '@astryxdesign/core/theme';
import {InternationalizationProvider} from '@astryxdesign/core/i18n';
import koKR from '@astryxdesign/core/locales/ko-KR.generated.js';
import {HaruIcon} from '@/components/icons/haru-icon';
import {haruTheme} from '@/src/themes/haru/haru';
import {installLegacyModalInert} from './legacy-modal-inert';
import type {View} from './learning/types';

// Keep typing from invalidating the translation context of every Core control.
const haruMessages = {'ko-KR': koKR};

const tabs = [
  {value: 'today', label: '오늘 학습', icon: 'book-open'},
  {value: 'library', label: '단어장', icon: 'notebook'},
  {value: 'review', label: '복습 점검', icon: 'repeat'},
  {value: 'log', label: '학습 기록', icon: 'calendar-check'},
] as const;

export function HaruFrame({header, keyboardOpen, studying, children}: {
  header: ReactNode; keyboardOpen: boolean; studying: boolean; children: ReactNode;
}) {
  useLayoutEffect(()=>installLegacyModalInert(),[]);
  return <InternationalizationProvider locale="ko-KR" messages={haruMessages}>
    <Theme theme={haruTheme} mode="light">
      <AppShell className="shell haru-frame" height="auto" mobileNav={false} variant="wash" contentPadding={0}
        onPointerDownCapture={event=>{if(event.currentTarget.dataset.haruInput!=='pointer')event.currentTarget.dataset.haruInput='pointer';}}
        onKeyDownCapture={event=>{if(event.currentTarget.dataset.haruInput!=='keyboard')event.currentTarget.dataset.haruInput='keyboard';}}
        data-keyboard={keyboardOpen ? 'open' : undefined} data-studying={studying ? 'true' : undefined} topNav={header}>
        {children}
      </AppShell>
    </Theme>
  </InternationalizationProvider>;
}

export function HaruTabList({value, requestTab}: {value: View; requestTab: (value: View) => Promise<boolean>}) {
  const pending = useRef(false);
  const selected = useRef(value);
  const buttons = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});
  useLayoutEffect(() => { selected.current = value; });
  // Selection is the committed NavigationProvider state, never an optimistic tab.
  const request = async (next: string) => {
    const tab = tabs.find(tab => tab.value === next);
    if (!tab || pending.current) return;
    pending.current = true;
    try {
      if (!await requestTab(tab.value)) {
        const active = buttons.current[selected.current];
        if (active?.isConnected && active.getAttribute('aria-selected') === 'true') active.focus({preventScroll: true});
      }
    } finally { pending.current = false; }
  };
  return <TabList className="main-nav" data-slot="tabs-list" role="tablist" aria-label="학습 화면"
    value={value} onChange={request} layout="fill" overflow="visible">
    {tabs.map(tab => <Tab key={tab.value} ref={node => { buttons.current[tab.value] = node; }} id={`haru-tab-${tab.value}`} value={tab.value}
      panelId={`haru-panel-${tab.value}`} label={tab.label} aria-label={tab.label}
      data-slot="tabs-trigger" data-state={value === tab.value ? 'active' : 'inactive'}
      onFocus={() => request(tab.value)} icon={<HaruIcon name={tab.icon} size={18} />} />)}
  </TabList>;
}

export function HaruTabPanel({value, selected, children}: {value: View; selected: View; children: ReactNode}) {
  // Retain mounted views and their filters/drafts; hidden panels leave the tab order.
  return <section id={`haru-panel-${value}`} role="tabpanel" aria-labelledby={`haru-tab-${value}`}
    data-slot="tabs-content" className="haru-tab-panel" tabIndex={0} hidden={selected !== value}>{children}</section>;
}
