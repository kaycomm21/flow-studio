import { describe, it, expect } from 'vitest';
import {
  BIBLES,
  buildImagePrompt,
  buildVideoPrompt,
  checkRules,
  defaultProject,
  defaultShots,
  exportJson,
  exportMarkdown,
  findRealNames,
  needsRegen,
  parseProject,
  qcAverage,
} from './lib';

describe('프롬프트 조립', () => {
  const shots = defaultShots('A');

  it('프리셋 A는 8샷이고 모든 샷 프롬프트가 생성된다', () => {
    expect(shots).toHaveLength(8);
    for (const s of shots) {
      const p = buildVideoPrompt(s, BIBLES.A, 'shorts');
      expect(p).toContain('STYLE BIBLE: desaturated teal grade');
      expect(p).toContain('No text, no logos, no real people, no watermark.');
      expect(p).toContain('vertical 9:16');
    }
  });

  it('카메라무브+샷크기+앵글이 첫 줄에 오고 끝상태가 붙는다', () => {
    const p = buildVideoPrompt(shots[0], BIBLES.A, 'shorts');
    expect(p.split('\n')[0]).toBe('Slow crane up, extreme wide shot, low angle, ending revealing the full hall.');
  });

  it('INSERT/CU는 클로즈 렌즈(100mm macro)를 쓴다', () => {
    const insert = shots.find((s) => s.size === 'INSERT')!;
    expect(buildVideoPrompt(insert, BIBLES.A, 'shorts')).toContain('100mm macro');
    expect(buildVideoPrompt(shots[0], BIBLES.A, 'long')).toContain('35mm lens');
    expect(buildVideoPrompt(shots[0], BIBLES.A, 'long')).toContain('widescreen 16:9');
  });

  it('고정샷에는 속도가 붙지 않는다', () => {
    const fixed = { ...shots[1], speed: '빠르게' as const };
    expect(buildVideoPrompt(fixed, BIBLES.A, 'shorts').split('\n')[0]).toMatch(/^Static locked-off camera/);
  });

  it('키프레임 이미지 프롬프트는 비율과 금지 문구를 포함한다', () => {
    const p = buildImagePrompt(shots[0], BIBLES.A, 'shorts');
    expect(p).toContain('aspect ratio 9:16');
    expect(p).toContain('frozen at the very first moment');
    expect(p).toContain('No text, no logos');
  });
});

describe('규칙 경고', () => {
  it('기본 프리셋 A·B·C는 경고가 없다', () => {
    for (const k of ['A', 'B', 'C'] as const) expect(checkRules(defaultShots(k))).toEqual([]);
  });

  it('같은 샷크기 3연속을 잡는다', () => {
    const s = defaultShots('A');
    s[0].size = 'WS';
    s[1].size = 'WS';
    s[2].size = 'WS';
    expect(checkRules(s).some((w) => w.rule === 'sameSize')).toBe(true);
  });

  it('카메라무브 미지정을 잡는다', () => {
    const s = defaultShots('A');
    s[3].move = '';
    expect(checkRules(s).find((w) => w.rule === 'noMove')?.shotIds).toEqual(['S04']);
  });

  it('3샷 연속 고정샷 없음을 잡는다', () => {
    const s = defaultShots('A');
    s[1].move = '패닝'; // S01 크레인, S02 패닝, S03 돌리인
    expect(checkRules(s).some((w) => w.rule === 'fewFixed')).toBe(true);
  });

  it('동작 2개("그리고"/"and")를 잡는다', () => {
    const s = defaultShots('A');
    s[0].action = 'turns and runs';
    s[1].action = '돌아서고 그리고 달린다';
    const ids = checkRules(s).filter((w) => w.rule === 'multiAction').map((w) => w.shotIds[0]);
    expect(ids).toEqual(['S01', 'S02']);
    s[0].action = 'stands in the sand'; // 'sand' 안의 and 는 무시
    expect(checkRules(s).filter((w) => w.rule === 'multiAction')).toHaveLength(1);
  });

  it('INSERT 0개를 잡는다', () => {
    const s = defaultShots('A').map((x) => (x.size === 'INSERT' ? { ...x, size: 'CU' as const } : x));
    expect(checkRules(s).some((w) => w.rule === 'noInsert')).toBe(true);
  });
});

describe('크레딧·QC', () => {
  it('QC 평균 3.5 미만이면 재생성', () => {
    expect(qcAverage([0, 0, 0, 0, 0])).toBeNull();
    expect(needsRegen([3, 3, 4, 3, 4])).toBe(true); // 3.4
    expect(needsRegen([4, 4, 3, 3, 4])).toBe(false); // 3.6
  });
});

