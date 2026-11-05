// Flow 콘티 스튜디오 — 순수 로직(테스트 대상). UI 없음, 외부 API 호출 없음.
import { recommend, techById } from './techniques';

export type PresetKey = 'A' | 'B' | 'C';
export type FormatKey = 'shorts' | 'long';
export type ShotSize = 'EWS' | 'WS' | 'MS' | 'MCU' | 'CU' | 'INSERT';
export type Angle = '로우' | '아이' | '하이' | '탑';
export type Move = '' | '고정' | '돌리인' | '돌리아웃' | '패닝' | '트럭' | '크레인' | '핸드헬드';
export type Speed = '' | '느리게' | '보통' | '빠르게';
export type Transition = '하드컷' | '매치컷' | '빛변화' | '암전';
export type Model = 'Lite' | 'Fast' | 'Quality' | 'Omni';
export type Status = '대기' | '생성' | '채택' | '재생성' | '폐기';
export type BeatKey = 'hook' | 'context' | 'develop' | 'twist' | 'resolve' | 'cta';
export type ScreenDir = '' | '좌→우' | '우→좌' | '카메라로' | '멀어짐';

export interface Brief {
  series: string;
  channel: string;
  preset: PresetKey;
  format: FormatKey;
  topic: string;
  facts: [string, string, string];
}

export interface Bible {
  name: string;
  block: string;
  lensWide: string;
  lensClose: string;
  render: string;
}

export interface Shot {
  id: string;
  beat: BeatKey;
  purposeType: '질문' | '답';
  purpose: string;
  size: ShotSize;
  angle: Angle;
  move: Move;
  speed: Speed;
  endState: string;
  subject: string;
  action: string;
  setting: string;
  lighting: string;
  transition: Transition;
  seconds: number;
  model: Model;
  keyframe: boolean;
  techniques: string[]; // 연출 기법 id
  characterId: string; // '' = 없음
  locationId: string; // '' = 없음
  screenDir: ScreenDir; // 화면 진행 방향 (180도 규칙)
  sfx: string; // 효과음 메모 (비우면 자동)
  defects: string[]; // 생성 결과 결함 태그
  // 생성 기록
  status: Status;
  credits: number;
  qc: [number, number, number, number, number];
}

export interface CreditState {
  start: number;
  pastUsed: number;
  pastEpisodes: number;
}

export interface Character {
  id: string;
  name: string; // 한국어 라벨 (프롬프트에 안 들어감)
  look: string;
  wardrobe: string;
  signature: string;
}

export interface Location {
  id: string;
  name: string; // 한국어 라벨
  place: string;
  details: string;
}

export interface Project {
  brief: Brief;
  bible: Bible;
  characters: Character[];
  locations: Location[];
  shots: Shot[];
  credit: CreditState;
}

// ───────── 선택지 ─────────
export const SIZES: ShotSize[] = ['EWS', 'WS', 'MS', 'MCU', 'CU', 'INSERT'];
export const ANGLES: Angle[] = ['로우', '아이', '하이', '탑'];
export const MOVES: Move[] = ['', '고정', '돌리인', '돌리아웃', '패닝', '트럭', '크레인', '핸드헬드'];
export const SPEEDS: Speed[] = ['', '느리게', '보통', '빠르게'];
export const TRANSITIONS: Transition[] = ['하드컷', '매치컷', '빛변화', '암전'];
export const MODELS: Model[] = ['Lite', 'Fast', 'Quality', 'Omni'];
export const STATUSES: Status[] = ['대기', '생성', '채택', '재생성', '폐기'];
export const SCREEN_DIRS: ScreenDir[] = ['', '좌→우', '우→좌', '카메라로', '멀어짐'];
export const QC_LABELS = ['의도', '연속성', '움직임', '결함', '사용구간 2초↑'] as const;

export const BEATS: { key: BeatKey; label: string; from: number; to: number }[] = [
  { key: 'hook', label: '후킹', from: 0, to: 3 },
  { key: 'context', label: '맥락', from: 3, to: 12 },
  { key: 'develop', label: '전개', from: 12, to: 30 },
  { key: 'twist', label: '반전', from: 30, to: 45 },
  { key: 'resolve', label: '해소', from: 45, to: 55 },
  { key: 'cta', label: '여운·CTA', from: 55, to: 60 },
];
export const beatLabel = (k: BeatKey) => BEATS.find((b) => b.key === k)?.label ?? k;

// 8샷 자동 배치: 비트별 샷 수
export const BEAT_LAYOUT: BeatKey[] = ['hook', 'context', 'develop', 'develop', 'twist', 'twist', 'resolve', 'cta'];
const DEFAULT_SECONDS = [3, 8, 8, 8, 7, 7, 8, 5];

