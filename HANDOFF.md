# 📦 Flow 콘티 스튜디오: 최종 인수인계 문서

> 작성: Claude Code (ⓒ) · 2026-11-05 · **이 문서가 유일한 최신본입니다** (이전 판은 폐기)
> 사용자: 김영근 PD. 1인 전용 도구이며 사용자는 코딩 배경이 없습니다. **UI·보고는 한국어**, 결론 → 근거 → Action Step 순서로, 표 위주로 보고합니다.

## 1. 요약
| 항목 | 값 |
|---|---|
| 목적 | AI 영상(Flow 등)용 콘티 → 샷별 영어 프롬프트 → 생성 기록·크레딧 관리 |
| 저장소 | https://github.com/kaycomm21/flow-studio (작업 브랜치 `claude/flow-studio-mvp-q0e8ls`) |
| 배포 | https://kaycomm21.github.io/flow-studio/ (GitHub Actions → Pages, `.github/workflows/deploy.yml`) |
| 스택 | Vite 6.4.5 · React 18.3.1 · TypeScript 5.6.3 · vitest 3.2.7 (버전 고정) |
| 저장 | 브라우저 localStorage 키 `flow-studio-v1`. 서버·API 키 없음. 백업은 JSON 내보내기 |
| 품질 | `npm test` 38/38 통과, `npm run build` 성공, 375px에서 가로 넘침 없음 확인 |