describe('실존 인물·내보내기', () => {
  it('실존 인물 이름을 찾는다', () => {
    expect(findRealNames('트럼프가 나오는 장면')).toEqual(['트럼프']);
    expect(findRealNames('raccoon civil servant')).toEqual([]);
  });

  it('JSON 내보내기 → 불러오기 왕복', () => {
    const p = defaultProject('B');
    p.brief.series = '구름왕국 예산전쟁';
    const json = JSON.stringify(exportJson(p));
    const back = parseProject(json);
    expect(back.brief.series).toBe('구름왕국 예산전쟁');
    expect(back.shots).toHaveLength(8);
    expect((back.shots[0] as unknown as Record<string, unknown>).prompt).toBeUndefined();
  });

  it('Markdown 표에 8행이 들어간다', () => {
    const mdText = exportMarkdown(defaultProject('A'));
    expect(mdText.split('\n').filter((l) => l.startsWith('| S0')).length).toBe(8);
  });
});

import { buildBridge, buildCharacterSheet, buildCoverage, CHARACTERS } from './lib';
import { recommend, TECHNIQUES } from './techniques';

describe('연출 기법·캐릭터·커버리지·전환', () => {
  const p = defaultProject('A');

  it('기법 id는 중복이 없다', () => {
    expect(new Set(TECHNIQUES.map((t) => t.id)).size).toBe(TECHNIQUES.length);
  });

  it('추천은 카메라무브와 호환되는 기법만 고른다', () => {
    expect(recommend('twist', '고정')).not.toContain('dollyzoom');
    expect(recommend('twist', '돌리인')).toContain('dollyzoom');
    expect(recommend('hook', '크레인').length).toBeLessThanOrEqual(2);
  });

  it('기본 샷 프롬프트에 Cinematography 줄과 캐릭터 고정 줄이 들어간다', () => {
    const v = buildVideoPrompt(p.shots[0], p.bible, 'shorts', p.characters);
    expect(v).toMatch(/Cinematography: .+/);
    expect(v).toContain('Character lock: lone explorer silhouette');
    expect(v).toContain('wearing long weathered canvas coat');
  });

  it('무브와 맞지 않는 기법은 techConflict 경고', () => {
    const s = defaultShots('A');
    s[1].techniques = ['dollyzoom']; // S02는 고정샷
    expect(checkRules(s).find((w) => w.rule === 'techConflict')?.shotIds).toEqual(['S02']);
  });

  it('멀티앵글 커버리지 6종, 모두 금지 문구 포함', () => {
    const vs = buildCoverage(p.shots[0], p.bible, 'shorts', p.characters);
    expect(vs).toHaveLength(6);
    for (const v of vs) expect(v.prompt).toContain('No text, no logos');
    expect(vs[2].prompt).toContain('over-the-shoulder');
  });

  it('전환 브리지: 하드컷은 null, 매치컷은 프롬프트 생성', () => {
    const s = defaultShots('A');
    expect(buildBridge(s[0], s[1], p.bible, 'shorts')).toBeNull(); // S01 하드컷
    expect(buildBridge(s[1], s[2], p.bible, 'shorts')).toContain('match cut'); // S02 매치컷
  });

  it('캐릭터 시트 프롬프트', () => {
    const t = buildCharacterSheet(CHARACTERS.B[0], BIBLES.B);
    expect(t).toContain('turnaround');
    expect(t).toContain('raccoon');
  });
});

import {
  buildAudioCue,
  buildEditCsv,
  buildLocationSheet,
  buildLocationTour,
  buildRegenPrompt,
  buildScenarioRequest,
  parseScenarioResponse,
} from './director';