// ───────── 영어 매핑 ─────────
const SIZE_EN: Record<ShotSize, string> = {
  EWS: 'extreme wide shot',
  WS: 'wide shot',
  MS: 'medium shot',
  MCU: 'medium close-up',
  CU: 'close-up',
  INSERT: 'insert detail shot',
};
const ANGLE_EN: Record<Angle, string> = {
  로우: 'low angle',
  아이: 'eye-level angle',
  하이: 'high angle',
  탑: 'top-down overhead angle',
};
const MOVE_EN: Record<Move, string> = {
  '': '',
  고정: 'static locked-off camera',
  돌리인: 'dolly in',
  돌리아웃: 'dolly out',
  패닝: 'pan',
  트럭: 'truck (lateral tracking)',
  크레인: 'crane up',
  핸드헬드: 'handheld',
};
const SPEED_EN: Record<Speed, string> = { '': '', 느리게: 'slow', 보통: 'steady', 빠르게: 'fast' };

export const NEGATIVE = 'no text, no logos, no real people, no watermark';

// ───────── STYLE BIBLE 프리셋 ─────────
export const BIBLES: Record<PresetKey, Bible> = {
  A: {
    name: 'A 신비 건축',
    block:
      'desaturated teal grade, warm practical light, volumetric dust and fog, 35mm for space / 100mm macro for stone texture, signature motif = lone explorer silhouette holding an oil lantern (face never visible), awe and mystery',
    lensWide: '35mm lens',
    lensClose: '100mm macro lens for stone texture',
    render: 'cinematic photoreal render',
  },
  B: {
    name: 'B 동물 의인화 풍자',
    block:
      'documentary seriousness, locked-off tripod, interview MCU on rule of thirds, fictional "Cloud Kingdom" with raccoon civil servants, acorns as budget, soft office fluorescent light, no real politicians or parties',
    lensWide: '35mm documentary lens',
    lensClose: '50mm lens',
    render: 'documentary realism, photoreal anthropomorphic animals',
  },
  C: {
    name: 'C B롤',
    block: 'clean cinematic stock look, 24fps, natural light, one subject action',
    lensWide: '35mm lens',
    lensClose: '85mm lens',
    render: 'clean cinematic stock footage',
  },
};

// ───────── 프리셋별 기본 8샷 ─────────
type Row = [ShotSize, Angle, Move, Speed, string, string, string, string, string, Transition, Model, boolean];
//          size     angle  move  speed endState subject action setting lighting transition model keyframe

