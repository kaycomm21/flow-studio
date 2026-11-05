// 디렉터 도구 모음 — 서버/API 없이 "프롬프트·데이터"로 구현 가능한 제작 보조 기능.
import {
  ANGLES,
  BEATS,
  MODELS,
  MOVES,
  NEGATIVE,
  SCREEN_DIRS,
  SIZES,
  SPEEDS,
  TRANSITIONS,
  aspectOf,
  beatLabel,
  blankShot,
  buildVideoPrompt,
  type Bible,
  type BeatKey,
  type FormatKey,
  type Location,
  type Project,
  type Shot,
} from './lib';
import { TECHNIQUES } from './techniques';

const clean = (s: string) => (s ?? '').trim().replace(/[.\s]+$/, '');

// ───────── 1) 월드 시트 + 월드 카메라 투어 ─────────
export function buildLocationSheet(l: Location, bible: Bible): string {
  return [
    `Environment reference sheet of an original fictional location: ${clean(l.place) || 'location'}.`,
    `Key details: ${clean(l.details) || 'distinctive architecture'}.`,
    'Layout: four panels in a grid — establishing wide view, reverse wide view, close texture/material detail, the same place at a different time of day; identical architecture, layout and landmarks in every panel; no people.',
    `STYLE BIBLE: ${clean(bible.block)}.`,
    `${NEGATIVE[0].toUpperCase()}${NEGATIVE.slice(1)}.`,
  ].join('\n');
}

const TOUR: { label: string; cam: string }[] = [
  { label: '항공 부감', cam: 'Slow aerial descent, extreme wide shot, high angle over the whole location' },
  { label: '지상 와이드', cam: 'Static locked-off camera, wide shot, eye-level angle from the main entrance' },
  { label: '프레임 속 프레임', cam: 'Slow dolly in, wide shot, eye-level angle, framed through a doorway or arch' },
  { label: '재질 매크로', cam: 'Static locked-off camera, insert detail shot, extreme macro of the signature material' },
  { label: '시간 변화', cam: 'Static locked-off camera, wide shot, the same view as light shifts from day to night (time-lapse)' },
];

export function buildLocationTour(l: Location, bible: Bible, format: FormatKey) {
  return TOUR.map((t, i) => ({
    label: t.label,
    prompt: [
      `World camera ${i + 1}/${TOUR.length} — same location, new viewpoint. ${t.cam}.`,
      `Location: ${clean(l.place)}; ${clean(l.details)}; no people.`,
      `Lens and render: ${clean(bible.lensWide)}, ${clean(bible.render)}, ${aspectOf(format)}.`,
      `STYLE BIBLE: ${clean(bible.block)}.`,
      `${NEGATIVE[0].toUpperCase()}${NEGATIVE.slice(1)}.`,
    ].join('\n'),
  }));
}

// ───────── 2) 결함 태그 → 재생성 보정 프롬프트 ─────────
export const DEFECTS: { id: string; ko: string; fix: (s: Shot) => string }[] = [
  { id: 'hands', ko: '손·손가락 뭉개짐', fix: () => 'anatomically correct hands with five fingers; keep hands simple or partly out of frame' },
  { id: 'face', ko: '얼굴 변형·모핑', fix: () => 'stable, consistent face and head shape with no morphing' },
  { id: 'flicker', ko: '깜빡임·조명 튐', fix: () => 'temporally stable lighting and exposure, no flicker' },
  { id: 'physics', ko: '물리 어색함', fix: () => 'physically plausible motion with natural weight and gravity' },
  { id: 'text', ko: '글자·로고 생김', fix: () => 'absolutely no letters, signs, captions or logos anywhere in frame' },
  { id: 'extra', ko: '엉뚱한 인물·사물', fix: () => 'only the described subject; no extra people, animals or objects' },
  { id: 'camera', ko: '카메라무브 무시', fix: (s) => `the camera movement is mandatory and clearly visible from the first frame: ${s.move || 'as described'}` },
  { id: 'speed', ko: '동작 속도 이상', fix: () => 'the action happens at a natural, unhurried real-time speed' },
  { id: 'warp', ko: '배경 일그러짐', fix: () => 'rigid, stable background architecture with no warping or melting' },
  { id: 'style', ko: '스타일 이탈', fix: () => 'strictly match the style bible color grade, lens and mood' },
];

export function buildRegenPrompt(base: string, s: Shot): string {
  const fixes = (s.defects ?? []).map((id) => DEFECTS.find((d) => d.id === id)?.fix(s)).filter(Boolean);
  if (!fixes.length) return base;
  return `${base}\nFix from previous take: ${fixes.join('; ')}.`;
}

