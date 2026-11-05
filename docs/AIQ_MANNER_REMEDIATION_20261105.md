# 정상 부사형 교정 차단 후속 수정 · 2026-11-05

**`AIQ-20261105-1`의 로컬 수정과 무과금 검증을 완료했다.** 사용자 `착수 승인`은 정상 교정 차단 수정, 저장된 실제90응답 재생, 회귀·타입·린트·빌드까지다. 실제 작업은 기존 `work/comprehensive-defect-audit-20261105`와 `codex/comprehensive-defect-audit-20261105`, 기준 HEAD `5a0fe1a7046763717a1ed1725cda96a2a74f1405`에서 진행했다. 제품 코드1파일과 기존 회귀 검사1파일의 미커밋 변경이다.

`lib/judgment-correction.ts:28`의 검토된 부사형 목록에 미국식 `skillful/skillfully`와 영국식 `skilful/skilfully` 두 쌍을 추가했다. [Collins의 부사·지역 철자 표기](https://www.collinsdictionary.com/us/dictionary/english/skillful)에 대응하는 범위다. 일반적인 `-ly` 자동 생성이나 별도 형태소 분석기를 추가하지 않았다. 기존 부정·수량·시점·인물 관계·발화행위·내용어 검사와 호출·저장 계약을 유지한다.

수정 전에 두 철자 쌍의 정상 교정이 모두 `content_change`로 거절됨을 새 회귀 검사에서 재현했다. 수정 후에는 전체 파싱을 거쳐 가시 피드백으로 반환된다. 부정이나 날짜를 바꾸거나 다른 인물·내용어로 바꾼 교정은 계속 거절한다. `hard/hardly`, `late/lately`, `friend/friendly`와 임의 접미사도 허용하지 않는 대조 검사를 추가했다.

| 실제 실행한 검사 | 결과 |
| --- | --- |
| 수정 전 집중 회귀 | 14개 중12통과·2실패, exit1 |
| 수정 후 집중 회귀 | 14/14, exit0 |
| 격리 Node22.23.4 전체 `npm test` | 852/852, 실패·skip·TODO0, exit0 |
| 격리 Node24.22.1 전체 `npm test` | 852/852, 실패·skip·TODO0, exit0 |
| Node24 `typecheck`, `lint`, `check:grammar-review`, `build` | 모두 exit0, lint 오류0·기존15경고 |
| 최종 Worker 빌드 | 새 두 철자 쌍이 실제 서버 출력에 포함됨 |
| 저장된 실제 응답 재생 | 수정 전87/90 → 수정 후90/90, exit0 |

재생에는 종료된 평가 원장의90개 생성 결과의 구조화 원문·모델·사용량을 사용했다. 최소한의 유효 Responses envelope를 재구성했으므로 원래 HTTP 패킷 전체를 재생한 것은 아니다. 수정 전 동결 런타임도 함께 재생해 당시87수용/3거절과 기존 가시 피드백을 재현했다. 수정 후 이전87개 결과는 생성 시각을 제외하고 완전히 같고, 차단됐던 세 모델의 `skillfully` 교정이 새로 수용됐다. 각 런타임의90개 생성 요청 본문은 기존 동결 본문과 바이트 단위로 같았다.

전역 네트워크 호출을 차단하고 주입한 저장 응답만 사용했다. 실제 API 호출0·API 키 읽기0이며 기존 원장·원점수·요청·출력·검토 기록51파일은 해시가 같다. **90/90은 로컬 수용·회귀 결과이며, 새 유료 모델 평가 점수나 새 교차 채점이 아니다.** [실제 평가 당시 결과](COMPREHENSIVE_AI_QUALITY_EVALUATION_20261105.md)의 모델별29/30, 보수적US$2.926401, 닫힌 별도US$5 원장과 당시 보류 판정은 그대로 보존한다.

재실행은 SOURCE에서 설치된 격리 Node를 지정한다. 아래 재생 스크립트는 실제 네트워크 대신 보관 응답만 주입한다.

```powershell
& '.\work\toolchains\node-v24.22.1\node.exe' --experimental-strip-types --test tests/remediation-judgment.test.mjs
& '.\work\toolchains\node-v24.22.1\node.exe' '..\..\outputs\aiq-manner-remediation-20261105\replay-saved.mjs'
```

ROOT 제품637파일·감사 원시2089개·게시 전251근거·기존 네 Task Master 태그 전체·평가 원장과 예산을 대조했다. 새 플랜이나 상태 합산은 만들지 않았다. 기존 Site/DB/R2·환경·의존성·SQL·모델·프롬프트·출력 버전은 변경하지 않는다. API/백업 envelope, AI 계약4·judgment-v6·문법 reader5를 유지한다. 새 진단이나 개인 입력 기록도 추가하지 않는다.

지원 범위는 검토된 두 철자 쌍이다. 이 검사만으로 모든 부사 파생형·문법·의미의 정확성을 보장하지 않는다. 이번에는 UI/전송 경로 변경이 없어 전체 브라우저 모음을 다시 실행하지 않았고, 운영 인증 생성·실제 iPhone/VoiceOver·새 실제 모델 품질은 미검증이다. 코드 복구 시에는 한 줄의 목록 변경을 되돌릴 수 있으나 향후 해당 교정이 다시 차단된다. 저장된 학습 기록·백업을 되돌리는 조치는 필요하지 않다.

운영은 기존 v146이다. 이번 단계의 커밋·푸시·PR 반영·병합·추가 게시·운영 학습 기록 조회/QA 쓰기는0이다. 다음 단계는 검토 가능한 이 변경을 PR58에 반영하고 CI를 확인하는 작업이다.

기계 판독 근거는 [수정 검증 JSON](releases/2026-11-05-aiq-manner-remediation.json), 실행 원본은 ROOT `outputs/aiq-manner-remediation-20261105/`의 `replay.json`, `checks.json`, `preservation.json`, 각 명령 로그다.
