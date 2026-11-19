// Adapted from Astryx ThemeShowcase; Section/Grid/Card spacing is preserved.
'use client';
import {useRef, useState} from 'react';
import {Theme} from '@astryxdesign/core/theme';
import {InternationalizationProvider} from '@astryxdesign/core/i18n';
import koKR from '@astryxdesign/core/locales/ko-KR.generated.js';
import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {Section} from '@astryxdesign/core/Section';
import {Stack} from '@astryxdesign/core/Layout';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Selector} from '@astryxdesign/core/Selector';
import {Banner} from '@astryxdesign/core/Banner';
import {HaruControlContracts} from './control-contracts';
import {haruTheme} from '../../src/themes/haru/haru';
export default function Foundation() {
  const [word, setWord] = useState('travel');
  const [note, setNote] = useState('친구들과 함께 가을에 여행을 갈 거예요.');
  const [level, setLevel] = useState('A1');
  const [actions, setActions] = useState(0);
  const [retries, setRetries] = useState(0);
  const [eventValue, setEventValue] = useState('');
  const wordRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  return (
    <InternationalizationProvider locale="ko-KR" messages={{'ko-KR': koKR}}>
      <Theme theme={haruTheme} mode="light">
        <Section variant="muted" padding={4} maxWidth={600}>
          <Grid columns={{minWidth: 240, repeat: 'fit'}} gap={3} width="100%">
            <Card padding={4} width="100%">
              <Stack direction="vertical" gap={3}>
                <Heading level={1}>하루단어 테마 확인</Heading>
                <Text type="body">여행에서 만난 친구에게 오늘 배운 단어로 내 생각을 전해 봅니다.</Text>
                <Text type="supporting" color="secondary">입력·선택·오류 상태를 확인하는 로컬 검증 화면입니다.</Text>
                <TextInput ref={wordRef} label="확인할 단어" htmlName="word" value={word} width="100%"
                  onChange={(value, event) => {setWord(value); setEventValue(event.currentTarget.value);}} />
                <TextArea ref={noteRef} label="전달하려는 뜻" htmlName="note" value={note} width="100%"
                  onChange={(value, event) => {setNote(value); setEventValue(event.currentTarget.value);}} />
                <Selector label="단어 수준" value={level} onChange={setLevel} options={['A1', 'A2', 'B1', 'B2']} width="100%" />
                <Stack direction="horizontal" gap={2} wrap="wrap">
                  <Button label="내용 확인" variant="primary" onClick={() => setActions(n => n + 1)} />
                  <Button label="단어로 돌아가기" size="sm" onClick={() => wordRef.current?.focus()} />
                  <Button label="뜻으로 돌아가기" size="sm" onClick={() => noteRef.current?.focus()} />
                </Stack>
                <Stack direction="horizontal" gap={2} wrap="wrap">
                  <Button label="확인할 내용 없음" isDisabled onClick={() => setActions(n => n + 1)} />
                  <Button label="확인 중" isLoading onClick={() => setActions(n => n + 1)} />
                </Stack>
                <Button label="연결을 확인한 뒤 입력한 내용을 유지하고 다시 확인하기" size="sm" width="100%">
                  <Text type="body">연결을 확인한 뒤 입력한 내용을 유지하고 다시 확인하기</Text>
                </Button>
                <Text type="body">실행 횟수: {actions} · 재시도 횟수: {retries} · 선택: {level}</Text>
                <Text type="body">입력 이벤트: {eventValue || '아직 입력하지 않음'}</Text>
                <Banner status="error" title="연결을 확인해 주세요" collapsible={false} isDismissable={false}>
                  <Stack direction="vertical" gap={3}>
                    <Text type="body">입력한 내용은 그대로 있어요. 연결을 확인한 뒤 다시 시도해 주세요.</Text>
                    <Button label="다시 시도" size="sm" onClick={() => setRetries(n => n + 1)} />
                  </Stack>
                </Banner>
                <HaruControlContracts/>
              </Stack>
            </Card>
          </Grid>
        </Section>
      </Theme>
    </InternationalizationProvider>
  );
}
