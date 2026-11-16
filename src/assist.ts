// 제작 보조: 보관함(여러 편)·크레딧 지갑·경고 자동 수정·다음 할 일·번역 도우미·대본/자막
import {
  MODELS,
  SIZES,
  checkRules,
  defaultProject,
  narrationSeconds,
  newId,
  sanitizeProject,
  type FormatKey,
  type Model,
  type PresetKey,
  type Project,
  type Shot,
  type ShotSize,
  type Warning,
} from './lib';
import { techById } from './techniques';
import { tc } from './director';

// ───────── 보관함 + 지갑 ─────────
export interface Wallet {
  start: number; // 이번 달 시작 크레딧
  otherUsed: number; // 앱 밖에서 쓴 크레딧 (이미지 생성·테스트 등)
  costs: Record<Model, number>; // 모델별 1회 생성 비용
}
export interface Store {
  version: 2;
  activeId: string;
  projects: Project[];
  wallet: Wallet;
}

/** 모델별 1회 비용 기본값 — 추정치. Flow 화면의 실제 차감값으로 고쳐 써야 함 */
export const DEFAULT_COSTS: Record<Model, number> = { Lite: 10, Fast: 20, Quality: 100, Omni: 50 };
export const STORE_KEY = 'flow-studio-v2';
export const OLD_KEY = 'flow-studio-v1';

export function newStore(): Store {
  const p = defaultProject('A');
  return { version: 2, activeId: p.id, projects: [p], wallet: { start: 1050, otherUsed: 0, costs: { ...DEFAULT_COSTS } } };
}

const n0 = (v: unknown, fb: number) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.max(0, Number(v)) : fb);

/** v2 저장본 또는 v1(단일 프로젝트) 저장본을 Store로 변환. 둘 다 없으면 새 Store. 깨진 데이터면 throw */
export function loadStore(rawV2: string | null, rawV1: string | null): Store {
  if (rawV2) {
    const d = JSON.parse(rawV2) as Record<string, unknown>;
    const list = Array.isArray(d.projects) ? d.projects : [];
    const projects: Project[] = [];
    for (const x of list) {
      try {
        projects.push(sanitizeProject(x));
      } catch {
        /* 손상된 편은 건너뜀 */
      }
    }
    if (projects.length === 0) throw new Error('저장된 편이 없습니다');
    const w = (d.wallet && typeof d.wallet === 'object' ? d.wallet : {}) as Record<string, unknown>;
    const c = (w.costs && typeof w.costs === 'object' ? w.costs : {}) as Record<string, unknown>;
    const costs = { ...DEFAULT_COSTS };
    for (const m of MODELS) costs[m] = n0(c[m], DEFAULT_COSTS[m]);
    const activeId = projects.some((p) => p.id === d.activeId) ? (d.activeId as string) : projects[0].id;
    return { version: 2, activeId, projects, wallet: { start: n0(w.start, 1050), otherUsed: n0(w.otherUsed, 0), costs } };
  }
  if (rawV1) {
    const d = JSON.parse(rawV1) as Record<string, unknown>;
    const p = sanitizeProject(d);
    const cr = (d.credit && typeof d.credit === 'object' ? d.credit : {}) as Record<string, unknown>;
    return { version: 2, activeId: p.id, projects: [p], wallet: { start: n0(cr.start, 1050), otherUsed: n0(cr.pastUsed, 0), costs: { ...DEFAULT_COSTS } } };
  }
  return newStore();
}

export const projectTitle = (p: Project) => [p.brief.series, p.brief.episode].filter(Boolean).join(' · ') || '제목 없는 편';
export const projectUsed = (p: Project) => p.shots.reduce((a, s) => a + (Number(s.credits) || 0), 0);
export const isDone = (s: Shot) => s.status === '채택' || s.status === '폐기';

export interface Progress {
  total: number;
  adopted: number;
  dropped: number;
  done: number;
  pct: number;
}
export function progress(p: Project): Progress {
  const total = p.shots.length;
  const adopted = p.shots.filter((s) => s.status === '채택').length;
  const dropped = p.shots.filter((s) => s.status === '폐기').length;
  return { total, adopted, dropped, done: adopted + dropped, pct: total ? Math.round(((adopted + dropped) / total) * 100) : 0 };
}

export interface WalletSummary {
  used: number;
  remaining: number;
  episodesWithSpend: number;
  avgPerEpisode: number;
  possibleEpisodes: number | null;
  retryRate: number; // 채택 1컷당 평균 생성 횟수 (기록 없으면 1)
  hasRetryData: boolean;
  planMin: number; // 현재 편 남은 샷을 1번에 성공한다고 가정한 비용
  planLikely: number; // 내 평균 재생성률 반영
  afterPlan: number; // 예상 비용 지출 후 잔량
}

