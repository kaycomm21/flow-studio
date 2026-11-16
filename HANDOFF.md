# 📦 Flow 콘티 스튜디오 v2: 인수인계 문서

> 작성: Claude Code (ⓒ) · 2026-11-16 · **이 문서가 유일한 최신본** (v1 문서는 폐기)
> 사용자: 김영근 PD. 1인 전용, 코딩 배경 없음. **UI·보고는 한국어**, 결론 → 근거 → Action Step, 표 위주.

## 1. 요약
| 항목 | 값 |
|---|---|
| 목적 | AI 영상용 기획 → 콘티 → 제작(프롬프트·판정·크레딧) → 마무리(대본·자막·편집표) |
| 저장소 / 작업 브랜치 | https://github.com/kaycomm21/flow-studio / `claude/flow-studio-mvp-q0e8ls` |
| 배포 | https://kaycomm21.github.io/flow-studio/ (Actions → Pages) |
| 스택 | Vite 6.4.5 · React 18.3.1 · TypeScript 5.6.3 · vitest 3.2.7 |
| 저장 | localStorage `flow-studio-v2` (보관함+지갑). v1 키 `flow-studio-v1`은 첫 실행 때 자동 이전 |
| 품질 | `npm test` 53/53, `npm run build` 성공, 375px·1280px에서 전체 흐름 Playwright 확인 |

## 2. ⚠️ 미해결 (사용자가 GitHub 설정에서 처리)
| # | 이슈 | 해결 |
|---|---|---|
| 1 | `main` 푸시 시 Pages 배포 실패 — 배포 허용 브랜치가 `claude/...`뿐 | Settings → Environments → `github-pages` → Deployment branches에 `main` 추가 |
| 2 | 기본 브랜치가 `claude/...`일 수 있음 | Settings → General → Default branch → `main` |
| 3 | v2 작업은 작업 브랜치에만 있음 (`main` 미반영) | 1번 처리 후 PR 머지 |

처리 전까지는 **작업 브랜치에 푸시해야 사이트가 갱신**됩니다.

## 3. v1 → v2 무엇이 바뀌었나
| 구분 | v1 | v2 |
|---|---|---|
| 화면 | 5탭, 13열 가로 스크롤 표 | 4단계(기획·콘티·제작·마무리) + **▶ 다음 할 일** 안내, 샷 카드 |
| 프롬프트 복사와 기록 | 서로 다른 탭 | 제작 화면 한 장: 복사 → 생성 기록 → 판정 |
| 크레딧 | 편마다 수동 입력 | **지갑**(모든 편 합산), 모델별 비용 × 생성 횟수 자동, 재생성률 반영 예상 |
| 편 관리 | 1편만 | **보관함**: 여러 편, 다음 편(스타일 유지), 복제, 전체 백업 |
| 나레이션 | 없음 | 샷별 한국어 나레이션, 길이 경고, 대본·SRT 자막 |
| 경고 | 표시만 | **자동 수정**, 수동 항목은 해당 샷으로 안내 |
| 소리 | 없음 | 영상 프롬프트에 `Audio:` 줄 (끄기 가능) |
| 한글 입력 | 방치 | 영어 변환 도우미 (요청문 → 답변 적용) |
| 안전장치 | confirm 창 | 큰 변경마다 **되돌리기**, 손상 데이터 보정·원본 보관 |

### 고친 오류
| 문제 | 수정 |
|---|---|
| 저장 데이터가 깨지면 기본값으로 덮어써 원본 소실 | 원본을 `flow-studio-broken-<시각>` 키로 보관 후 새로 시작, 화면에 안내 |
| 가져온 JSON의 잘못된 값(null 배열 등)으로 화면이 죽음 | `sanitizeShot`/`sanitizeProject`로 전 필드 보정 |
| 캐릭터 ID를 고치거나 삭제하면 샷 연결이 끊긴 채 남음 | ID 수정 불가(자동 부여), 삭제 시 연결 해제 |
| 타임코드 `00:60.0` 표기 | 반올림 후 분 올림 |
| 영문 실존 인물 오탐(musket → musk) | 단어 경계 검사 |
| 키프레임 프롬프트 문법 오류("before it push") | 문장 구조 변경 |
| 진행 중인 편이 1편 평균 단가를 낮춤 | 끝난 편 기준으로 평균 계산 |
| 알림이 연속으로 뜨면 일찍 사라짐 | 타이머 정리 |
| JSON 불러오기가 현재 편을 덮어씀 | 보관함에 새 편으로 추가 |

## 4. 파일 구조
| 파일 | 역할 |
|---|---|
| `src/lib.ts` | 타입, 프리셋, `checkRules`, 프롬프트 조립(`shotPrompt`/`shotImagePrompt`), 멀티앵글·브리지·캐릭터 시트, `sanitizeProject`, 내보내기 |
| `src/techniques.ts` | 연출 기법 39종, 비트별 추천 |
| `src/director.ts` | 월드 시트·투어, 결함 보정, AI 시나리오 요청·파서, 오디오 큐시트, 편집 CSV, `safeFileName` |
| `src/assist.ts` | **보관함·지갑**(`loadStore`, `walletSummary`), `autoFix`, `nextAction`, 모델 배분, 번역 도우미, 대본·SRT |
| `src/App.tsx` | 셸: 헤더, 단계 탭, 다음 할 일, 저장, 되돌리기 알림 |
| `src/StepPlan.tsx` / `StepBoard.tsx` / `StepShoot.tsx` / `StepWrap.tsx` / `Library.tsx` | 단계별 화면 |
| `src/ui.tsx` | 공용: `Ctx`(화면 공유 조작), `Code`, `PromptBox`, `Fold`, `Field`, `Sel` |
| `src/lib.test.ts` | vitest 53개 |
| `dist/` | 빌드 결과물 (커밋 대상) |

