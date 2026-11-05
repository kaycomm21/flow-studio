// 영화 연출 기법 라이브러리 — 샷에 붙이면 영어 프롬프트 "Cinematography:" 줄로 들어간다.
import type { BeatKey, Move } from './lib';

export type TechCat = '구도' | '카메라' | '렌즈·초점' | '조명·색' | '속도·질감';
export const TECH_CATS: TechCat[] = ['구도', '카메라', '렌즈·초점', '조명·색', '속도·질감'];

export interface Technique {
  id: string;
  cat: TechCat;
  ko: string;
  en: string;
  use: string; // 언제 쓰나 (감정·목적)
  moves?: Move[]; // 지정되면 이 카메라무브와만 호환
}

export const TECHNIQUES: Technique[] = [
  // 구도
  { id: 'thirds', cat: '구도', ko: '3분할 구도', en: 'subject placed on a rule-of-thirds line', use: '안정감 · 인터뷰 · 기본기' },
  { id: 'center', cat: '구도', ko: '중앙 대칭', en: 'perfectly symmetrical centered composition', use: '권위 · 초현실 · 신비' },
  { id: 'leading', cat: '구도', ko: '리딩 라인', en: 'strong leading lines drawing the eye to the subject', use: '공간 깊이 · 시선 유도' },
  { id: 'framein', cat: '구도', ko: '프레임 속 프레임', en: 'framed through a doorway or arch (frame within a frame)', use: '고립 · 엿보기 · 긴장' },
  { id: 'negative', cat: '구도', ko: '여백 강조', en: 'vast negative space around a small subject', use: '고독 · 압도적 스케일 · 여운' },
  { id: 'foreground', cat: '구도', ko: '전경 걸치기', en: 'out-of-focus foreground elements partially framing the shot for depth', use: '깊이감 · 관찰자 시점' },
  { id: 'ots', cat: '구도', ko: '어깨 너머(OTS)', en: 'over-the-shoulder framing', use: '대화 · 관계 · 대치' },
  { id: 'dutch', cat: '구도', ko: '더치 앵글', en: 'dutch tilt with a canted horizon', use: '불안 · 이상징후 · 반전' },
  { id: 'silhouette', cat: '구도', ko: '실루엣', en: 'subject in full silhouette against a bright background', use: '미스터리 · 얼굴 비노출 · 상징' },
  { id: 'pov', cat: '구도', ko: '1인칭 POV', en: 'first-person point-of-view shot', use: '몰입 · 체험형 후킹' },
  // 카메라
  { id: 'dollyzoom', cat: '카메라', ko: '돌리 줌(버티고)', en: 'dolly zoom (vertigo effect): background stretches while the subject stays the same size', use: '충격 · 깨달음 · 반전', moves: ['돌리인', '돌리아웃'] },
  { id: 'pushreveal', cat: '카메라', ko: '푸시인 리빌', en: 'slow push-in that reveals a hidden detail', use: '단서 공개 · 집중', moves: ['돌리인'] },
  { id: 'pullreveal', cat: '카메라', ko: '풀백 리빌', en: 'pull-back reveal exposing the true scale of the scene', use: '해소 · 스케일 공개', moves: ['돌리아웃', '크레인'] },
  { id: 'orbit', cat: '카메라', ko: '오빗(아크)', en: 'slow arc orbiting around the subject', use: '영웅화 · 입체 공개', moves: ['트럭', '크레인', '핸드헬드'] },
  { id: 'parallax', cat: '카메라', ko: '패럴랙스', en: 'lateral parallax with layered foreground and background', use: '입체감 · 고급스러움', moves: ['트럭', '패닝', '크레인'] },
  { id: 'whip', cat: '카메라', ko: '휩 팬', en: 'fast whip pan with motion blur', use: '에너지 · 장면 전환', moves: ['패닝', '핸드헬드'] },
  { id: 'tracking', cat: '카메라', ko: '팔로우 트래킹', en: 'steady tracking shot following the subject from behind', use: '여정 · 동행감', moves: ['트럭', '핸드헬드', '돌리인'] },
  { id: 'fpv', cat: '카메라', ko: 'FPV 드론', en: 'FPV drone flight diving through the space', use: '속도감 · 쇼츠 후킹', moves: ['핸드헬드', '돌리인', '크레인'] },
  { id: 'locked', cat: '카메라', ko: '고정 관찰', en: 'locked-off observational frame with zero camera shake', use: '다큐 진지함 · 풍자', moves: ['고정'] },
  // 렌즈·초점
  { id: 'shallow', cat: '렌즈·초점', ko: '얕은 심도', en: 'shallow depth of field with creamy bokeh', use: '감정 · 피사체 분리' },
  { id: 'deep', cat: '렌즈·초점', ko: '딥 포커스', en: 'deep focus, sharp from foreground to background', use: '정보 전달 · 공간 설명' },
  { id: 'rack', cat: '렌즈·초점', ko: '랙 포커스', en: 'rack focus shifting from the foreground to the background subject', use: '시선 이동 · 단서 연결' },
  { id: 'ultrawide', cat: '렌즈·초점', ko: '초광각', en: 'ultra-wide 16mm perspective', use: '공간 과장 · 압도감' },
  { id: 'tele', cat: '렌즈·초점', ko: '망원 압축', en: 'long telephoto compression, 200mm', use: '압박감 · 거리감 압축' },
  { id: 'anamorphic', cat: '렌즈·초점', ko: '아나모픽', en: 'anamorphic lens look with oval bokeh and horizontal flares', use: '극장판 질감' },
  // 조명·색
  { id: 'lowkey', cat: '조명·색', ko: '로우키 명암', en: 'low-key chiaroscuro lighting with deep shadows', use: '미스터리 · 긴장' },
  { id: 'rembrandt', cat: '조명·색', ko: '렘브란트 조명', en: 'Rembrandt lighting with a small triangle of light on the cheek', use: '인물 드라마 · 인터뷰' },
  { id: 'rim', cat: '조명·색', ko: '림 라이트', en: 'strong rim light separating the subject from the background', use: '윤곽 강조 · 영웅성' },
  { id: 'godrays', cat: '조명·색', ko: '빛줄기(볼류메트릭)', en: 'volumetric god rays cutting through haze', use: '경외감 · 신성함' },
  { id: 'golden', cat: '조명·색', ko: '골든아워', en: 'golden hour backlight from a low warm sun', use: '따뜻함 · 해소 · 감성' },
  { id: 'bluehour', cat: '조명·색', ko: '블루아워', en: 'blue hour ambient twilight', use: '쓸쓸함 · 여운' },
  { id: 'practical', cat: '조명·색', ko: '실광원(프랙티컬)', en: 'motivated practical light sources visible in frame', use: '사실감 · 분위기' },
  { id: 'tealorange', cat: '조명·색', ko: '틸&오렌지', en: 'teal-and-orange color contrast', use: '블록버스터 톤' },
  { id: 'neon', cat: '조명·색', ko: '네온 대비', en: 'neon magenta and cyan color contrast', use: '도시 · 사이버 · 밤' },
  // 속도·질감
  { id: 'slowmo', cat: '속도·질감', ko: '슬로모션', en: 'slow motion at 120fps', use: '강조 · 여운' },
  { id: 'ramp', cat: '속도·질감', ko: '스피드 램프', en: 'speed ramp from real time into slow motion', use: '임팩트 순간' },
  { id: 'timelapse', cat: '속도·질감', ko: '타임랩스', en: 'time-lapse with fast-moving clouds and shadows', use: '시간 경과 · 스케일' },
  { id: 'grain', cat: '속도·질감', ko: '필름 그레인', en: '35mm film grain with subtle halation', use: '아날로그 질감 · 고급감' },
  { id: 'haze', cat: '속도·질감', ko: '대기 연무', en: 'atmospheric haze adding depth layers', use: '깊이감 · 신비' },
];

export const techById = (id: string) => TECHNIQUES.find((t) => t.id === id);

// 비트별 추천 순서(앞쪽 우선)
export const BEAT_RECO: Record<BeatKey, string[]> = {
  hook: ['silhouette', 'pov', 'dollyzoom', 'fpv', 'godrays', 'center'],
  context: ['leading', 'deep', 'negative', 'parallax'],
  develop: ['foreground', 'rack', 'ots', 'tracking', 'pushreveal', 'practical'],
  twist: ['dutch', 'dollyzoom', 'pushreveal', 'lowkey', 'rack'],
  resolve: ['pullreveal', 'center', 'golden', 'deep'],
  cta: ['negative', 'slowmo', 'silhouette', 'bluehour'],
};

export const isCompatible = (t: Technique, move: Move) => !t.moves || t.moves.includes(move);

/** 비트·카메라무브에 맞는 기법 최대 max개 추천 (카테고리당 1개, 무브 비호환 제외) */
export function recommend(beat: BeatKey, move: Move, max = 2): string[] {
  const out: Technique[] = [];
  for (const id of BEAT_RECO[beat]) {
    const t = techById(id);
    if (!t || !isCompatible(t, move) || out.some((o) => o.cat === t.cat)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out.map((t) => t.id);
}