const ROWS: Record<PresetKey, Row[]> = {
  A: [
    ['EWS', '로우', '크레인', '느리게', 'revealing the full hall', 'A lone explorer silhouette holding an oil lantern (face never visible)', 'stops at the edge of a vast underground stone hall', 'colossal ancient underground hall with carved pillars', 'warm lantern glow against deep darkness, night', '하드컷', 'Quality', true],
    ['WS', '아이', '고정', '', 'holding a locked frame', 'An ancient carved stone gate', 'fog drifts slowly through the gate', 'mountain ravine at the entrance of a lost temple', 'cold blue dawn light', '매치컷', 'Fast', false],
    ['MS', '아이', '돌리인', '느리게', 'close on the carved wall', 'The explorer silhouette with the oil lantern', 'walks slowly toward a wall of unknown glyphs', 'narrow stone corridor', 'lantern light flickering on wet stone', '하드컷', 'Fast', false],
    ['INSERT', '탑', '고정', '', 'holding on the stone texture', 'Weathered stone glyphs', 'dust falls from the carved grooves', 'detail of the corridor wall', 'raking warm lantern light', '빛변화', 'Lite', false],
    ['MCU', '하이', '패닝', '느리게', 'settling on the hidden doorway', 'A hidden stone doorway', 'slides open a few centimeters', 'end of the corridor', 'thin shaft of golden light from behind the door', '하드컷', 'Quality', true],
    ['CU', '로우', '고정', '', 'holding on the lantern', "The explorer's hand holding the lantern (face never visible)", 'lifts the lantern toward the light', 'doorway threshold', 'warm lantern light shifting to bright gold', '빛변화', 'Fast', false],
    ['WS', '아이', '돌리아웃', '느리게', 'with the explorer small in frame', 'The explorer silhouette', 'steps into a vast chamber of golden geometry', 'impossible sacred-geometry chamber', 'volumetric golden light beams through dust', '암전', 'Quality', true],
    ['EWS', '하이', '고정', '', 'holding a wide locked frame', 'The ancient structure exterior', 'stands silent as fog rolls over it', 'mountain valley', 'fading dusk, last warm light', '암전', 'Lite', false],
  ],
  B: [
    ['MCU', '아이', '고정', '', 'holding a locked-off interview frame', 'A raccoon civil servant in a grey suit', 'slams a stamp on a budget document', 'Cloud Kingdom ministry office', 'soft office fluorescent light, afternoon', '하드컷', 'Fast', true],
    ['WS', '아이', '돌리인', '느리게', 'on the meeting table', 'Raccoon officials around a meeting table piled with acorns', 'push a pile of acorns to the center', 'Cloud Kingdom council room', 'soft office fluorescent light', '하드컷', 'Fast', false],
    ['INSERT', '탑', '고정', '', 'holding on the ledger', 'A budget ledger with acorn icons', 'a raccoon paw crosses out a number', 'desk in the ministry office', 'soft office fluorescent light', '매치컷', 'Lite', false],
    ['MCU', '아이', '고정', '', 'holding on rule of thirds', 'A raccoon minister in an interview setup', 'adjusts his tie nervously', 'ministry press room', 'soft office fluorescent light', '하드컷', 'Quality', true],
    ['MS', '하이', '패닝', '느리게', 'settling on an empty shelf', 'An acorn vault with empty shelves', 'the last acorn rolls off a shelf', 'Cloud Kingdom treasury vault', 'flickering fluorescent tube', '하드컷', 'Fast', false],
    ['CU', '아이', '고정', '', 'holding on the face', 'The raccoon minister', 'freezes with eyes widening', 'ministry press room', 'soft office fluorescent light', '빛변화', 'Fast', false],
    ['WS', '아이', '트럭', '느리게', 'along the queue', 'Raccoon citizens holding empty baskets', 'queue outside the ministry gate', 'Cloud Kingdom plaza', 'overcast afternoon light', '하드컷', 'Quality', false],
    ['MCU', '아이', '고정', '', 'holding on the empty chair', 'The raccoon civil servant', 'walks out of frame leaving an empty chair', 'Cloud Kingdom ministry office', 'office lights dimming, evening', '암전', 'Lite', false],
  ],
  C: [
    ['EWS', '하이', '크레인', '느리게', 'rising above the rooftops', 'A city skyline', 'sunlight spreads across the glass towers', 'modern city', 'golden hour sunrise', '하드컷', 'Quality', true],
    ['WS', '아이', '고정', '', 'holding a locked frame', 'Commuters on a crosswalk', 'cross the street in a steady flow', 'downtown intersection', 'soft morning light', '하드컷', 'Fast', false],
    ['MS', '아이', '돌리인', '느리게', 'close on the cup', 'A barista', 'pours steamed milk into a cup', 'small cafe counter', 'natural window light', '매치컷', 'Fast', false],
    ['INSERT', '탑', '고정', '', 'holding on the cup', 'A coffee cup', 'latte art forms on the surface', 'cafe counter', 'natural window light', '하드컷', 'Lite', false],
    ['MCU', '아이', '패닝', '느리게', 'settling on the laptop screen glow', 'An anonymous young professional seen from behind', 'types on a laptop', 'co-working space', 'diffused daylight', '하드컷', 'Fast', false],
    ['CU', '로우', '고정', '', 'holding on the notebook', 'A pair of hands', 'writes a note in a notebook', 'wooden desk', 'warm desk lamp, evening', '빛변화', 'Fast', false],
    ['WS', '아이', '트럭', '보통', 'alongside the rider', 'A cyclist', 'rides along the river path', 'riverside park', 'late afternoon backlight', '하드컷', 'Quality', false],
    ['EWS', '하이', '고정', '', 'holding a wide locked frame', 'The city skyline', 'lights turn on as dusk falls', 'modern city', 'blue hour', '암전', 'Lite', false],
  ],
};

export const CHARACTERS: Record<PresetKey, Character[]> = {
  A: [
    { id: 'C1', name: '랜턴 탐험가', look: 'lone explorer silhouette, tall and slim, face always hidden in shadow', wardrobe: 'long weathered canvas coat, wide-brim hat, leather satchel', signature: 'carries an old brass oil lantern' },
  ],
  B: [
    { id: 'C1', name: '너구리 주무관', look: 'anthropomorphic raccoon civil servant, plump, tired eyes', wardrobe: 'grey suit, loose tie, ID lanyard', signature: 'always holds a red rubber stamp' },
    { id: 'C2', name: '너구리 장관', look: 'older anthropomorphic raccoon minister with grey-streaked fur', wardrobe: 'navy suit, gold acorn lapel pin', signature: 'adjusts his tie when nervous' },
  ],
  C: [],
};
export const LOCATIONS: Record<PresetKey, Location[]> = {
  A: [
    { id: 'L1', name: '지하 신전', place: 'colossal ancient temple carved deep inside a mountain', details: 'weathered sandstone pillars, glyph-covered walls, hidden golden sacred-geometry chamber' },
  ],
  B: [
    { id: 'L1', name: '구름왕국 부처 청사', place: 'Cloud Kingdom ministry building', details: 'beige 1990s government office interior, acorn-shaped emblems, grey filing cabinets, fluorescent ceiling panels' },
  ],
  C: [],
};
const LOC_MAP: Record<PresetKey, string[]> = {
  A: ['L1', '', 'L1', 'L1', 'L1', 'L1', 'L1', ''],
  B: ['L1', 'L1', 'L1', 'L1', '', 'L1', '', 'L1'],
  C: ['', '', '', '', '', '', '', ''],
};