의존: `techniques ← lib ← director ← assist ← 화면`. 역방향 import 금지.

## 5. 데이터 모델
```ts
Store   { version:2, activeId, projects: Project[], wallet:{ start, otherUsed, costs:{Lite,Fast,Quality,Omni} } }
Project { id, updatedAt, brief{series, episode, channel, preset, format, topic, facts[3], audio}, bible, characters[], locations[], shots[] }
Shot    { id, beat, purposeType, purpose, size, angle, move, speed, endState, subject, action, setting, lighting,
          transition, seconds, model, keyframe, techniques[], characterId, locationId, screenDir, sfx,
          narration, takes, status, credits, qc[5], defects[] }
```
**필드 추가 시:** ① 타입 ② `defaultShots`·`blankShot` ③ **`sanitizeShot`/`sanitizeProject`** (여기 빠지면 저장 후 사라짐) ④ `exportJson`·`exportMarkdown` ⑤ `projectRealNames` ⑥ AI 요청문·파서(`director.ts`) ⑦ 테스트

상태 흐름: `대기 → (생성 1회 기록) → 생성 → 채택 | 재생성 | 폐기`. 생성 1회마다 `takes+1`, `credits += wallet.costs[model]` (credits는 직접 수정 가능).

## 6. 프롬프트 줄 순서
camera → subject+동작(+화면 방향) → `Character lock:` → `Location lock:` → `Setting` → `Lens and render` → `Cinematography:` → `Audio:` → `STYLE BIBLE:` → `No text, no logos, no real people, no watermark.` → (재생성) `Fix from previous take:`

## 7. 규칙 경고와 자동 수정
| rule | 조건 | 자동 수정 |
|---|---|---|
| sameSize | 같은 샷크기 3연속 | 가운데 샷 크기 변경 |
| noMove | 무브 미지정 | 고정 |
| fewFixed | 3샷 중 고정 0개 | 가운데 샷을 고정 |
| noInsert | INSERT 0개 | CU 하나를 INSERT로 (CU 없으면 수동) |
| techConflict | 기법과 무브 불일치 | 기법 제거 |
| dupId | ID 중복 | 새 ID |
| multiAction | 동작 2개 | 수동 (샷 편집에 "첫 동작만 남기기" 버튼) |
| axisFlip / overLength / voLong | 좌우 반전 / 60초 초과 / 나레이션이 샷보다 김 | 수동 |

불변: 프리셋 A·B·C 기본 8샷은 경고 0개 (테스트 강제). 나레이션 길이는 공백 제외 글자 수 ÷ 6 초의 **어림값**입니다.

## 8. 검증되지 않은 가정 (다음 세션에서 확인할 것)
| 항목 | 상태 |
|---|---|
| 모델별 크레딧 비용 기본값 (Lite 10 / Fast 20 / Quality 100 / Omni 50) | **추정치**. 실제 Flow 차감값 미확인. 사용자가 지갑에서 수정 |
| `Audio:` 줄·연출 기법이 실제 결과물 품질에 주는 효과 | 미검증. 실제 생성 QC 데이터 필요 |
| 나레이션 초당 6자 | 어림값. 사용자의 TTS 속도에 맞게 `VO_CHARS_PER_SEC` 조정 |
| 한글·`ⓒ` 파일명이 `download`로 저장되는 문제 | 클라우드 컨테이너 Chrome에서만 재현 확인. 그래서 파일명은 영문(`flow_<영문>_C_<일시>`) |

## 9. 개발 명령어
```bash
npm install
```
```bash
npm run dev
```
```bash
npm test
```
```bash
npm run build
```
`dist/`도 함께 커밋합니다. 화면 검증은 Playwright로 375px에서 `scrollWidth === 375` 확인.

## 10. 설계 원칙 (사용자 합의)
1. 외부 API·키 입력란 금지. AI는 "요청문 복사 → 사용자 구독 → 답변 붙여넣기".
2. 실존 인물·정당·브랜드 금지.
3. 타사 서비스는 개념만 참고, 이름·UI·문구는 독자.
4. 단순함 우선: 기본 화면에는 꼭 필요한 것만, 나머지는 접기(`Fold`/`details`).
5. 파괴적 변경은 `c.commit()`으로 (되돌리기 제공).

## 11. 백로그
| 우선 | 작업 | 비고 |
|---|---|---|
| P0 | 2장 처리 → `main` 머지·배포 확인 | 사용자 설정 필요 |
| P1 | 실제 1편 제작 후 모델 비용·기법 효과 보정 | 사용자 데이터 필요 |
| P1 | vgen.py 연결 (JSON `shots[].prompt/imagePrompt/seconds/model/narration`) | 스키마 `exportJson` v2 |
| P2 | 롱폼 전용 비트시트·샷 수 | 현재 60초 6비트 공용 |
| P2 | 사용자 정의 금지어, 프리셋 직접 저장(내 프리셋) | |
| P3 | 기기 간 동기화 | "서버 없음" 원칙과 충돌 → 사용자 확인 |

## 12. 다음 세션 시작 프롬프트
```
kaycomm21/flow-studio 저장소의 HANDOFF.md를 먼저 읽고 이어서 작업해줘.
2장 미해결 이슈부터 확인하고, 11장 백로그 중 [작업명]을 진행해줘.
작업 후 npm test / npm run build 통과 확인 → dist 포함 커밋 → 푸시 → 결과를 한국어 표로 보고.
```