// ───────── 3) AI 시나리오 연결 (내 Claude/Gemini에 붙여넣기 → JSON 받아오기) ─────────
export function buildScenarioRequest(p: Project): string {
  const b = p.brief;
  const tech = TECHNIQUES.map((t) => `${t.id}${t.moves ? `(move:${t.moves.join('/')})` : ''}`).join(', ');
  return [
    'You are a film director and storyboard artist for AI video generation.',
    `Create a ${b.format === 'shorts' ? '60-second vertical 9:16 YouTube Short' : '16:9 long-form video scene'} storyboard of exactly 8 shots.`,
    '',
    '## Brief',
    `- Series: ${b.series || '-'} / Channel: ${b.channel || '-'}`,
    `- Topic: ${b.topic || '-'}`,
    ...b.facts.filter(Boolean).map((f, i) => `- Key fact ${i + 1}: ${f}`),
    `- STYLE BIBLE: ${p.bible.block}`,
    ...p.characters.map((c) => `- Character ${c.id}: ${c.look}; ${c.wardrobe}; ${c.signature}`),
    ...p.locations.map((l) => `- Location ${l.id}: ${l.place}; ${l.details}`),
    '',
    '## Beat sheet (seconds)',
    ...BEATS.map((x) => `- ${x.key}: ${x.from}-${x.to}s (${x.label})`),
    '',
    '## Hard rules',
    '- Never the same shot size 3 times in a row. At least 1 static shot ("고정") in every 3 consecutive shots. At least 1 INSERT shot.',
    '- action = exactly ONE physical action in English. Never use "and" or commas joining two actions.',
    '- No real people, real politicians, parties, brands, logos or on-screen text.',
    '- Keep screen direction consistent (180-degree rule) unless separated by a fade to black.',
    '- seconds per shot: 3 to 8.',
    '',
    '## Output',
    'Return ONLY a JSON array (no prose) of 8 objects with these keys:',
    `id ("S01"...), beat (${BEATS.map((x) => x.key).join('|')}), purposeType ("질문"|"답"), purpose (Korean, short),`,
    `size (${SIZES.join('|')}), angle (${ANGLES.join('|')}), move (${MOVES.filter(Boolean).join('|')}), speed (${SPEEDS.filter(Boolean).join('|')} or ""),`,
    'endState (English camera end frame), subject (English), action (English, ONE action), setting (English), lighting (English, include time of day),',
    `screenDir (${SCREEN_DIRS.filter(Boolean).join('|')} or ""), transition (${TRANSITIONS.join('|')}), seconds (number), model (${MODELS.join('|')}), keyframe (true|false),`,
    `characterId (${p.characters.map((c) => c.id).join('|') || '""'} or ""), locationId (${p.locations.map((l) => l.id).join('|') || '""'} or ""),`,
    `techniques (array of 0-2 ids; a technique with move:... must match the shot's move): ${tech}`,
  ].join('\n');
}

const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): [T, boolean] =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? [v as T, true] : [fallback, v === undefined || v === ''];