const CHAR_MAP: Record<PresetKey, string[]> = {
  A: ['C1', '', 'C1', '', '', 'C1', 'C1', ''],
  B: ['C1', '', '', 'C2', '', 'C2', '', 'C1'],
  C: ['', '', '', '', '', '', '', ''],
};

const PURPOSES: [Shot['purposeType'], string][] = [
  ['질문', '이게 뭐지? (호기심 유발)'],
  ['답', '어디인지 알려줌'],
  ['질문', '무엇을 찾는가?'],
  ['답', '단서 제시'],
  ['질문', '숨겨진 것은?'],
  ['답', '반전의 순간'],
  ['답', '전모 공개'],
  ['질문', '다음 편 궁금증'],
];

export function defaultShots(preset: PresetKey): Shot[] {
  return ROWS[preset].map((r, i) => ({
    id: `S${String(i + 1).padStart(2, '0')}`,
    beat: BEAT_LAYOUT[i],
    purposeType: PURPOSES[i][0],
    purpose: PURPOSES[i][1],
    size: r[0],
    angle: r[1],
    move: r[2],
    speed: r[3],
    endState: r[4],
    subject: r[5],
    action: r[6],
    setting: r[7],
    lighting: r[8],
    transition: r[9],
    seconds: DEFAULT_SECONDS[i],
    model: r[10],
    keyframe: r[11],
    techniques: recommend(BEAT_LAYOUT[i], r[2]),
    characterId: CHAR_MAP[preset][i],
    locationId: LOC_MAP[preset][i],
    screenDir: '',
    sfx: '',
    defects: [],
    status: '대기',
    credits: 0,
    qc: [0, 0, 0, 0, 0],
  }));
}

/** 기존 ID와 겹치지 않는 다음 샷 ID (삭제 후 추가해도 중복 없음) */
export function nextShotId(shots: Shot[]): string {
  const used = new Set(shots.map((s) => s.id));
  let n = shots.length + 1;
  while (used.has(`S${String(n).padStart(2, '0')}`)) n++;
  return `S${String(n).padStart(2, '0')}`;
}

export function blankShot(index: number): Shot {
  return {
    id: `S${String(index + 1).padStart(2, '0')}`,
    beat: 'develop',
    purposeType: '질문',
    purpose: '',
    size: 'MS',
    angle: '아이',
    move: '',
    speed: '',
    endState: '',
    subject: '',
    action: '',
    setting: '',
    lighting: '',
    transition: '하드컷',
    seconds: 5,
    model: 'Fast',
    keyframe: false,
    techniques: [],
    characterId: '',
    locationId: '',
    screenDir: '',
    sfx: '',
    defects: [],
    status: '대기',
    credits: 0,
    qc: [0, 0, 0, 0, 0],
  };
}

export function defaultProject(preset: PresetKey = 'A'): Project {
  return {
    brief: {
      series: '',
      channel: '',
      preset,
      format: 'shorts',
      topic: '',
      facts: ['', '', ''],
    },
    bible: { ...BIBLES[preset] },
    characters: CHARACTERS[preset].map((c) => ({ ...c })),
    locations: LOCATIONS[preset].map((l) => ({ ...l })),
    shots: defaultShots(preset),
    credit: { start: 1050, pastUsed: 0, pastEpisodes: 0 },
  };
}

// ───────── 규칙 경고 ─────────
export interface Warning {
  rule: 'sameSize' | 'noMove' | 'fewFixed' | 'multiAction' | 'noInsert' | 'techConflict' | 'axisFlip' | 'dupId' | 'overLength';
  shotIds: string[];
  message: string;
}

const MULTI_ACTION = /그리고|\band\b|&/i;

export function hasMultipleActions(action: string): boolean {
  return MULTI_ACTION.test(action);
}

