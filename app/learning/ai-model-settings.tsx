'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AI_CONTRACT_HEADERS } from '@/lib/ai-contract';
import { aiModel, selectedAiModel } from '@/lib/ai-models';
import { aiModelStatusSchema, type AiModelStatus } from '@/lib/ai-model-status';
import { requestJson, REQUEST_TIMEOUT_MS } from '@/lib/client-request';
import type { State } from '@/lib/learning';
import { useAiRequests } from '../ai-request-context';
import type { SaveLearningState } from './types';

export function AiModelSettings({ state, busy, save }: { state: State; busy: boolean; save: SaveLearningState }) {
  const { pendingCount } = useAiRequests();
  const [status, setStatus] = useState<AiModelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await requestJson<unknown>('/api/sentence-feedback', { cache: 'no-store', headers: AI_CONTRACT_HEADERS, signal }, REQUEST_TIMEOUT_MS.load);
      if (signal?.aborted) return;
      if (result.response.status === 401) { setError('로그인한 뒤 모델 목록을 확인해 주세요.'); return; }
      const parsed = aiModelStatusSchema.safeParse(result.data);
      if (!result.response.ok || !parsed.success) { setError('모델 목록을 불러오지 못했어요. 다시 확인해 주세요.'); return; }
      setStatus(parsed.data); setError('');
    } catch { if (!signal?.aborted) setError('모델 목록을 불러오지 못했어요. 연결을 확인한 뒤 다시 눌러 주세요.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => request.current?.abort();
  }, [load]);
  const selected = selectedAiModel(state.settings);
  const available = status?.models.filter(model => model.enabled) ?? [];
  const selectedEnabled = available.some(model => model.id === selected);
  const locked = busy || pendingCount > 0 || loading || !available.length;

  return <section className="settings-section ai-model-settings" aria-label="AI 모델 설정">
    <h3>AI 참고 의견 모델</h3>
    {error ? <div role="alert"><p className="small-note">{error}</p><button type="button" className="text-button" disabled={loading || pendingCount > 0} onClick={() => { request.current?.abort(); const controller = new AbortController(); request.current = controller; setLoading(true); void load(controller.signal); }}>모델 목록 다시 확인</button></div>
      : <>
        <label>사용할 OpenAI 모델
          <Select value={selected} disabled={locked} onValueChange={value => {
            if (locked || typeof value !== 'string' || !available.some(model => model.id === value) || value === selected) return;
            void save({ ...state, settings: { ...state.settings, aiModelId: value } });
          }}>
            <SelectTrigger aria-label="AI 모델"><SelectValue>{aiModel(selected)?.label ?? selected}</SelectValue></SelectTrigger>
            <SelectContent>
              {!status?.models.some(model => model.id === selected) && <SelectItem value={selected} disabled>{selected} · 이전 선택</SelectItem>}
              {status?.models.map(model => <SelectItem key={model.id} value={model.id} disabled={!model.enabled}>
                {model.label}{!model.enabled ? ' · 사용 불가' : ''}
              </SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        {loading && <p className="small-note" role="status">사용 가능한 모델을 확인하고 있어요.</p>}
        {!loading && !selectedEnabled && <p className="small-note" role="status">현재 선택은 사용할 수 없어요. 가능한 모델을 직접 선택해 주세요.</p>}
        {!!pendingCount && <p className="small-note" role="status">AI 의견을 요청하는 동안에는 모델을 바꿀 수 없어요.</p>}
        {status && !status.enabled && <p className="small-note">AI 의견 요청 기능이 현재 꺼져 있어요.</p>}
        {status && !status.configured && <p className="small-note">AI 연결 설정을 확인해야 해요. 자기 점검으로 학습을 계속할 수 있어요.</p>}
      </>}
    <p className="small-note">저장한 모델은 다음 ‘AI 참고 의견 요청’부터 사용해요. 기존 의견과 성적은 유지해요.</p>
    <p className="small-note">모델마다 요금과 응답 속도가 달라요. 연결 상태와 요청 내용에 따라 기다리는 시간이 달라질 수 있어요.</p>
    {status && <details className="notes-details"><summary>모델별 API 요금</summary>
      <p className="small-note">표준 요금 · 100만 토큰당 입력 / 출력 · {status.priceDate} 확인</p>
      <ul>{status.models.map(model => <li key={model.id}>{model.label}: ${model.inputUsdPerMillion} / ${model.outputUsdPerMillion}</li>)}</ul>
      <p className="small-note">API 사용량에 따라 비용이 발생해요. 캐시·처리 방식·세금에 따라 실제 청구액이 달라질 수 있어요. <a href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noreferrer">OpenAI 요금 확인</a></p>
    </details>}
  </section>;
}
