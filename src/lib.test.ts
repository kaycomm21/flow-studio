import { describe, it, expect } from 'vitest';
import {
  BIBLES,
  buildImagePrompt,
  buildVideoPrompt,
  checkRules,
  creditSummary,
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
  it('잔량·평균 단가·가능 편수 계산', () => {
    const shots = defaultShots('A').map((s) => ({ ...s, credits: 20 })); // 이번 편 160
    const r = creditSummary({ start: 1050, pastUsed: 140, pastEpisodes: 1 }, shots);
    expect(r.totalUsed).toBe(300);
    expect(r.remaining).toBe(750);
    expect(r.episodes).toBe(2);
    expect(r.avgPerEpisode).toBe(150);
    expect(r.possibleEpisodes).toBe(5);
  });

  it('사용 기록이 없으면 가능 편수는 계산 불가(null)', () => {
    expect(creditSummary({ start: 1050, pastUsed: 0, pastEpisodes: 0 }, defaultShots('A')).possibleEpisodes).toBeNull();
  });

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