export function walletSummary(store: Store, active: Project): WalletSummary {
  const used = store.projects.reduce((a, p) => a + projectUsed(p), 0) + store.wallet.otherUsed;
  const remaining = store.wallet.start - used;
  const spent = store.projects.filter((p) => projectUsed(p) > 0);
  // 평균 단가는 "끝난 편"만으로 계산 (진행 중인 편이 평균을 낮추는 것 방지). 끝난 편이 없으면 쓴 편 전체.
  const finished = spent.filter((p) => p.shots.length > 0 && p.shots.every(isDone));
  const basis = finished.length ? finished : spent;
  const avgPerEpisode = basis.length ? basis.reduce((a, p) => a + projectUsed(p), 0) / basis.length : 0;
  let takes = 0;
  let adopted = 0;
  for (const p of store.projects) {
    for (const s of p.shots) {
      if (s.status === '채택' && s.takes > 0) {
        takes += s.takes;
        adopted += 1;
      }
    }
  }
  const hasRetryData = adopted >= 3;
  const retryRate = hasRetryData ? Math.max(1, takes / adopted) : 1;
  const planMin = active.shots.filter((s) => !isDone(s)).reduce((a, s) => a + (store.wallet.costs[s.model] ?? 0), 0);
  const planLikely = Math.round(planMin * retryRate);
  return {
    used,
    remaining,
    episodesWithSpend: spent.length,
    avgPerEpisode,
    possibleEpisodes: avgPerEpisode > 0 ? Math.max(0, Math.floor(remaining / avgPerEpisode)) : null,
    retryRate,
    hasRetryData,
    planMin,
    planLikely,
    afterPlan: remaining - planLikely,
  };
}

/** 다음 편 만들기: 스타일·캐릭터·장소는 그대로, 샷 내용과 기록은 초기화 */
export function nextEpisode(p: Project): Project {
  const base = defaultProject(p.brief.preset);
  return {
    ...base,
    brief: { ...p.brief, episode: '', topic: '', facts: ['', '', ''] },
    bible: { ...p.bible },
    characters: p.characters.map((c) => ({ ...c })),
    locations: p.locations.map((l) => ({ ...l })),
    shots: p.shots.map((s) => ({ ...s, narration: '', takes: 0, credits: 0, status: '대기' as const, defects: [], qc: [0, 0, 0, 0, 0] as Shot['qc'] })),
  };
}

export const duplicateProject = (p: Project): Project => ({ ...JSON.parse(JSON.stringify(p)), id: newId(), updatedAt: Date.now() });
export const blankProject = (preset: PresetKey): Project => defaultProject(preset);

// ───────── 모델 배분 (크레딧 계획) ─────────
export type ModelPlan = 'save' | 'balanced' | 'best';
export function applyModelPlan(shots: Shot[], plan: ModelPlan): Shot[] {
  return shots.map((s) => {
    if (isDone(s)) return s;
    const key = s.beat === 'hook' || s.beat === 'twist';
    const model: Model = plan === 'save' ? 'Fast' : plan === 'best' ? 'Quality' : key ? 'Quality' : 'Fast';
    return { ...s, model };
  });
}

// ───────── 경고 자동 수정 ─────────
const pad = (n: number) => `S${String(n).padStart(2, '0')}`;