export function checkRules(shots: Shot[], format: FormatKey = 'shorts'): Warning[] {
  const w: Warning[] = [];
  const seen = new Map<string, number>();
  for (const s of shots) seen.set(s.id, (seen.get(s.id) ?? 0) + 1);
  for (const [id, n] of seen) if (n > 1) w.push({ rule: 'dupId', shotIds: [id], message: `${id}: 샷ID 중복 ${n}개 — ID를 다르게 바꾸세요` });
  const total = shots.reduce((a, s) => a + (Number(s.seconds) || 0), 0);
  if (format === 'shorts' && total > 60) w.push({ rule: 'overLength', shotIds: [], message: `총 ${total}초 — 쇼츠 60초 초과` });
  for (let i = 2; i < shots.length; i++) {
    const [a, b, c] = [shots[i - 2], shots[i - 1], shots[i]];
    if (a.size === b.size && b.size === c.size) {
      w.push({ rule: 'sameSize', shotIds: [a.id, b.id, c.id], message: `${a.id}~${c.id}: 같은 샷크기(${c.size}) 3연속` });
    }
  }
  for (const s of shots) {
    if (!s.move) w.push({ rule: 'noMove', shotIds: [s.id], message: `${s.id}: 카메라무브 미지정` });
  }
  if (shots.length >= 3) {
    for (let i = 2; i < shots.length; i++) {
      const win = shots.slice(i - 2, i + 1);
      if (!win.some((s) => s.move === '고정')) {
        w.push({
          rule: 'fewFixed',
          shotIds: win.map((s) => s.id),
          message: `${win[0].id}~${win[2].id}: 3샷 중 고정샷 0개 (최소 1개)`,
        });
      }
    }
  }
  for (const s of shots) {
    if (hasMultipleActions(s.action)) {
      w.push({ rule: 'multiAction', shotIds: [s.id], message: `${s.id}: 동작이 2개 이상("그리고"/"and") — 1개로 줄이세요` });
    }
  }
  for (const s of shots) {
    for (const id of s.techniques ?? []) {
      const t = techById(id);
      if (t?.moves && !t.moves.includes(s.move)) {
        w.push({ rule: 'techConflict', shotIds: [s.id], message: `${s.id}: '${t.ko}'는 카메라무브 ${t.moves.join('/')}와 써야 함 (현재 ${s.move || '미지정'})` });
      }
    }
  }
  const lateral = (d: ScreenDir | undefined) => d === '좌→우' || d === '우→좌';
  for (let i = 1; i < shots.length; i++) {
    const [a, b] = [shots[i - 1], shots[i]];
    if (lateral(a.screenDir) && lateral(b.screenDir) && a.screenDir !== b.screenDir && a.transition !== '암전') {
      w.push({
        rule: 'axisFlip',
        shotIds: [a.id, b.id],
        message: `${a.id}→${b.id}: 화면 방향 반전(${a.screenDir} → ${b.screenDir}) — 180도 규칙 위반 가능. 의도라면 사이에 정면샷(카메라로)을 넣거나 암전으로 끊으세요`,
      });
    }
  }
  if (shots.length > 0 && !shots.some((s) => s.size === 'INSERT')) {
    w.push({ rule: 'noInsert', shotIds: [], message: '씬에 INSERT 샷이 0개 — 최소 1개 넣으세요' });
  }
  return w;
}

// ───────── 실존 인물·정당 경고(목록 기반) ─────────
const REAL_NAMES = [
  '윤석열', '이재명', '문재인', '박근혜', '이명박', '노무현', '김대중', '한동훈', '김건희', '이준석', '안철수',
  '홍준표', '오세훈', '김문수', '트럼프', '바이든', '오바마', '시진핑', '푸틴', '김정은', '기시다', '이시바', '마크롱',
  '머스크', '이재용', '이건희', '정의선', '손흥민', '유재석', '아이유', '국민의힘', '더불어민주당', '민주당',
  '조국혁신당', '개혁신당', '정의당', 'trump', 'biden', 'obama', 'putin', 'xi jinping', 'kim jong', 'elon musk',
  'musk', 'zelensky', 'taylor swift',
];

export function findRealNames(text: string): string[] {
  const t = text.toLowerCase();
  return REAL_NAMES.filter((n) => t.includes(n.toLowerCase()));
}

export function projectRealNames(p: Project): string[] {
  const parts = [p.brief.series, p.brief.channel, p.brief.topic, ...p.brief.facts];
  for (const c of p.characters ?? []) parts.push(c.name, c.look, c.wardrobe, c.signature);
  for (const l of p.locations ?? []) parts.push(l.name, l.place, l.details);
  for (const s of p.shots) parts.push(s.sfx ?? '');
  for (const s of p.shots) parts.push(s.subject, s.action, s.setting, s.lighting, s.endState, s.purpose);
  return [...new Set(findRealNames(parts.join(' \n ')))];
}