/** LLM 답변(텍스트)에서 JSON 배열을 찾아 샷으로 변환. 잘못된 값은 기본값으로 교정하고 issues에 기록 */
export function parseScenarioResponse(text: string, p: Project): { shots: Shot[]; issues: string[] } {
  const issues: string[] = [];
  let body = text.replace(/```(?:json)?/gi, '');
  const a = body.indexOf('[');
  const z = body.lastIndexOf(']');
  if (a < 0 || z <= a) throw new Error('답변에서 JSON 배열 [ ... ] 을 찾지 못했습니다');
  body = body.slice(a, z + 1);
  let arr: unknown;
  try {
    arr = JSON.parse(body);
  } catch (e) {
    throw new Error('JSON 형식 오류: ' + (e as Error).message);
  }
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('샷 배열이 비어 있습니다');
  const techIds = new Set(TECHNIQUES.map((t) => t.id));
  const charIds = new Set(p.characters.map((c) => c.id));
  const locIds = new Set(p.locations.map((l) => l.id));
  const beatKeys = BEATS.map((x) => x.key) as BeatKey[];
  const shots = arr.slice(0, 20).map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const base = blankShot(i);
    const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : base.id;
    const fix = <T extends string>(key: string, list: readonly T[], fb: T): T => {
      const [v, ok] = pick(r[key], list, fb);
      if (!ok) issues.push(`${id}.${key}: "${String(r[key])}" → ${v || '(빈값)'}`);
      return v;
    };
    const str = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '');
    const techniques = Array.isArray(r.techniques) ? (r.techniques as unknown[]).filter((t): t is string => typeof t === 'string' && techIds.has(t)).slice(0, 2) : [];
    const characterId = charIds.has(str('characterId')) ? str('characterId') : '';
    const locationId = locIds.has(str('locationId')) ? str('locationId') : '';
    const sec = Number(r.seconds);
    const shot: Shot = {
      ...base,
      id,
      beat: fix('beat', beatKeys, base.beat),
      purposeType: fix('purposeType', ['질문', '답'] as const, '질문'),
      purpose: str('purpose'),
      size: fix('size', SIZES, base.size),
      angle: fix('angle', ANGLES, base.angle),
      move: fix('move', MOVES, ''),
      speed: fix('speed', SPEEDS, ''),
      endState: str('endState'),
      subject: str('subject'),
      action: str('action'),
      setting: str('setting'),
      lighting: str('lighting'),
      screenDir: fix('screenDir', SCREEN_DIRS, ''),
      transition: fix('transition', TRANSITIONS, '하드컷'),
      seconds: Number.isFinite(sec) && sec > 0 ? Math.min(sec, 20) : base.seconds,
      model: fix('model', MODELS, 'Fast'),
      keyframe: r.keyframe === true || r.keyframe === 'Y' || r.keyframe === 'true',
      techniques,
      characterId,
      locationId,
    };
    return shot;
  });
  return { shots, issues };
}

// ───────── 4) 오디오 큐시트 (Lyria/Suno 음악 + 샷별 효과음) ─────────
const MOOD: Record<string, string> = {
  A: 'mysterious ambient cinematic score, low drones, distant wordless choir, slow build',
  B: 'deadpan documentary score, light pizzicato strings and soft marimba, quietly satirical',
  C: 'clean uplifting cinematic lo-fi, soft piano and warm pads',
};
const BEAT_MUSIC: Record<BeatKey, string> = {
  hook: 'sudden attention-grabbing sting in the first second',
  context: 'sparse and curious, leaving room for narration',
  develop: 'steady building pulse, rising tension',
  twist: 'drop to near-silence, then one heavy hit',
  resolve: 'warm emotional swell, release of tension',
  cta: 'soft resolving outro that loops cleanly',
};

export function buildAudioCue(p: Project): string {
  const mood = MOOD[p.brief.preset] ?? MOOD.C;
  let t = 0;
  const rows = p.shots.map((s) => {
    const from = t;
    t += Number(s.seconds) || 0;
    const sfx = s.sfx.trim() || `ambience of ${clean(s.setting) || 'the scene'}; foley for: ${clean(s.action) || 'subtle movement'}`;
    return `${s.id} [${tc(from)}-${tc(t)}] ${beatLabel(s.beat)} — SFX: ${sfx}`;
  });
  const music = BEATS.map((b) => `- ${b.label} ${b.from}-${b.to}s: ${BEAT_MUSIC[b.key]}`);
  return [
    `## Music prompt (instrumental, ${Math.round(t)}s)`,
    `${mood}, ${Math.round(t)} seconds, no vocals, no lyrics.`,
    'Structure:',
    ...music,
    '',
    '## SFX cue sheet',
    ...rows,
  ].join('\n');
}

// ───────── 5) 편집 큐시트 CSV (캡컷·프리미어 배치용) ─────────
export const tc = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

export function buildEditCsv(p: Project): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const series = (p.brief.series || 'series').replace(/[\\/:*?"<>|\s]+/g, '_');
  let t = 0;
  const head = ['순서', '샷ID', '시작', '끝', '길이(초)', '비트', '전환', '상태', '모델', '파일명'];
  const rows = p.shots.map((s, i) => {
    const from = t;
    t += Number(s.seconds) || 0;
    return [i + 1, s.id, tc(from), tc(t), s.seconds, beatLabel(s.beat), s.transition, s.status, s.model, `${series}_${s.id}_v1.mp4`];
  });
  return '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

export const promptFor = (s: Shot, p: Project) => buildVideoPrompt(s, p.bible, p.brief.format, p.characters, p.locations);

/** 다운로드 파일명: 브라우저가 한글·기호(ⓒ) 파일명을 'download'로 바꾸는 경우가 있어 영문·숫자만 사용.
 *  형식: flow_<시리즈 영문부분>_C_<YYYYMMDD-HHMM>.<ext>  (C = Claude 생성 식별자) */
export function safeFileName(series: string, ext: string, d: Date): string {
  const slug = (series || '').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  const p2 = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
  return `flow_${slug || 'series'}_C_${stamp}.${ext}`;
}