describe('디렉터 도구 (월드·결함·시나리오·오디오·편집)', () => {
  const p = defaultProject('A');

  it('로케이션 고정 줄과 화면 방향이 프롬프트에 들어간다', () => {
    const s = { ...p.shots[0], screenDir: '좌→우' as const };
    const v = buildVideoPrompt(s, p.bible, 'shorts', p.characters, p.locations);
    expect(v).toContain('Location lock: colossal ancient temple');
    expect(v).toContain('moving left to right across the frame.');
  });

  it('180도 규칙: 연속 샷 화면 방향 반전 경고, 암전 뒤는 허용', () => {
    const s = defaultShots('A');
    s[2].screenDir = '좌→우';
    s[3].screenDir = '우→좌';
    expect(checkRules(s).find((w) => w.rule === 'axisFlip')?.shotIds).toEqual(['S03', 'S04']);
    s[2].transition = '암전';
    expect(checkRules(s).some((w) => w.rule === 'axisFlip')).toBe(false);
  });

  it('월드 시트·카메라 투어 5종', () => {
    expect(buildLocationSheet(p.locations[0], p.bible)).toContain('no people');
    expect(buildLocationTour(p.locations[0], p.bible, 'shorts')).toHaveLength(5);
  });

  it('결함 태그 → 보정 줄 추가, 태그 없으면 원본 유지', () => {
    const s = { ...p.shots[0], defects: ['hands', 'camera'] };
    const r = buildRegenPrompt('BASE', s);
    expect(r).toContain('Fix from previous take: anatomically correct hands');
    expect(r).toContain('크레인');
    expect(buildRegenPrompt('BASE', p.shots[0])).toBe('BASE');
  });

  it('시나리오 요청문에 규칙·스키마·캐릭터가 들어간다', () => {
    const t = buildScenarioRequest(p);
    expect(t).toContain('exactly 8 shots');
    expect(t).toContain('Character C1');
    expect(t).toContain('Location L1');
  });

  it('LLM 답변 파싱: 코드펜스·잡담 제거, 잘못된 값 교정', () => {
    const answer = `물론이죠! 아래가 콘티입니다.\n\`\`\`json\n[{"id":"S01","beat":"hook","size":"XL","angle":"로우","move":"크레인","speed":"느리게","subject":"A lantern","action":"flickers","seconds":4,"keyframe":true,"techniques":["silhouette","nope"],"characterId":"C1","locationId":"L9"}]\n\`\`\`\n도움이 되셨길!`;
    const { shots, issues } = parseScenarioResponse(answer, p);
    expect(shots).toHaveLength(1);
    expect(shots[0].size).toBe('MS'); // XL → 기본값
    expect(shots[0].techniques).toEqual(['silhouette']);
    expect(shots[0].characterId).toBe('C1');
    expect(shots[0].locationId).toBe('');
    expect(shots[0].keyframe).toBe(true);
    expect(issues.some((x) => x.startsWith('S01.size'))).toBe(true);
    expect(() => parseScenarioResponse('JSON 없음', p)).toThrow();
  });

  it('오디오 큐시트·편집 CSV', () => {
    const a = buildAudioCue(p);
    expect(a).toContain('no vocals');
    expect(a).toContain('S01 [00:00.0-00:03.0]');
    const csv = buildEditCsv(p);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(9);
  });

  it('JSON 왕복 시 로케이션 유지', () => {
    const back = parseProject(JSON.stringify(exportJson(p)));
    expect(back.locations[0].id).toBe('L1');
    expect(back.shots[0].locationId).toBe('L1');
  });
});

import { safeFileName } from './director';
describe('파일명', () => {
  it('영문·숫자만 남기고 C 식별자+타임스탬프', () => {
    const d = new Date(2026, 10, 5, 9, 7);
    expect(safeFileName('잊힌 신전 Ep.1', 'json', d)).toBe('flow_Ep-1_C_20261105-0907.json');
    expect(safeFileName('', 'csv', d)).toBe('flow_series_C_20261105-0907.csv');
  });
});

import { nextShotId } from './lib';
describe('검수 수정', () => {
  const p = defaultProject('A');
  it('샷 삭제 후 추가해도 ID 중복 없음 + 중복 경고', () => {
    const s = defaultShots('A').filter((x) => x.id !== 'S03'); // 7개, S08 존재
    expect(nextShotId(s)).toBe('S09');
    const dup = [...s, { ...s[0] }];
    expect(checkRules(dup).some((w) => w.rule === 'dupId')).toBe(true);
  });
  it('쇼츠 60초 초과 경고, 롱폼은 없음', () => {
    const s = defaultShots('A').map((x) => ({ ...x, seconds: 10 }));
    expect(checkRules(s, 'shorts').some((w) => w.rule === 'overLength')).toBe(true);
    expect(checkRules(s, 'long').some((w) => w.rule === 'overLength')).toBe(false);
  });
  it('리버스 앵글은 화면 방향을 뒤집는다', () => {
    const s = { ...p.shots[0], screenDir: '좌→우' as const };
    const rev = buildCoverage(s, p.bible, 'shorts', p.characters, p.locations)[1];
    expect(rev.prompt).toContain('right to left');
  });
  it('"조국"(일반명사) 오탐 없음', () => {
    expect(findRealNames('조국을 위한 노래')).toEqual([]);
  });
  it('AI 답변 앞 설명에 [대괄호]가 있어도 코드블록 우선 파싱', async () => {
    const { parseScenarioResponse } = await import('./director');
    const r = parseScenarioResponse('[참고] 아래 결과\n```json\n[{"id":"S01","size":"CU"}]\n```', p);
    expect(r.shots[0].size).toBe('CU');
  });
});