// ───────── 프롬프트 조립 ─────────
const clean = (s: string) => s.trim().replace(/[.\s]+$/, '');
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const isClose = (s: ShotSize) => s === 'CU' || s === 'INSERT';
export const aspectOf = (f: FormatKey) => (f === 'shorts' ? 'vertical 9:16' : 'widescreen 16:9');

export function cameraClause(s: Shot): string {
  const move = MOVE_EN[s.move];
  const speed = s.move && s.move !== '고정' ? SPEED_EN[s.speed] : '';
  const head = [speed, move].filter(Boolean).join(' ');
  const parts = [head, SIZE_EN[s.size], ANGLE_EN[s.angle]].filter(Boolean);
  let out = cap(parts.join(', '));
  if (s.endState.trim()) out += `, ending ${clean(s.endState)}`;
  return out + '.';
}

export function techniqueLine(s: Shot): string {
  const en = (s.techniques ?? []).map((id) => techById(id)?.en).filter(Boolean);
  return en.length ? `Cinematography: ${en.join('; ')}.` : '';
}

export function characterLine(s: Shot, chars: Character[] = []): string {
  const c = chars.find((x) => x.id === s.characterId);
  if (!c) return '';
  const bits = [clean(c.look), c.wardrobe.trim() && `wearing ${clean(c.wardrobe)}`, clean(c.signature)].filter(Boolean);
  return `Character lock: ${bits.join(', ')}; keep the exact same design in every shot.`;
}

export function locationLine(s: Shot, locs: Location[] = []): string {
  const l = locs.find((x) => x.id === s.locationId);
  if (!l) return '';
  return `Location lock: ${[clean(l.place), clean(l.details)].filter(Boolean).join(', ')}; keep the same layout, materials and landmarks in every shot.`;
}

const DIR_EN: Record<ScreenDir, string> = {
  '': '',
  '좌→우': 'moving left to right across the frame',
  '우→좌': 'moving right to left across the frame',
  카메라로: 'moving toward the camera',
  멀어짐: 'moving away from the camera',
};
export const dirClause = (s: Shot) => (s.screenDir ? DIR_EN[s.screenDir] : '');

export function buildVideoPrompt(s: Shot, bible: Bible, format: FormatKey, chars: Character[] = [], locs: Location[] = []): string {
  const lens = isClose(s.size) ? bible.lensClose : bible.lensWide;
  const dir = dirClause(s);
  const lines = [
    cameraClause(s),
    `${cap(clean(s.subject) || 'The subject')} ${clean(s.action) || 'holds still'}${dir ? ', ' + dir : ''}.`,
    characterLine(s, chars),
    locationLine(s, locs),
    `Setting: ${clean(s.setting) || 'as established'}; lighting and time: ${clean(s.lighting) || 'natural light'}.`,
    `Lens and render: ${[clean(lens), clean(bible.render), aspectOf(format)].filter(Boolean).join(', ')}.`,
    techniqueLine(s),
    `STYLE BIBLE: ${clean(bible.block)}.`,
    `${cap(NEGATIVE)}.`,
  ];
  return lines.filter(Boolean).join('\n');
}

export function buildImagePrompt(s: Shot, bible: Bible, format: FormatKey, chars: Character[] = [], locs: Location[] = []): string {
  const lens = isClose(s.size) ? bible.lensClose : bible.lensWide;
  const still = (s.techniques ?? []).map((id) => techById(id)).filter((t) => t && t.cat !== '카메라' && t.cat !== '속도·질감');
  const lines = [
    `Cinematic still keyframe (first frame), ${SIZE_EN[s.size]}, ${ANGLE_EN[s.angle]}.`,
    `${cap(clean(s.subject) || 'The subject')}, at the moment just before it ${clean(s.action) || 'moves'}.`,
    characterLine(s, chars),
    locationLine(s, locs),
    still.length ? `Cinematography: ${still.map((t) => t!.en).join('; ')}.` : '',
    `Setting: ${clean(s.setting) || 'as established'}; lighting and time: ${clean(s.lighting) || 'natural light'}.`,
    `${[clean(lens), clean(bible.render)].filter(Boolean).join(', ')}, aspect ratio ${format === 'shorts' ? '9:16' : '16:9'}.`,
    `STYLE BIBLE: ${clean(bible.block)}.`,
    `${cap(NEGATIVE)}.`,
  ];
  return lines.filter(Boolean).join('\n');
}

