# 🎬 Flow 콘티 스튜디오 (MVP)

AI 영상 생성(Flow 등)용 **쇼츠/롱폼 콘티 → 샷별 영어 프롬프트 → 생성 기록·크레딧 관리**를 한 화면에서 하는 정적 웹앱입니다.
서버·API 키 없음. 모든 데이터는 **내 브라우저(localStorage)** 에만 저장됩니다.

- 🌐 Pages 주소(배포 성공 시): https://kaycomm21.github.io/flow-studio/
- 📦 배포가 안 될 때: 이 저장소의 `dist/` 폴더가 이미 빌드된 완성본입니다 (아래 "로컬 실행" 참고)

## ✅ 사용법 5줄
1. **브리프** 탭: 시리즈명·채널·주제·핵심 사실 3줄 입력 → 장르 프리셋(A/B/C) 클릭 시 STYLE BIBLE과 8샷이 자동 배치됩니다.
2. **콘티** 탭: 6단 비트시트(후킹~CTA)에 배치된 8샷 표를 수정합니다. 빨간 배지 = 규칙 위반(3연속 같은 샷크기, 무브 미지정, 고정샷 부족, 동작 2개, INSERT 0개).
3. **프롬프트** 탭: 샷별 영어 프롬프트가 자동 조립됩니다. 카드별 [복사] 또는 [📋 전체 복사] → Flow에 붙여넣기. 키프레임 Y 샷은 Nano Banana용 이미지 프롬프트도 함께 나옵니다.
4. **기록·크레딧** 탭: 샷별 상태와 사용 크레딧을 입력하면 잔량 바(시작 1,050)·1편 평균 단가·남은 가능 편수가 계산됩니다. QC 5항목 평균 3.5 미만이면 "재생성 필요" 표시.
5. **브리프** 탭 하단에서 JSON 내보내기/불러오기(백업·다른 PC 이동·vgen.py 연결용), Markdown 콘티 다운로드.

> 💡 피사체·동작·장소·조명 칸은 **영어로** 쓰면 그대로 프롬프트에 들어갑니다 (번역 API를 쓰지 않기 때문).
> ⚠️ 실존 인물·정당 이름(목록 기반)이 입력되면 상단에 경고가 뜹니다. 목록에 없는 이름은 못 잡으니 직접 확인하세요.

## 💻 로컬 실행 (Pages가 막혔을 때)
**왜?** GitHub Pages 배포가 안 돼도, 내 PC에서 바로 띄워 쓸 수 있게 하기 위함입니다. Node.js(https://nodejs.org, LTS) 설치가 필요합니다.

방법 A — 이미 빌드된 `dist/` 바로 쓰기 (가장 간단)
```bash
git clone https://github.com/kaycomm21/flow-studio.git
```
```bash
cd flow-studio
```
```bash
npx vite preview --outDir dist
```
→ 터미널에 `Local: http://localhost:4173/` 이 뜨면 그 주소를 브라우저로 엽니다.

방법 B — 소스에서 직접 실행 (수정·개발용)
```bash
npm install
```
```bash
npm run dev
```
→ `http://localhost:5173/` 접속. 테스트는 `npm test`, 배포용 빌드는 `npm run build` (결과물: `dist/`).

## 🚀 GitHub Pages 켜는 법 (1회, 저장소 주인만 가능)
1. 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions** 선택
2. **Actions** 탭에서 "Deploy to GitHub Pages" 워크플로 → **Run workflow**
3. 완료 후 https://kaycomm21.github.io/flow-studio/ 접속

## 📁 구조
| 파일 | 역할 |
|---|---|
| `src/lib.ts` | 프리셋·비트시트·규칙 경고·프롬프트 조립·크레딧 계산·내보내기 (순수 함수) |
| `src/lib.test.ts` | vitest 단위 테스트 17개 |
| `src/App.tsx` | 4탭 화면 |
| `dist/` | 빌드 결과물 (커밋됨) |
| `.github/workflows/deploy.yml` | Pages 자동 배포 |
