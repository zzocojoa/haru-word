'use client';
import {HaruIcon} from '@/components/icons/haru-icon';
import type {InputRecovery} from './use-persistent-input';
import {HaruButton, HaruNotice} from './haru-controls';

export function DraftStorageNotice({input}: {input: InputRecovery}) {
  const {storage} = input;
  if (!storage.enabled || !storage.error) return null;
  const title = storage.error === 'capacity'
    ? '이 기기의 임시 보관 공간이 가득 찼어요. 현재 입력을 백업한 뒤 임시 입력을 정리해 주세요.'
    : '이 기기에 임시 입력을 보관하지 못했어요. 화면의 입력을 백업해 주세요.';
  return <HaruNotice className="notice local-draft-notice" status="warning" role="status" title={title}>
    <HaruButton type="button" variant="ghost" label="기기 보관 다시 확인" icon={<HaruIcon name="draft-check" size={18}/>} onClick={() => { storage.retry(); }} />
  </HaruNotice>;
}