// ───────── 멀티앵글 커버리지 (같은 순간을 여러 앵글로) ─────────
export interface Variant {
  label: string;
  prompt: string;
}

const COVERAGE: { label: string; patch: Partial<Shot>; tech?: string; note?: string }[] = [
  { label: '마스터 와이드', patch: { size: 'WS', angle: '아이', move: '고정', speed: '', endState: 'holding the full geography of the scene' }, tech: 'deep' },
  { label: '리버스 앵글', patch: { angle: '아이' }, note: 'Reverse angle: camera placed 180 degrees opposite the main shot, same moment.' },
  { label: '어깨 너머 OTS', patch: { size: 'MS', angle: '아이' }, tech: 'ots' },
  { label: '클로즈업 CU', patch: { size: 'CU', move: '돌리인', speed: '느리게', endState: 'tight on the key emotion' }, tech: 'shallow' },
  { label: '인서트 디테일', patch: { size: 'INSERT', angle: '탑', move: '고정', speed: '', endState: 'holding on the key detail' }, tech: 'rack' },
  { label: '로우 히어로', patch: { size: 'MS', angle: '로우', move: '돌리인', speed: '느리게' }, tech: 'rim' },
];

export function buildCoverage(s: Shot, bible: Bible, format: FormatKey, chars: Character[] = [], locs: Location[] = []): Variant[] {
  return COVERAGE.map((c, i) => {
    const flip = c.label === '리버스 앵글' && (s.screenDir === '좌→우' || s.screenDir === '우→좌');
    const v: Shot = { ...s, ...c.patch, ...(flip ? { screenDir: s.screenDir === '좌→우' ? '우→좌' : '좌→우' } : {}), techniques: c.tech ? [c.tech] : (s.techniques ?? []).filter((id) => !techById(id)?.moves) };
    const head = `Coverage ${i + 1}/${COVERAGE.length} of the same moment — keep subject, wardrobe, setting and lighting identical.${c.note ? ' ' + c.note : ''}`;
    return { label: c.label, prompt: `${head}\n${buildVideoPrompt(v, bible, format, chars, locs)}` };
  });
}

// ───────── 전환 브리지 (시작·끝 프레임 사이 연결 샷) ─────────
const TRANS_EN: Record<Transition, string> = {
  하드컷: '',
  매치컷: 'match cut: the dominant shape and motion of the first frame morph seamlessly into the matching shape of the last frame',
  빛변화: 'light transition: light floods and shifts across the frame until it becomes the next scene',
  암전: 'fade through black: darkness swallows the frame, then the next scene emerges slowly from black',
};

export function buildBridge(a: Shot, b: Shot, bible: Bible, format: FormatKey): string | null {
  const how = TRANS_EN[a.transition];
  if (!how) return null;
  return [
    `Transition shot, 2 seconds, first frame to last frame, ${aspectOf(format)}.`,
    `First frame: ${clean(a.subject) || 'previous subject'}, ${clean(a.setting) || 'previous setting'}, ${clean(a.lighting) || 'same light'}.`,
    `Last frame: ${clean(b.subject) || 'next subject'}, ${clean(b.setting) || 'next setting'}, ${clean(b.lighting) || 'same light'}.`,
    `Technique: ${how}.`,
    `STYLE BIBLE: ${clean(bible.block)}.`,
    `${cap(NEGATIVE)}.`,
  ].join('\n');
}

// ───────── 캐릭터 디자인 시트 (Nano Banana 등 이미지 모델용) ─────────
export function buildCharacterSheet(c: Character, bible: Bible): string {
  return [
    `Character design sheet of an original fictional character: ${clean(c.look) || 'character'}.`,
    `Wardrobe: ${clean(c.wardrobe) || 'simple outfit'}. Signature detail: ${clean(c.signature) || 'none'}.`,
    'Layout: full-body turnaround (front, three-quarter, side, back) in one row, plus a row of four close-up expressions or poses; consistent proportions and colors in every view.',
    'Neutral light grey background, even soft studio lighting.',
    `STYLE BIBLE: ${clean(bible.block)}.`,
    `${cap(NEGATIVE)}.`,
  ].join('\n');
}

// ───────── QC·크레딧 ─────────
export function qcAverage(qc: number[]): number | null {
  const scored = qc.filter((n) => n > 0);
  if (scored.length === 0) return null;
  return scored.reduce((a, b) => a + b, 0) / scored.length;
}

export const needsRegen = (qc: number[]) => {
  const avg = qcAverage(qc);
  return avg !== null && avg < 3.5;
};

export interface CreditSummary {
  currentUsed: number;
  totalUsed: number;
  remaining: number;
  episodes: number;
  avgPerEpisode: number;
  possibleEpisodes: number | null;
}