export function autoFix(input: Shot[], format: FormatKey): { shots: Shot[]; fixed: string[]; remaining: Warning[] } {
  const shots = input.map((s) => ({ ...s, techniques: [...s.techniques] }));
  const fixed: string[] = [];
  const dropBadTech = (s: Shot) => {
    const keep = s.techniques.filter((id) => {
      const t = techById(id);
      return !t?.moves || t.moves.includes(s.move);
    });
    if (keep.length !== s.techniques.length) {
      fixed.push(`${s.id}: 무브와 안 맞는 기법 제거`);
      s.techniques = keep;
    }
  };
  // 1) ID 중복
  const seen = new Set<string>();
  for (const s of shots) {
    if (seen.has(s.id)) {
      let n = 1;
      while (seen.has(pad(n)) || shots.some((x) => x.id === pad(n))) n++;
      fixed.push(`${s.id} 중복 → ${pad(n)}`);
      s.id = pad(n);
    }
    seen.add(s.id);
  }
  // 2) 무브 미지정 → 고정
  for (const s of shots) {
    if (!s.move) {
      s.move = '고정';
      s.speed = '';
      fixed.push(`${s.id}: 카메라무브 → 고정`);
    }
  }
  // 3) 3샷 중 고정 0개 → 가운데 샷을 고정으로
  for (let i = 2; i < shots.length; i++) {
    const win = [shots[i - 2], shots[i - 1], shots[i]];
    if (!win.some((s) => s.move === '고정')) {
      const mid = win[1];
      mid.move = '고정';
      mid.speed = '';
      fixed.push(`${mid.id}: 고정샷으로 변경 (3샷 중 1개 규칙)`);
    }
  }
  // 4) 같은 샷크기 3연속 → 가운데 샷 크기 변경
  for (let i = 2; i < shots.length; i++) {
    const [a, b, c] = [shots[i - 2], shots[i - 1], shots[i]];
    if (a.size === b.size && b.size === c.size) {
      const order: ShotSize[] = ['WS', 'MS', 'MCU', 'CU', 'EWS'];
      const next = order.find((z) => z !== b.size) ?? SIZES[0];
      fixed.push(`${b.id}: 샷크기 ${b.size} → ${next}`);
      b.size = next;
    }
  }
  // 5) INSERT 0개 → CU가 있으면 그중 하나를 INSERT로
  if (shots.length > 0 && !shots.some((s) => s.size === 'INSERT')) {
    const cu = shots.find((s, i) => s.size === 'CU' && !(shots[i - 1]?.size === 'INSERT'));
    if (cu) {
      cu.size = 'INSERT';
      fixed.push(`${cu.id}: CU → INSERT`);
    }
  }
  // 6) 기법-무브 충돌 정리 (위 수정으로 생긴 충돌 포함)
  for (const s of shots) dropBadTech(s);
  return { shots, fixed, remaining: checkRules(shots, format) };
}

// ───────── 다음 할 일 ─────────
export type StepKey = 'plan' | 'board' | 'shoot' | 'wrap';
export interface NextAction {
  step: StepKey;
  text: string;
  shotIndex?: number;
}

export function nextAction(p: Project): NextAction {
  if (!p.brief.topic.trim()) return { step: 'plan', text: '주제 한 줄을 적고, AI로 콘티 초안을 받으세요' };
  if (p.shots.length === 0) return { step: 'board', text: '샷이 없습니다 — 콘티에서 샷을 추가하세요' };
  const warns = checkRules(p.shots, p.brief.format);
  const started = p.shots.some((s) => s.takes > 0 || s.status !== '대기');
  if (warns.length > 0 && !started) {
    if (autoFix(p.shots, p.brief.format).fixed.length > 0) return { step: 'board', text: `콘티 경고 ${warns.length}건 — [자동 수정]을 누르세요` };
    const idx = p.shots.findIndex((s) => warns[0].shotIds.includes(s.id));
    return { step: 'board', text: `직접 고칠 경고 ${warns.length}건 — ${warns[0].message}`, shotIndex: idx >= 0 ? idx : undefined };
  }
  const usedChars = new Set(p.shots.map((s) => s.characterId).filter(Boolean));
  const usedLocs = new Set(p.shots.map((s) => s.locationId).filter(Boolean));
  const asset = [...p.characters.filter((c) => usedChars.has(c.id)), ...p.locations.filter((l) => usedLocs.has(l.id))].find((x) => !x.ready);
  if (asset && !started) return { step: 'shoot', text: `참조 이미지 먼저: ${asset.id} ${asset.name} 시트를 이미지로 생성하세요` };
  const judge = p.shots.findIndex((s) => s.status === '생성');
  if (judge >= 0) return { step: 'shoot', text: `${p.shots[judge].id} 결과 판정: 채택 / 재생성 / 폐기`, shotIndex: judge };
  const todo = p.shots.findIndex((s) => s.status === '대기' || s.status === '재생성');
  if (todo >= 0) {
    const s = p.shots[todo];
    return { step: 'shoot', text: `${s.id} ${s.status === '재생성' ? '재생성' : '생성'}: 프롬프트 복사 → Flow에 붙여넣기`, shotIndex: todo };
  }
  return { step: 'wrap', text: '전 샷 완료 🎉 대본·자막·편집표를 내려받아 편집하세요' };
}

// ───────── 한글 → 영어 번역 도우미 ─────────
const HANGUL = /[가-힣]/;
export const hasHangul = (s: string | undefined) => HANGUL.test(s ?? '');
const SHOT_EN_FIELDS = ['subject', 'action', 'setting', 'lighting', 'endState', 'sfx'] as const;

