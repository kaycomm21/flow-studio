import { useState } from 'react';
import {
  ANGLES,
  BEATS,
  MODELS,
  MOVES,
  SCREEN_DIRS,
  SIZES,
  SPEEDS,
  TRANSITIONS,
  beatLabel,
  blankShot,
  checkRules,
  firstAction,
  hasMultipleActions,
  narrationSeconds,
  nextShotId,
  shotPrompt,
  type Shot,
} from './lib';
import { BEAT_RECO, TECHNIQUES, TECH_CATS, isCompatible, recommend, techById } from './techniques';
import { applyModelPlan, autoFix, hasHangul, isDone, type ModelPlan } from './assist';
import { Code, Field, Sel, numIn, type Ctx } from './ui';

const BEAT_COLOR: Record<string, string> = { hook: 'var(--accent)', context: 'var(--cyan)', develop: 'var(--green)', twist: 'var(--orange)', resolve: 'var(--yellow)', cta: 'var(--purple)' };

export default function StepBoard({ c }: { c: Ctx }) {
  const { p, setP, store } = c;
  const open = c.boardOpen;
  const setOpen = c.setBoardOpen;
  const [allTech, setAllTech] = useState(false);
  const warnings = checkRules(p.shots, p.brief.format);
  const flagged = new Set(warnings.flatMap((w) => w.shotIds));
  const total = p.shots.reduce((a, s) => a + (Number(s.seconds) || 0), 0);
  const cost = p.shots.filter((s) => !isDone(s)).reduce((a, s) => a + store.wallet.costs[s.model], 0);
  const setShots = (label: string, fn: (shots: Shot[]) => Shot[]) =>
    c.commit(label, (s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, shots: fn(x.shots) } : x)) }));
  const setShot = (i: number, patch: Partial<Shot>) => setP((x) => ({ ...x, shots: x.shots.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const fix = () => {
    const r = autoFix(p.shots, p.brief.format);
    if (r.fixed.length === 0) return c.say('자동으로 고칠 수 있는 항목이 없습니다 — 남은 경고는 직접 수정하세요');
    setShots(`자동 수정 ${r.fixed.length}건`, () => r.shots);
  };
  const plan = (m: ModelPlan, label: string) => setShots(`모델 배분: ${label}`, (shots) => applyModelPlan(shots, m));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= p.shots.length) return;
    setP((x) => {
      const shots = [...x.shots];
      [shots[i], shots[j]] = [shots[j], shots[i]];
      return { ...x, shots };
    });
    setOpen(j);
  };

  return (
    <section>
      <div className="card">
        <div className="tl" title="비트별 시간 배분">
          {p.shots.map((s, i) => (
            <button key={i} className={`tlseg ${flagged.has(s.id) ? 'tlwarn' : ''}`} style={{ flexGrow: Math.max(1, Number(s.seconds) || 1), background: BEAT_COLOR[s.beat] }} onClick={() => setOpen(i)} title={`${s.id} ${beatLabel(s.beat)} ${s.seconds}초`}>
              {s.id.replace(/^S0?/, '')}
            </button>
          ))}
        </div>
        <div className="legend">
          {BEATS.map((b) => (
            <span key={b.key}><i style={{ background: BEAT_COLOR[b.key] }} />{b.label} {b.from}–{b.to}s</span>
          ))}
        </div>
        <div className="row wrap between">
          <span className={p.brief.format === 'shorts' && total > 60 ? 'neg' : 'muted'}>
            ⏱ 총 <b>{total}초</b>{p.brief.format === 'shorts' ? ' / 60초' : ''} · 🎬 {p.shots.length}샷 · 💳 예상 최소 <b>{cost}</b> 크레딧
          </span>
          <span className="row wrap">
            <span className="muted">모델 배분</span>
            <button onClick={() => plan('save', '절약')} title="전부 Fast">절약</button>
            <button onClick={() => plan('balanced', '균형')} title="후킹·반전만 Quality">균형</button>
            <button onClick={() => plan('best', '최고')} title="전부 Quality">최고</button>
          </span>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div className="card warnbox">
          <div className="cardhead">
            <b>⚠️ 연출 규칙 경고 {warnings.length}건</b>
            <button className="primary" onClick={fix}>🔧 자동 수정</button>
          </div>
          <ul className="warnlist">
            {warnings.map((w, i) => {
              const idx = p.shots.findIndex((s) => w.shotIds.includes(s.id));
              return <li key={i}>{w.message} {idx >= 0 && <button className="link" onClick={() => setOpen(idx)}>열기</button>}</li>;
            })}
          </ul>
        </div>
      ) : (
        <div className="ok">✅ 연출 규칙 경고 없음 — <button className="link" onClick={() => c.go('shoot')}>제작 단계로 →</button></div>
      )}

      {p.shots.map((s, i) => {
        const on = open === i;
        const vo = narrationSeconds(s.narration);
        const reco = BEAT_RECO[s.beat];
        const shown = allTech ? TECHNIQUES : TECHNIQUES.filter((t) => s.techniques.includes(t.id) || (reco.includes(t.id) && isCompatible(t, s.move)));
        return (
          <div key={i} className={`shot ${on ? 'open' : ''} ${flagged.has(s.id) ? 'flag' : ''}`}>
            <button className="shothead" onClick={() => setOpen(on ? null : i)} aria-expanded={on}>
              <span className="sid" style={{ borderColor: BEAT_COLOR[s.beat] }}>{s.id}</span>
              <span className="smain">
                <span className="sline">
                  <b>{beatLabel(s.beat)}</b> · {s.size} · {s.angle} · <span className={s.move ? '' : 'neg'}>{s.move || '무브 없음'}</span> · {s.seconds}s · {s.model}
                  {s.keyframe && ' · 🖼'}
                  {isDone(s) && <em className="tag">{s.status}</em>}
                </span>
                <span className="svo">{s.narration || <i className="muted">(나레이션 없음)</i>}</span>
                <span className="sen">{s.subject} — {s.action}</span>
              </span>
              <span className="chev">{on ? '▾' : '▸'}</span>
            </button>
            {on && (
              <div className="shotbody">
                <Field label="🎙 나레이션 (한국어)" wide hint={<span className={vo > s.seconds + 0.5 ? 'neg' : ''}>읽는 시간 약 {vo.toFixed(1)}초 / 샷 {s.seconds}초</span>}>
                  <textarea rows={2} value={s.narration} placeholder="이 샷에서 들릴 한 문장" onChange={(e) => setShot(i, { narration: e.target.value })} />
                </Field>
                <div className="grid2">
                  <Field label="피사체 (영어)" hint={hasHangul(s.subject) ? <span className="warn">한글 → 기획 탭에서 영어 변환</span> : undefined}>
                    <input value={s.subject} placeholder="A lone explorer…" onChange={(e) => setShot(i, { subject: e.target.value })} />
                  </Field>
                  <Field label="동작 — 딱 1개 (영어)" hint={hasMultipleActions(s.action) ? <span className="neg">동작이 2개입니다. <button className="link" onClick={() => setShot(i, { action: firstAction(s.action) })}>첫 동작만 남기기 → “{firstAction(s.action)}”</button></span> : hasHangul(s.action) ? <span className="warn">한글 → 영어 변환 필요</span> : undefined}>
                    <input className={hasMultipleActions(s.action) ? 'bad' : ''} value={s.action} placeholder="walks slowly toward the wall" onChange={(e) => setShot(i, { action: e.target.value })} />
                  </Field>
                  <Field label="장소 묘사 (영어)"><input value={s.setting} onChange={(e) => setShot(i, { setting: e.target.value })} /></Field>
                  <Field label="조명 · 시간대 (영어)"><input value={s.lighting} onChange={(e) => setShot(i, { lighting: e.target.value })} /></Field>
                </div>
                <div className="grid4">
                  <Field label="비트"><Sel v={s.beat} opts={BEATS.map((b) => b.key)} labels={Object.fromEntries(BEATS.map((b) => [b.key, b.label]))} on={(v) => setShot(i, { beat: v })} /></Field>
                  <Field label="샷크기"><Sel v={s.size} opts={SIZES} on={(v) => setShot(i, { size: v })} /></Field>
                  <Field label="앵글"><Sel v={s.angle} opts={ANGLES} on={(v) => setShot(i, { angle: v })} /></Field>
                  <Field label="카메라무브"><Sel v={s.move} opts={MOVES} empty="(미지정)" bad={!s.move} on={(v) => setShot(i, { move: v })} /></Field>
                  <Field label="속도"><Sel v={s.speed} opts={SPEEDS} empty="-" on={(v) => setShot(i, { speed: v })} /></Field>
                  <Field label="화면 방향"><Sel v={s.screenDir} opts={SCREEN_DIRS} empty="-" on={(v) => setShot(i, { screenDir: v })} /></Field>
                  <Field label="사용 초"><input type="number" min={0} step={0.5} value={s.seconds} onChange={(e) => setShot(i, { seconds: numIn(e.target.value) })} /></Field>
                  <Field label="다음 샷으로 전환"><Sel v={s.transition} opts={TRANSITIONS} on={(v) => setShot(i, { transition: v })} /></Field>
                  <Field label={`모델 (${store.wallet.costs[s.model]}cr)`}><Sel v={s.model} opts={MODELS} on={(v) => setShot(i, { model: v })} /></Field>
                  <Field label="캐릭터 고정">
                    <select value={s.characterId} onChange={(e) => setShot(i, { characterId: e.target.value })}>
                      <option value="">(없음)</option>
                      {p.characters.map((x) => <option key={x.id} value={x.id}>{x.id} {x.name}</option>)}
                    </select>
                  </Field>
                  <Field label="장소 고정">
                    <select value={s.locationId} onChange={(e) => setShot(i, { locationId: e.target.value })}>
                      <option value="">(없음)</option>
                      {p.locations.map((x) => <option key={x.id} value={x.id}>{x.id} {x.name}</option>)}
                    </select>
                  </Field>
                  <label className="check f">
                    <input type="checkbox" checked={s.keyframe} onChange={(e) => setShot(i, { keyframe: e.target.checked })} />
                    <span>🖼 키프레임 이미지 먼저</span>
                  </label>
                </div>
                <div className="grid2">
                  <Field label="카메라 끝 상태 (영어, ending …)"><input value={s.endState} placeholder="close on the carved wall" onChange={(e) => setShot(i, { endState: e.target.value })} /></Field>
                  <Field label="효과음 (영어, 비우면 자동)"><input value={s.sfx} placeholder="low wind, distant drip" onChange={(e) => setShot(i, { sfx: e.target.value })} /></Field>
                </div>
                <div className="f wide">
                  <span className="fl">
                    🎥 연출 기법 <small className="muted">— 1~2개만. ★ = 이 비트 추천</small>
                    <button className="link" onClick={() => setShot(i, { techniques: recommend(s.beat, s.move) })}>추천으로 채우기</button>
                    <button className="link" onClick={() => setAllTech(!allTech)}>{allTech ? '추천만 보기' : `전체 ${TECHNIQUES.length}종 보기`}</button>
                  </span>
                  {(allTech ? TECH_CATS : [null]).map((cat) => (
                    <div key={cat ?? 'x'} className="chips">
                      {cat && <span className="catlabel">{cat}</span>}
                      {shown.filter((t) => !cat || t.cat === cat).map((t) => {
                        const sel = s.techniques.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            className={`chip ${sel ? 'on' : ''} ${isCompatible(t, s.move) ? '' : 'dim'}`}
                            title={`${t.use}${t.moves ? ` · 무브: ${t.moves.join('/')}` : ''}\n${t.en}`}
                            onClick={() => setShot(i, { techniques: sel ? s.techniques.filter((x) => x !== t.id) : [...s.techniques, t.id] })}
                          >
                            {reco.includes(t.id) && '★ '}{t.ko}
                          </button>
                        );
                      })}
                      {!cat && shown.length === 0 && <span className="muted">이 무브에 맞는 추천이 없습니다 — 전체 보기에서 고르세요</span>}
                    </div>
                  ))}
                  {s.techniques.length > 2 && <small className="warn">기법이 3개 이상이면 AI가 지시를 섞어 버립니다. 2개 이하를 권장합니다.</small>}
                  {s.techniques.map((id) => techById(id)).filter((t) => t && !isCompatible(t, s.move)).map((t) => (
                    <small key={t!.id} className="neg">'{t!.ko}'는 무브 {t!.moves!.join('/')}에서만 동작합니다</small>
                  ))}
                </div>
                <details>
                  <summary>프롬프트 미리보기</summary>
                  <Code t={shotPrompt(p, s)} />
                </details>
                <div className="row wrap between">
                  <span className="row">
                    <button onClick={() => move(i, -1)} disabled={i === 0}>↑ 위로</button>
                    <button onClick={() => move(i, 1)} disabled={i === p.shots.length - 1}>↓ 아래로</button>
                    <button onClick={() => setShots(`${s.id} 복제`, (shots) => [...shots.slice(0, i + 1), { ...s, id: nextShotId(shots), takes: 0, credits: 0, status: '대기', defects: [], qc: [0, 0, 0, 0, 0] }, ...shots.slice(i + 1)])}>복제</button>
                    <button className="x" onClick={() => { setShots(`${s.id} 삭제`, (shots) => shots.filter((_, j) => j !== i)); setOpen(null); }}>삭제</button>
                  </span>
                  <button className="primary" onClick={() => c.go('shoot', i)}>이 샷 제작하기 →</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button onClick={() => { setP((x) => ({ ...x, shots: [...x.shots, { ...blankShot(x.shots.length), id: nextShotId(x.shots) }] })); setOpen(p.shots.length); }}>+ 샷 추가</button>
    </section>
  );
}