export function creditSummary(credit: CreditState, shots: Shot[]): CreditSummary {
  const currentUsed = shots.reduce((a, s) => a + (Number(s.credits) || 0), 0);
  const totalUsed = (Number(credit.pastUsed) || 0) + currentUsed;
  const remaining = (Number(credit.start) || 0) - totalUsed;
  const episodes = (Number(credit.pastEpisodes) || 0) + (currentUsed > 0 ? 1 : 0);
  const avgPerEpisode = episodes > 0 ? totalUsed / episodes : 0;
  const possibleEpisodes = avgPerEpisode > 0 ? Math.max(0, Math.floor(remaining / avgPerEpisode)) : null;
  return { currentUsed, totalUsed, remaining, episodes, avgPerEpisode, possibleEpisodes };
}

// ───────── 내보내기 ─────────
export function exportJson(p: Project) {
  return {
    app: 'flow-studio',
    version: 1,
    exportedAt: new Date().toISOString(),
    brief: p.brief,
    bible: p.bible,
    characters: p.characters.map((c) => ({ ...c, sheetPrompt: buildCharacterSheet(c, p.bible) })),
    locations: p.locations,
    credit: p.credit,
    shots: p.shots.map((s) => ({
      ...s,
      beatLabel: beatLabel(s.beat),
      prompt: buildVideoPrompt(s, p.bible, p.brief.format, p.characters, p.locations),
      imagePrompt: s.keyframe ? buildImagePrompt(s, p.bible, p.brief.format, p.characters, p.locations) : null,
    })),
  };
}

export function parseProject(text: string): Project {
  const d = JSON.parse(text);
  if (!d || typeof d !== 'object' || !d.brief || !Array.isArray(d.shots)) {
    throw new Error('형식이 맞지 않는 파일입니다 (brief/shots 없음)');
  }
  const base = defaultProject(d.brief.preset ?? 'A');
  return {
    brief: { ...base.brief, ...d.brief },
    bible: { ...base.bible, ...(d.bible ?? {}) },
    credit: { ...base.credit, ...(d.credit ?? {}) },
    characters: Array.isArray(d.characters)
      ? d.characters.map(({ sheetPrompt: _s, ...c }: Character & { sheetPrompt?: string }) => c)
      : base.characters,
    locations: Array.isArray(d.locations) ? d.locations : base.locations,
    shots: d.shots.map((s: Partial<Shot>, i: number) => {
      const { prompt: _p, imagePrompt: _i, beatLabel: _b, ...rest } = s as Record<string, unknown>;
      return { ...blankShot(i), ...rest } as Shot;
    }),
  };
}

const md = (s: string | number) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function exportMarkdown(p: Project): string {
  const b = p.brief;
  const head = [
    `# ${b.series || '제목 없음'} — 콘티`,
    '',
    `- 채널: ${b.channel || '-'} / 프리셋: ${p.bible.name} / 포맷: ${b.format === 'shorts' ? '쇼츠 60초 9:16' : '롱폼 16:9'}`,
    `- 주제: ${b.topic || '-'}`,
    ...b.facts.filter(Boolean).map((f, i) => `- 핵심 사실 ${i + 1}: ${f}`),
    '',
    '| 샷ID | 비트 | 목적 | 샷크기 | 앵글 | 카메라무브 | 피사체·동작 | 조명·시간 | 연출 기법 | 전환 | 초 | 모델 | 키프레임 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  const rows = p.shots.map((s) =>
    `| ${[
      s.id,
      beatLabel(s.beat),
      `${s.purposeType}: ${s.purpose}`,
      s.size,
      s.angle,
      [s.move || '미지정', s.speed, s.endState].filter(Boolean).join(' / '),
      `${s.subject} — ${s.action}`,
      `${s.setting}; ${s.lighting}`,
      (s.techniques ?? []).map((id) => techById(id)?.ko).filter(Boolean).join(', ') || '-',
      s.transition,
      s.seconds,
      s.model,
      s.keyframe ? 'Y' : 'N',
    ]
      .map(md)
      .join(' | ')} |`,
  );
  const prompts = p.shots.flatMap((s) => [
    '',
    `### ${s.id} 영상 프롬프트`,
    '```',
    buildVideoPrompt(s, p.bible, b.format, p.characters, p.locations),
    '```',
    ...(s.keyframe ? ['', `### ${s.id} 키프레임 이미지 프롬프트`, '```', buildImagePrompt(s, p.bible, b.format, p.characters, p.locations), '```'] : []),
  ]);
  return [...head, ...rows, '', '## 프롬프트', ...prompts, ''].join('\n');
}