/** 프롬프트에 그대로 들어가는 칸 중 한글이 남은 것 → { 키: 원문 } */
export function koreanFields(p: Project): Record<string, string> {
  const out: Record<string, string> = {};
  p.shots.forEach((s, i) => {
    for (const f of SHOT_EN_FIELDS) if (hasHangul(s[f])) out[`shot.${i}.${f}`] = s[f];
  });
  p.characters.forEach((c, i) => {
    for (const f of ['look', 'wardrobe', 'signature'] as const) if (hasHangul(c[f])) out[`char.${i}.${f}`] = c[f];
  });
  p.locations.forEach((l, i) => {
    for (const f of ['place', 'details'] as const) if (hasHangul(l[f])) out[`loc.${i}.${f}`] = l[f];
  });
  if (hasHangul(p.bible.block)) out['bible.block'] = p.bible.block;
  return out;
}

export function buildTranslateRequest(p: Project): string {
  return [
    'Translate each Korean value below into concise, vivid English suitable for an AI video generation prompt.',
    'Rules: keep the same JSON keys; values must be English only; for keys ending in ".action" write exactly ONE physical action (no "and"); no real people, brands or on-screen text.',
    'Return ONLY the JSON object, no prose.',
    '',
    JSON.stringify(koreanFields(p), null, 2),
  ].join('\n');
}

export function applyTranslation(p: Project, text: string): { project: Project; applied: number } {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence && fence[1].includes('{') ? fence[1] : text;
  const a = body.indexOf('{');
  const z = body.lastIndexOf('}');
  if (a < 0 || z <= a) throw new Error('답변에서 JSON { ... } 을 찾지 못했습니다');
  const map = JSON.parse(body.slice(a, z + 1)) as Record<string, unknown>;
  const q: Project = JSON.parse(JSON.stringify(p));
  let applied = 0;
  for (const [key, val] of Object.entries(map)) {
    if (typeof val !== 'string' || !val.trim()) continue;
    const [kind, idx, field] = key.split('.');
    const i = Number(idx);
    if (kind === 'bible' && idx === 'block') {
      q.bible.block = val;
      applied++;
    } else if (kind === 'shot' && q.shots[i] && (SHOT_EN_FIELDS as readonly string[]).includes(field)) {
      (q.shots[i] as unknown as Record<string, unknown>)[field] = val;
      applied++;
    } else if (kind === 'char' && q.characters[i] && ['look', 'wardrobe', 'signature'].includes(field)) {
      (q.characters[i] as unknown as Record<string, unknown>)[field] = val;
      applied++;
    } else if (kind === 'loc' && q.locations[i] && ['place', 'details'].includes(field)) {
      (q.locations[i] as unknown as Record<string, unknown>)[field] = val;
      applied++;
    }
  }
  return { project: q, applied };
}

// ───────── 대본 · 자막 ─────────
export function buildNarrationScript(p: Project): string {
  const lines = p.shots.filter((s) => s.narration.trim()).map((s) => s.narration.trim());
  return lines.join('\n');
}

export function narrationTotal(p: Project): number {
  return p.shots.reduce((a, s) => a + narrationSeconds(s.narration), 0);
}

const srtTime = (sec: number) => {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const p2 = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p2(h)}:${p2(m)}:${p2(s)},${p2(ms % 1000, 3)}`;
};

/** 샷 타임코드에 맞춘 자막 파일(SRT). 폐기 샷은 건너뛰고 시간도 당김 */
export function buildSrt(p: Project): string {
  let t = 0;
  let n = 0;
  const out: string[] = [];
  for (const s of p.shots) {
    if (s.status === '폐기') continue;
    const from = t;
    t += Number(s.seconds) || 0;
    if (!s.narration.trim() || t <= from) continue;
    n += 1;
    out.push(`${n}\n${srtTime(from)} --> ${srtTime(t)}\n${s.narration.trim()}\n`);
  }
  return out.join('\n');
}

export const timeline = (p: Project) => {
  let t = 0;
  return p.shots.map((s) => {
    const from = t;
    t += Number(s.seconds) || 0;
    return { id: s.id, from, to: t, label: `${tc(from)}–${tc(t)}` };
  });
};

/** 캐릭터·장소 삭제 시 샷의 연결도 함께 해제 */
export function removeAsset(p: Project, kind: 'char' | 'loc', id: string): Project {
  return kind === 'char'
    ? { ...p, characters: p.characters.filter((c) => c.id !== id), shots: p.shots.map((s) => (s.characterId === id ? { ...s, characterId: '' } : s)) }
    : { ...p, locations: p.locations.filter((l) => l.id !== id), shots: p.shots.map((s) => (s.locationId === id ? { ...s, locationId: '' } : s)) };
}

export const nextAssetId = (ids: string[], prefix: 'C' | 'L') => {
  let n = ids.length + 1;
  while (ids.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
};
