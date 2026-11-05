# 📦 Flow 콘티 스튜디오: 인수인계 문서

> 작성: Claude Code (ⓒ) · 2026-11-05 · 기준 커밋: `main` @ `856f639` (PR #1, #2 머지 완료)
> 사용자: 김영근 PD (1인 전용 도구, 코딩 배경 없음). **UI·보고는 한국어**, 답변은 결론 → 근거 → Action Step 순서로.

---

## 1. 한 줄 요약
AI 영상(Flow 등) 제작용 **콘티 → 샷별 영어 프롬프트 → 생성 기록·크레딧 관리** 정적 웹앱입니다. 서버·API 키 없이 localStorage에만 저장합니다.

| 항목 | 값 |
|---|---|
| 저장소 | https://github.com/kaycomm21/flow-studio |
| 배포 주소 | https://kaycomm21.github.io/flow-studio/ |
| 스택 | Vite 6.4.5 + React 18.3.1 + TypeScript 5.6.3, 테스트 vitest 3.2.7 |
| 배포 | GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`) |
| 저장 | 브라우저 localStorage 키 `flow-studio-v1`, 백업은 JSON 내보내기 |
| 테스트 | `src/lib.test.ts`, 33개 케이스 통과 |

---

## 2. ⚠️ 먼저 처리할 미해결 이슈

| # | 이슈 | 원인 | 해결 방법 (사용자가 GitHub 화면에서 처리) |
|---|---|---|---|
| 1 | **`main`에 푸시하면 Pages 배포 실패** (Actions run #7, #9) | `github-pages` 환경의 배포 허용 브랜치가 `claude/flow-studio-mvp-q0e8ls`뿐 | Settings → Environments → `github-pages` → Deployment branches에 `main` 추가 |
| 2 | 기본 브랜치가 `claude/...`일 가능성 | 첫 푸시 브랜치가 기본 브랜치로 잡힘 | Settings → General → Default branch → `main` |
| 3 | 현재 사이트는 작업 브랜치 배포본 | 1번 때문 | 1·2 처리 후 Actions → Run workflow(main) |

> 1번을 처리하기 전까지는 **작업 브랜치에 푸시해야 사이트가 갱신**됩니다. `main`에 머지만 하면 사이트는 바뀌지 않습니다.

---

## 3. 파일 구조

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `src/lib.ts` | ~670 | **핵심 순수 로직**: 타입, 프리셋 A/B/C(STYLE BIBLE·기본 8샷·캐릭터·장소), 비트시트, 규칙 경고 `checkRules`, 프롬프트 조립 `buildVideoPrompt`/`buildImagePrompt`, 멀티앵글 `buildCoverage`, 전환 브리지 `buildBridge`, 캐릭터 시트, 크레딧/QC 계산, JSON·Markdown 내보내기, `parseProject`(구버전 데이터 호환) |
| `src/techniques.ts` | ~90 | 연출 기법 39종(구도·카메라·렌즈·조명·속도), 비트별 추천 `BEAT_RECO`, `recommend()`, 카메라무브 호환 `moves` |
| `src/director.ts` | ~250 | 월드 시트·월드 카메라 투어, 결함 태그 → 재생성 보정, **AI 시나리오 요청문/답변 파서**, 오디오 큐시트, 편집 CSV, `safeFileName` |
| `src/App.tsx` | ~820 | 단일 컴포넌트 UI: 5탭(브리프 / 콘티 / 연출 / 프롬프트 / 기록·크레딧), `Code` 색 구분 블록, `Sel` 셀렉트 |
| `src/styles.css` | ~160 | Monokai 다크 테마 (CSS 변수는 `:root`에 모음) |
| `src/lib.test.ts` | ~275 | vitest 단위 테스트 |
| `dist/` | — | **빌드 결과물도 커밋함** (Pages가 막힐 때 로컬 실행용). 소스를 고치면 `npm run build` 후 같이 커밋할 것 |
| `README.md` | — | 사용자용 사용법·로컬 실행법 (한국어) |

### 의존 방향 (순환 금지)
```
techniques.ts  ←(type만)─  lib.ts  ←  director.ts  ←  App.tsx
                 lib.ts → techniques.ts (값: recommend, techById)
```
`director.ts`는 `lib.ts`를 가져다 쓰기만 합니다. `lib.ts`에서 `director.ts`를 import하지 마세요.

---

## 4. 데이터 모델 (`Project`)

```ts
Project {
  brief:      { series, channel, preset:'A'|'B'|'C', format:'shorts'|'long', topic, facts:[3] }
  bible:      { name, block(STYLE BIBLE 문장), lensWide, lensClose, render }
  characters: [{ id:'C1', name(한국어 라벨·프롬프트 제외), look, wardrobe, signature }]
  locations:  [{ id:'L1', name, place, details }]
  shots:      Shot[]
  credit:     { start:1050, pastUsed, pastEpisodes }
}
Shot {
  id, beat, purposeType('질문'|'답'), purpose,
  size(EWS|WS|MS|MCU|CU|INSERT), angle(로우|아이|하이|탑),
  move(''|고정|돌리인|돌리아웃|패닝|트럭|크레인|핸드헬드), speed, endState,
  subject, action(동작 1개), setting, lighting,
  transition(하드컷|매치컷|빛변화|암전), seconds, model(Lite|Fast|Quality|Omni), keyframe,
  techniques: string[], characterId, locationId, screenDir(''|좌→우|우→좌|카메라로|멀어짐), sfx,
  status(대기|생성|채택|재생성|폐기), credits, qc:[5], defects: string[]
}
```

**필드를 추가할 때 체크리스트 (빠뜨리면 구버전 데이터가 깨짐):**
1. `lib.ts`의 `Shot`/`Project` 타입
2. `defaultShots()`와 `blankShot()`에 기본값 추가. `parseProject`가 `blankShot`과 합쳐서 구버전 데이터를 보정합니다
3. 배열이나 객체를 새로 넣었다면 `parseProject`에 `Array.isArray(...) ? ... : base.x` 처리 추가
4. `exportJson`과 필요하면 `exportMarkdown`
5. 사람이 텍스트를 입력하는 필드라면 `projectRealNames`(실존 인물 검사)에 추가
6. 테스트 추가

---

## 5. 프롬프트 조립 순서 (`buildVideoPrompt`)
```
1  [camera] 속도+무브, 샷크기, 앵글, ending 끝상태.
2  [subject] 피사체 + 동작 1개 (+ 화면 방향)
3  Character lock: ...        (characterId 있을 때)
4  Location lock: ...         (locationId 있을 때)
5  Setting: ...; lighting and time: ...
6  Lens and render: 렌즈(CU·INSERT는 lensClose), render, 9:16|16:9
7  Cinematography: 기법들      (techniques 있을 때)
8  STYLE BIBLE: ...
9  No text, no logos, no real people, no watermark.
(재생성 시) Fix from previous take: ...   ← director.buildRegenPrompt
```
- 빈 줄은 `filter(Boolean)`으로 빠집니다.
- UI의 `Code` 컴포넌트는 `^[A-Z][A-Za-z ]{2,24}:` 형태의 줄 머리를 핑크로 칠합니다. 새 줄 머리를 만들 때 이 형식을 지키면 자동으로 색이 들어갑니다.

## 6. 규칙 경고 (`checkRules` → 빨간 배지)
| rule | 조건 |
|---|---|
| `sameSize` | 같은 샷크기 3연속 |
| `noMove` | 카메라무브 미지정 |
| `fewFixed` | 연속 3샷 중 `고정` 0개 |
| `multiAction` | action에 `그리고` / `and`(단어) / `&` |
| `noInsert` | 전체에 INSERT 0개 |
| `techConflict` | 기법의 `moves`와 샷 move 불일치 (예: 고정샷 + 돌리 줌) |
| `axisFlip` | 연속 샷 좌→우 ↔ 우→좌 반전 (앞 샷 전환이 `암전`이면 허용) |

> **불변 조건:** 프리셋 A·B·C의 기본 8샷은 경고 0개여야 합니다 (테스트가 강제). 기본 샷을 고치면 `npm test`로 확인하세요.

---

## 7. 개발·배포 명령어 (복붙용)

**왜:** 수정 → 테스트 → 빌드 → 커밋 순서를 지켜야 사이트와 `dist/`가 어긋나지 않습니다.

```bash
npm install
```
```bash
npm run dev
```
→ http://localhost:5173 에서 개발 화면 확인

```bash
npm test
```
→ `Tests  33 passed` 가 나와야 정상

```bash
npm run build
```
→ `✓ built in ...` 이 나오고 `dist/`가 갱신됨 (이 폴더도 커밋 대상)

모바일 확인: 클라우드 환경에서는 Playwright(Chromium 설치됨)로 `viewport {width:375}`에서 스크린샷을 찍고 `document.documentElement.scrollWidth === 375`(가로 넘침 없음)를 확인했습니다.

### 커밋 규칙
- 산출물 파일명에는 생성 주체 식별자를 붙입니다. 앱의 다운로드 파일명은 브라우저 호환 문제로 **`ⓒ` 대신 `_C_`**를 씁니다 (`safeFileName`, 예: `flow_Ep-1_C_20261105-0907.json`). 한글이나 `ⓒ`가 들어가면 Chrome이 파일명을 `download`로 바꾸는 현상이 컨테이너에서 확인됐습니다.
- 커밋 메시지는 한국어로, 무엇을 왜 바꿨는지 적습니다.

---

## 8. 설계 원칙 (사용자와 합의된 것)

1. **외부 API 호출·키 입력란 금지.** AI가 필요한 기능은 "요청문 복사 → 사용자의 Claude/Gemini 구독 → 답변 붙여넣기" 방식으로 만듭니다 (`buildScenarioRequest` / `parseScenarioResponse` 패턴을 재사용).
2. **실존 인물·정당·브랜드 금지.** `findRealNames`는 약 47개 이름 목록 기반이라 빈틈이 있습니다.
3. **타사 서비스는 통째로 베끼지 않습니다.** 뉴테이크 등은 기능 개념만 참고하고 이름·UI·문구는 독자적으로 만듭니다 (6장 표의 기능들이 그 결과).
4. 기능 추가보다 **작동하는 결과물 + 배포**가 우선입니다. 숫자·기한·담당이 없는 제안은 미완성으로 봅니다.
5. 피사체·동작·장소·조명은 **영어 입력이 전제**입니다 (번역 API 없음).

---

## 9. 남은 작업 백로그 (우선순위순)

| 우선 | 작업 | 난이도 | 비고 |
|---|---|---|---|
| P0 | 2장 미해결 이슈 1·2 처리 확인 → `main` 배포 성공 확인 | 하 | 사용자 작업. 확인만 하면 됨 |
| P1 | 실제 사용 검증: 연출 기법 유무에 따른 QC 점수 비교 데이터 수집 → 효과 없는 기법 제거·기본값 조정 | 중 | 사용자 데이터가 쌓여야 가능 |
| P1 | **vgen.py 연결**: 로컬 자동 생성 스크립트가 JSON(`shots[].prompt / imagePrompt / seconds / model`)을 읽도록 | 중 | JSON 스키마는 `exportJson` 기준. vgen.py는 사용자 로컬(Antigravity)에 있음 |
| P2 | 롱폼(16:9) 전용 비트시트 (현재는 60초 6비트를 그대로 씀) | 중 | `BEATS`를 포맷별로 분리 |
| P2 | 여러 에피소드 관리 (현재는 1프로젝트 = localStorage 1개) | 중 | 에피소드 목록 + 크레딧 누적 자동화 |
| P2 | 실존 인물 목록 확장 또는 사용자 정의 금지어 | 하 | `REAL_NAMES` |
| P3 | `App.tsx` 분리 (탭별 컴포넌트) | 중 | 800줄 넘음. 기능은 그대로 두고 구조만 리팩터링 |
| P3 | 밝은 테마 토글 | 하 | 현재 Monokai 다크 고정 |
| P3 | Firebase(`copper-guide-480206-b0`, Firestore 서울 리전) 동기화로 PC·태블릿 공유 | 상 | "서버 없음" 원칙과 충돌하므로 사용자 확인 필수 |

---

## 10. 이력

| 날짜 | 내용 | 참조 |
|---|---|---|
| 2026-11-05 | MVP 4탭(브리프·콘티·프롬프트·기록), 규칙 경고 5종, 크레딧/QC, JSON·MD 내보내기, Pages 배포 | 커밋 `925701c` |
| 2026-11-05 | 연출 탭(기법 39종·비트 추천·호환 경고), 캐릭터 시트, 멀티앵글 6종, 전환 브리지 | `f487da5` |
| 2026-11-05 | Monokai 다크 테마, 설정 리스트형 레이아웃, 프롬프트 색 구분 | PR #1 |
| 2026-11-05 | 월드 시트·월드 카메라, AI 시나리오 연결, 180도 규칙, 결함 보정, 오디오·편집 큐시트, 파일명 버그 수정 | PR #2 |

---

## 11. 다음 세션 시작용 프롬프트 (복붙)

```
kaycomm21/flow-studio 저장소의 HANDOFF.md를 먼저 읽고 이어서 작업해줘.
2장 미해결 이슈부터 확인하고, 9장 백로그 중 [작업명]을 진행해줘.
작업 후 npm test / npm run build 통과 확인 → dist 포함 커밋 → 푸시 → 결과를 한국어 표로 보고.
```