import { narrationSeconds, sanitizeProject, shotPrompt } from './lib';
import {
  applyModelPlan,
  applyTranslation,
  autoFix,
  buildSrt,
  buildTranslateRequest,
  koreanFields,
  loadStore,
  newStore,
  nextAction,
  nextEpisode,
  removeAsset,
  walletSummary,
} from './assist';
import { tc } from './director';

describe('v2: 데이터 보정', () => {
  it('손상된 샷 값(null·잘못된 타입)을 안전한 값으로 보정', () => {
    const p = sanitizeProject({ brief: { preset: 'Z', facts: null }, shots: [{ id: 'S01', qc: null, techniques: null, seconds: 'abc', size: 'XL', status: '??' }, null] });
    expect(p.brief.preset).toBe('A');
    expect(p.shots[0].qc).toEqual([0, 0, 0, 0, 0]);
    expect(p.shots[0].techniques).toEqual([]);
    expect(p.shots[0].size).toBe('MS');
    expect(p.shots[0].status).toBe('대기');
    expect(p.shots[1].id).toBe('S02');
    expect(() => sanitizeProject({ shots: [] })).toThrow();
  });
  it('v1 저장본 → v2 보관함으로 이전 (크레딧 설정 승계)', () => {
    const old = { ...JSON.parse(JSON.stringify(defaultProject('B'))), credit: { start: 900, pastUsed: 120, pastEpisodes: 1 } };
    const st = loadStore(null, JSON.stringify(old));
    expect(st.projects).toHaveLength(1);
    expect(st.wallet.start).toBe(900);
    expect(st.wallet.otherUsed).toBe(120);
    expect(loadStore(null, null).projects).toHaveLength(1);
    expect(() => loadStore('{"projects":[]}', null)).toThrow();
  });
  it('타임코드 반올림 경계 (59.96초 → 01:00.0)', () => {
    expect(tc(59.96)).toBe('01:00.0');
    expect(tc(3)).toBe('00:03.0');
  });
  it('영문 실존 인물은 단어 단위로만 검사', () => {
    expect(findRealNames('a musket on the wall')).toEqual([]);
    expect(findRealNames('Elon Musk waves')).toContain('musk');
  });
});

describe('v2: 프롬프트·나레이션', () => {
  const p = defaultProject('A');
  it('오디오 줄: 기본 포함, 끄면 제외', () => {
    expect(shotPrompt(p, p.shots[0])).toContain('Audio: natural ambience of');
    expect(shotPrompt(p, { ...p.shots[0], sfx: 'low wind' })).toContain('Audio: low wind; no dialogue');
    expect(shotPrompt({ ...p, brief: { ...p.brief, audio: false } }, p.shots[0])).not.toContain('Audio:');
  });
  it('나레이션이 샷 길이보다 길면 voLong 경고', () => {
    expect(narrationSeconds('가나다라마바')).toBe(1);
    const s = defaultShots('A');
    s[0].narration = '이 문장은 삼 초짜리 샷에 넣기에는 너무나도 긴 나레이션 문장입니다'; // S01 = 3초
    expect(checkRules(s).find((w) => w.rule === 'voLong')?.shotIds).toEqual(['S01']);
  });
  it('SRT 자막: 폐기 샷은 빼고 시간을 당김', () => {
    const q = defaultProject('A');
    q.shots[0].narration = '첫 줄';
    q.shots[1].narration = '버릴 줄';
    q.shots[1].status = '폐기';
    q.shots[2].narration = '셋째 줄';
    const srt = buildSrt(q);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:03,000\n첫 줄');
    expect(srt).toContain('2\n00:00:03,000 --> 00:00:11,000\n셋째 줄');
    expect(srt).not.toContain('버릴 줄');
  });
});