## 2. ⚠️ 미해결 이슈 (사용자가 GitHub 설정 화면에서 처리)
| # | 이슈 | 해결 방법 |
|---|---|---|
| 1 | `main`에 푸시하면 Pages 배포 실패 (run #7, #9). 배포 허용 브랜치가 `claude/...`뿐이기 때문 | Settings → Environments → `github-pages` → Deployment branches에 `main` 추가 |
| 2 | 기본 브랜치가 `claude/...`일 가능성 | Settings → General → Default branch → `main` |
| → | 처리 전까지는 **작업 브랜치에 푸시해야 사이트가 갱신**됩니다 | 처리 후 Actions → Run workflow(main)으로 확인 |

## 3. 기능 목록 (탭별)
| 탭 | 기능 |
|---|---|
| 브리프 | 시리즈·채널·주제·사실 3줄, 프리셋 A 신비 건축 / B 동물 풍자 / C B롤 (STYLE BIBLE·8샷·캐릭터·장소 자동 세팅), 포맷 쇼츠 9:16 / 롱폼 16:9, 👤 캐릭터 시트 편집, 📍 월드(장소) 편집, JSON 내보내기·불러오기, Markdown 콘티, 편집 큐시트 CSV |
| 콘티 | 6비트 시트(0-3 / 3-12 / 12-30 / 30-45 / 45-55 / 55-60초), 샷 표 편집, 규칙 경고 배지, 🤖 AI로 콘티 채우기 (요청문 복사 → 사용자의 Claude/Gemini → 답변 붙여넣기 → 자동 교정 후 적용) |
| 연출 | 기법 39종(구도·카메라·렌즈·조명·속도), 비트별 추천 일괄 적용, 캐릭터·장소 고정, ↔ 화면 방향, 🔊 효과음 메모, 실시간 프롬프트 미리보기 |
| 프롬프트 | 샷별 영어 프롬프트 + 키프레임(Nano Banana) 이미지 프롬프트, 복사·전체 복사, 캐릭터 시트, 월드 시트 + 월드 카메라 5종, 🎞 멀티앵글 6종, 🔊 오디오 큐시트, 🔀 전환 브리지 |
| 기록·크레딧 | 샷 상태, 사용 크레딧 → 잔량 바(시작 1,050)·1편 평균 단가·남은 가능 편수, QC 5항목(평균 3.5 미만이면 재생성), 결함 태그 10종 → `Fix from previous take` 보정 프롬프트 |

## 4. 파일 구조 · 의존 방향
| 파일 | 역할 |
|---|---|
| `src/lib.ts` | 핵심 순수 로직: 타입, 프리셋, `checkRules`, `buildVideoPrompt`/`buildImagePrompt`, `buildCoverage`, `buildBridge`, `buildCharacterSheet`, 크레딧/QC, `exportJson`/`exportMarkdown`/`parseProject`, `nextShotId` |
| `src/techniques.ts` | 연출 기법 39종, `BEAT_RECO`, `recommend()`, 카메라무브 호환 `moves` |
| `src/director.ts` | 월드 시트·투어, `DEFECTS`/`buildRegenPrompt`, `buildScenarioRequest`/`parseScenarioResponse`, `buildAudioCue`, `buildEditCsv`, `safeFileName` |
| `src/App.tsx` | 5탭 UI (단일 컴포넌트, 약 820줄), `Code`(줄 머리 색 구분), `Sel` |
| `src/styles.css` | Monokai 다크 (`:root` 변수: bg `#272822`, text `#F8F8F2`, accent `#F92672`) |
| `src/lib.test.ts` | vitest 38개 |
| `dist/` | **빌드 결과물도 커밋 대상** (Pages가 막혔을 때 로컬 실행용) |

의존 방향: `techniques.ts ← lib.ts ← director.ts ← App.tsx`. 역방향 import는 금지합니다. `techniques.ts`는 lib에서 타입만 가져옵니다.

## 5. 데이터 모델 핵심
```ts
Project { brief, bible, characters[{id,name,look,wardrobe,signature}], locations[{id,name,place,details}], shots: Shot[], credit{start,pastUsed,pastEpisodes} }
Shot { id, beat, purposeType, purpose, size, angle, move, speed, endState, subject, action, setting, lighting,
       transition, seconds, model, keyframe, techniques[], characterId, locationId, screenDir, sfx,
       status, credits, qc[5], defects[] }
```
**필드를 추가할 때 체크리스트:**
1. 타입 정의
2. `defaultShots`·`blankShot` 기본값. `parseProject`가 `blankShot`과 합쳐 구버전 데이터를 보정합니다
3. 배열 필드는 `parseProject`에 `Array.isArray` 처리
4. `exportJson`·`exportMarkdown`
5. 사람이 텍스트를 입력하는 필드는 `projectRealNames`에 추가
6. 테스트 추가

## 6. 프롬프트 조립 순서
`camera(속도·무브·샷크기·앵글·끝상태)` → `subject + 동작 1개 (+화면 방향)` → `Character lock:` → `Location lock:` → `Setting/lighting` → `Lens and render` (CU·INSERT는 lensClose) → `Cinematography:` → `STYLE BIBLE:` → `No text, no logos, no real people, no watermark.` → (재생성 시) `Fix from previous take:`

빈 줄은 자동으로 빠집니다. `Code` 컴포넌트는 `^[A-Z][A-Za-z ]{2,24}:` 형식의 줄 머리를 핑크로 칠합니다.

## 7. 규칙 경고 (`checkRules(shots, format)`)
| rule | 조건 |
|---|---|
| sameSize | 같은 샷크기 3연속 |
| noMove | 카메라무브 미지정 |
| fewFixed | 연속 3샷 중 고정 0개 |
| multiAction | action에 `그리고`/`and`/`&` |
| noInsert | INSERT 0개 |
| techConflict | 기법과 무브 불일치 (예: 고정 + 돌리 줌) |
| axisFlip | 연속 샷 좌우 반전 (앞 샷 전환이 암전이면 허용) |
| dupId | 샷ID 중복 *(이번 검수에서 추가)* |
| overLength | 쇼츠 총 60초 초과 *(이번 검수에서 추가)* |

불변 조건: **프리셋 A·B·C 기본 8샷은 경고 0개**여야 합니다 (테스트가 강제).

## 8. 이번 최종 검수에서 고친 것
| # | 문제 | 수정 |
|---|---|---|
| 1 | 샷 삭제 후 [+ 샷 추가]를 누르면 ID가 중복됨 (예: S08이 2개) → 경고·복사 대상 혼동 | `nextShotId()`로 겹치지 않는 ID 생성 + `dupId` 경고 |
| 2 | 쇼츠 길이 초과를 알려주지 않음 | `overLength` 경고 |
| 3 | 멀티앵글 "리버스 앵글"이 화면 방향을 그대로 둠 (180도 반대편인데 좌→우 유지) | 좌↔우 자동 반전 |
| 4 | 실존 인물 검사에서 "조국"(祖國, 일반명사) 오탐 | 목록에서 제외 (정당명 "조국혁신당"은 유지) |
| 5 | AI 답변 앞 설명에 `[참고]` 같은 대괄호가 있으면 JSON 파싱 실패 | ```json 코드블록을 우선 파싱 |
| 6 | 같은 JSON 파일을 두 번 연속 불러오면 반응 없음 | 파일 선택 후 입력값 초기화 |

이전 세션에서 고친 것: 다운로드 파일명에 한글이나 `ⓒ`가 들어가면 Chrome이 `download`로 바꿔 저장하는 문제 → `safeFileName()`이 `flow_<영문>_C_<YYYYMMDD-HHMM>.ext` 형식으로 생성합니다 (**식별자는 `ⓒ` 대신 `C`**).

## 9. 개발 명령어 (복붙용)
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
- `npm run dev` → http://localhost:5173 접속
- `npm test` → `Tests 38 passed`가 나와야 정상
- `npm run build` → 결과물 `dist/`도 같이 커밋
- 로컬에서 빌드본만 볼 때: `npm run preview` → http://localhost:4173

클라우드 세션에서는 Playwright(Chromium 설치됨)로 375px 스크린샷을 찍고 `scrollWidth === 375`를 확인합니다.

## 10. 설계 원칙 (사용자와 합의)
1. 외부 API 호출·키 입력란 금지. AI가 필요하면 "요청문 복사 → 사용자 구독 → 답변 붙여넣기" 패턴(`director.ts`)을 재사용합니다.
2. 실존 인물·정당·브랜드 금지. `findRealNames`는 목록 기반이라 한계가 있습니다.
3. 타사 서비스는 통째로 베끼지 않고 기능 개념만 참고하며, 이름·UI·문구는 독자적으로 만듭니다.
4. 기능 추가보다 작동 + 배포가 우선입니다. 숫자·기한·담당이 없는 제안은 미완성입니다.
5. 피사체·동작·장소·조명 입력은 영어가 전제입니다 (번역 API 없음).

## 11. 백로그 (우선순위순)
| 우선 | 작업 | 난이도 | 비고 |
|---|---|---|---|
| P0 | 2장 이슈 처리 확인 → `main` 배포 성공 확인 | 하 | 사용자 작업 |
| P1 | vgen.py 연결: 로컬 스크립트가 JSON의 `shots[].prompt / imagePrompt / seconds / model`을 읽어 자동 생성 | 중 | vgen.py는 사용자 로컬(Antigravity)에 있음. 스키마는 `exportJson` 기준 |
| P1 | 연출 기법 효과 검증: QC 점수 비교 → 효과 없는 기법 제거, 기본값 조정 | 중 | 사용자 데이터 필요 |
| P2 | 롱폼 전용 비트시트 (현재 60초 6비트를 공용) | 중 | `BEATS`를 포맷별로 분리 |
| P2 | 여러 에피소드 관리 + 크레딧 누적 자동화 | 중 | 현재 1프로젝트 = localStorage 1개 |
| P2 | 사용자 정의 금지어 목록 | 하 | `REAL_NAMES` 확장 |
| P3 | `App.tsx` 탭별 컴포넌트 분리 | 중 | 동작은 그대로, 구조만 정리 |
| P3 | 밝은 테마 토글 | 하 | 현재 다크 고정 |
| P3 | Firebase(`copper-guide-480206-b0`, 서울 리전) 동기화 | 상 | "서버 없음" 원칙과 충돌하므로 사용자 확인 필수 |

## 12. 이력
| 단계 | 내용 |
|---|---|
| MVP | 4탭, 규칙 경고 5종, 크레딧/QC, JSON/MD, Pages 배포 |
| 연출 | 기법 39종, 캐릭터 시트, 멀티앵글, 전환 브리지 |
| PR #1 | Monokai 다크 테마 |
| PR #2 | 월드 시트, AI 시나리오 연결, 180도 규칙, 결함 보정, 오디오·편집 큐시트, 파일명 수정 |
| 최종 검수 | 8장의 6건 수정, 테스트 38개 |

## 13. 다음 세션 시작 프롬프트 (복붙)
```
kaycomm21/flow-studio 저장소의 HANDOFF.md를 먼저 읽고 이어서 작업해줘.
2장 미해결 이슈부터 확인하고, 11장 백로그 중 [작업명]을 진행해줘.
작업 후 npm test / npm run build 통과 확인 → dist 포함 커밋 → 푸시 → 결과를 한국어 표로 보고.
```