describe('v2: 자동 수정·다음 할 일', () => {
  it('autoFix: 무브 미지정·고정 부족·크기 3연속·ID 중복·기법 충돌 해결', () => {
    const s = defaultShots('A');
    s[1].move = '패닝'; // 고정 부족
    s[3].move = '';
    s[4].size = 'CU';
    s[5].size = 'CU';
    s[6].size = 'CU';
    s[7].id = 'S01';
    s[2].techniques = ['locked']; // 돌리인 + 고정 전용 기법
    const r = autoFix(s, 'shorts');
    expect(r.fixed.length).toBeGreaterThanOrEqual(4);
    expect(r.remaining).toEqual([]);
    expect(s[3].move).toBe(''); // 원본은 건드리지 않음
  });
  it('autoFix: INSERT가 없으면 CU 하나를 INSERT로', () => {
    const s = defaultShots('A').map((x) => (x.size === 'INSERT' ? { ...x, size: 'MS' as const } : x));
    const r = autoFix(s, 'shorts');
    expect(r.shots.some((x) => x.size === 'INSERT')).toBe(true);
  });
  it('nextAction: 주제 → 참조 이미지 → 생성 → 판정 → 마무리', () => {
    const p = defaultProject('A');
    expect(nextAction(p).step).toBe('plan');
    p.brief.topic = '지하 신전';
    expect(nextAction(p).text).toContain('참조 이미지');
    p.characters[0].ready = true;
    p.locations[0].ready = true;
    expect(nextAction(p)).toMatchObject({ step: 'shoot', shotIndex: 0 });
    p.shots[0].status = '생성';
    expect(nextAction(p).text).toContain('판정');
    p.shots.forEach((s) => (s.status = '채택'));
    expect(nextAction(p).step).toBe('wrap');
  });
});

describe('v2: 지갑·보관함', () => {
  it('여러 편 합산 잔량, 끝난 편 기준 평균 단가, 재생성률 반영 예상 비용', () => {
    const st = newStore();
    const a = st.projects[0];
    a.shots.forEach((s) => Object.assign(s, { status: '채택', takes: 2, credits: 40, model: 'Fast' })); // 320, 끝난 편
    const b = nextEpisode(a);
    b.shots.forEach((s) => (s.model = 'Fast'));
    b.shots[0].credits = 20; // 진행 중
    st.projects.push(b);
    st.wallet.otherUsed = 30;
    const w = walletSummary(st, b);
    expect(w.used).toBe(370);
    expect(w.remaining).toBe(680);
    expect(w.avgPerEpisode).toBe(320); // 진행 중인 b는 평균에서 제외
    expect(w.possibleEpisodes).toBe(2);
    expect(w.retryRate).toBe(2);
    expect(w.planMin).toBe(160);
    expect(w.planLikely).toBe(320);
  });
  it('다음 편: 스타일·캐릭터 유지, 기록 초기화, 새 ID', () => {
    const p = defaultProject('B');
    p.shots[0].credits = 50;
    p.shots[0].status = '채택';
    const q = nextEpisode(p);
    expect(q.id).not.toBe(p.id);
    expect(q.characters).toHaveLength(2);
    expect(q.shots[0].credits).toBe(0);
    expect(q.shots[0].status).toBe('대기');
  });
  it('모델 배분: 균형 = 후킹·반전만 Quality, 완료 샷은 유지', () => {
    const s = defaultShots('A');
    s[1].status = '채택';
    s[1].model = 'Lite';
    const r = applyModelPlan(s, 'balanced');
    expect(r.filter((x) => x.model === 'Quality').map((x) => x.beat)).toEqual(['hook', 'twist', 'twist']);
    expect(r[1].model).toBe('Lite');
  });
  it('캐릭터 삭제 시 샷 연결 해제', () => {
    const p = defaultProject('A');
    expect(removeAsset(p, 'char', 'C1').shots.every((s) => s.characterId === '')).toBe(true);
  });
  it('번역 도우미: 한글 칸만 모아 요청 → 답변 적용', () => {
    const p = defaultProject('A');
    p.shots[2].action = '벽으로 천천히 걸어간다';
    expect(Object.keys(koreanFields(p))).toEqual(['shot.2.action']);
    expect(buildTranslateRequest(p)).toContain('shot.2.action');
    const r = applyTranslation(p, '```json\n{"shot.2.action":"walks slowly toward the wall","shot.99.action":"x"}\n```');
    expect(r.applied).toBe(1);
    expect(r.project.shots[2].action).toBe('walks slowly toward the wall');
    expect(koreanFields(r.project)).toEqual({});
  });
});

import { firstAction } from './lib';
describe('v2: 수동 경고 안내', () => {
  it('첫 동작만 남기기', () => {
    expect(firstAction('walks toward a wall and touches it')).toBe('walks toward a wall');
    expect(firstAction('돌아서고 그리고 달린다')).toBe('돌아서고');
    expect(firstAction('stands in the sand')).toBe('stands in the sand');
  });
  it('자동 수정이 불가능한 경고는 해당 샷으로 안내', () => {
    const p = defaultProject('A');
    p.brief.topic = 'x';
    p.shots[2].action = 'walks and waves';
    const n = nextAction(p);
    expect(n.text).toContain('직접 고칠 경고');
    expect(n.shotIndex).toBe(2);
  });
});
