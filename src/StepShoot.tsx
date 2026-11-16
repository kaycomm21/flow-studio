import { QC_LABELS, beatLabel, buildCharacterSheet, buildCoverage, needsRegen, qcAverage, shotImagePrompt, shotPrompt, type Shot } from './lib';
import { DEFECTS, buildLocationSheet, buildLocationTour, buildRegenPrompt } from './director';
import { isDone, progress } from './assist';
import { Fold, PromptBox, numIn, type Ctx } from './ui';

const ICON: Record<Shot['status'], string> = { 대기: '○', 생성: '◐', 채택: '✓', 재생성: '↻', 폐기: '✕' };

export default function StepShoot({ c }: { c: Ctx }) {
  const { p, setP, store } = c;
  if (p.shots.length === 0) return <div className="card">샷이 없습니다. <button className="link" onClick={() => c.go('board')}>콘티</button>에서 샷을 추가하세요.</div>;
  const i = Math.min(c.focus, p.shots.length - 1);
  const s = p.shots[i];
  const cost = store.wallet.costs[s.model];
  const pr = progress(p);
  const setShot = (patch: Partial<Shot>) => setP((x) => ({ ...x, shots: x.shots.map((y, j) => (j === i ? { ...y, ...patch } : y)) }));
  const usedChars = new Set(p.shots.map((x) => x.characterId).filter(Boolean));
  const usedLocs = new Set(p.shots.map((x) => x.locationId).filter(Boolean));
  const chars = p.characters.filter((x) => usedChars.has(x.id));
  const locs = p.locations.filter((x) => usedLocs.has(x.id));
  const assetsLeft = [...chars, ...locs].filter((x) => !x.ready).length;
  const base = shotPrompt(p, s);
  const video = s.defects.length ? buildRegenPrompt(base, s) : base;
  const avg = qcAverage(s.qc);

  const addTake = () => {
    setShot({ takes: s.takes + 1, credits: s.credits + cost, status: s.status === '대기' || s.status === '재생성' ? '생성' : s.status });
    c.say(`${s.id} 생성 ${s.takes + 1}회 · −${cost} 크레딧 기록`);
  };
  const undoTake = () => s.takes > 0 && setShot({ takes: s.takes - 1, credits: Math.max(0, s.credits - cost), status: s.takes - 1 === 0 ? '대기' : s.status });
  const judge = (status: Shot['status']) => {
    setShot({ status, ...(status === '채택' ? { defects: [] } : {}) });
    if (status === '채택' || status === '폐기') {
      const next = p.shots.findIndex((x, j) => j !== i && !isDone(x));
      if (next >= 0) {
        c.setFocus(next);
        c.say(`${s.id} ${status} → 다음: ${p.shots[next].id}`);
      } else {
        c.say('모든 샷 완료 🎉');
        c.go('wrap');
      }
    }
  };

  return (
    <section>
      {(chars.length > 0 || locs.length > 0) && (
        <Fold open={assetsLeft > 0} title="🧩 먼저 만들 참조 이미지" badge={<small className={assetsLeft ? 'warn' : 'green'}>{assetsLeft ? `${assetsLeft}개 남음` : '준비 완료 ✓'}</small>}>
          <div className="muted">Flow의 이미지 생성(Nano Banana)에 붙여넣어 시트를 만든 뒤, 영상 생성 때 참조 이미지(Ingredients)로 넣으면 인물·장소가 샷마다 같게 유지됩니다.</div>
          {chars.map((ch) => (
            <div key={ch.id} className="pbox">
              <PromptBox c={c} kind="img" title={<>👤 {ch.id} {ch.name} 캐릭터 시트</>} text={buildCharacterSheet(ch, p.bible)} label={`${ch.id} 시트 복사됨`} />
              <label className="check">
                <input type="checkbox" checked={!!ch.ready} onChange={(e) => setP((x) => ({ ...x, characters: x.characters.map((y) => (y.id === ch.id ? { ...y, ready: e.target.checked } : y)) }))} />
                <span>이미지 생성 완료</span>
              </label>
            </div>
          ))}
          {locs.map((l) => (
            <div key={l.id} className="pbox">
              <PromptBox c={c} kind="img" title={<>📍 {l.id} {l.name} 월드 시트</>} text={buildLocationSheet(l, p.bible)} label={`${l.id} 시트 복사됨`} />
              <label className="check">
                <input type="checkbox" checked={!!l.ready} onChange={(e) => setP((x) => ({ ...x, locations: x.locations.map((y) => (y.id === l.id ? { ...y, ready: e.target.checked } : y)) }))} />
                <span>이미지 생성 완료</span>
              </label>
              <details>
                <summary>🌐 같은 장소 B롤 5종 (월드 카메라)</summary>
                {buildLocationTour(l, p.bible, p.brief.format).map((v, k) => (
                  <PromptBox key={k} c={c} kind="cov" title={`${l.id}-${k + 1} ${v.label}`} text={v.prompt} />
                ))}
              </details>
            </div>
          ))}
        </Fold>
      )}

      <div className="card">
        <div className="row between">
          <b>진행 {pr.adopted}/{pr.total} 채택{pr.dropped ? ` · 폐기 ${pr.dropped}` : ''}</b>
          <span className="muted">○ 대기 ◐ 판정 대기 ✓ 채택 ↻ 재생성 ✕ 폐기</span>
        </div>
        <div className="bar"><div style={{ width: `${pr.pct}%` }} /></div>
        <div className="chips">
          {p.shots.map((x, j) => (
            <button key={j} className={`chip st-${x.status} ${j === i ? 'cur' : ''}`} onClick={() => c.setFocus(j)}>
              {ICON[x.status]} {x.id}
            </button>
          ))}
        </div>
      </div>

      <div className={`card focus st-${s.status}`}>
        <div className="cardhead">
          <b className="big">{s.id} <small>{beatLabel(s.beat)} · {s.size} · {s.angle} · {s.move || '무브 없음'} · {s.seconds}s</small></b>
          <span className={`tag st-${s.status}`}>{s.status}</span>
        </div>
        {s.narration && <div className="vo">🎙 {s.narration}</div>}

        {s.keyframe && <PromptBox c={c} kind="img" title="① 키프레임 이미지 (Nano Banana) — 먼저 이미지로 만들고, 영상 생성의 시작 프레임으로 사용" text={shotImagePrompt(p, s)} label={`${s.id} 키프레임 복사됨`} />}
        <PromptBox c={c} primary title={`${s.keyframe ? '②' : '①'} 영상 프롬프트 — ${s.model}${s.defects.length ? ' · 보정 줄 포함' : ''}`} text={video} label={`${s.id} 영상 프롬프트 복사됨 — Flow에 붙여넣으세요`} />

        <div className="judge">
          <div className="row wrap between">
            <span className="row wrap">
              <button className="primary" onClick={addTake}>＋ 생성 1회 기록 (−{cost}cr)</button>
              {s.takes > 0 && <button className="link" onClick={undoTake}>1회 취소</button>}
            </span>
            <span className="row">
              <span className="muted">{s.takes}회 · 사용</span>
              <input className="w5" type="number" min={0} value={s.credits} onChange={(e) => setShot({ credits: numIn(e.target.value) })} title="실제 차감된 크레딧과 다르면 직접 고치세요" />
              <span className="muted">cr</span>
            </span>
          </div>
          <div className="row wrap verdict">
            <button className={`v ok ${s.status === '채택' ? 'on' : ''}`} onClick={() => judge('채택')}>✅ 채택</button>
            <button className={`v re ${s.status === '재생성' ? 'on' : ''}`} onClick={() => judge('재생성')}>🔁 재생성</button>
            <button className={`v no ${s.status === '폐기' ? 'on' : ''}`} onClick={() => judge('폐기')}>🗑 폐기</button>
          </div>
          {(s.status === '재생성' || s.defects.length > 0) && (
            <div className="f wide">
              <span className="fl">무엇이 문제였나요? — 고르면 위 영상 프롬프트에 보정 지시가 자동으로 붙습니다</span>
              <div className="chips">
                {DEFECTS.map((d) => {
                  const on = s.defects.includes(d.id);
                  return (
                    <button key={d.id} className={`chip ${on ? 'on' : ''}`} onClick={() => setShot({ defects: on ? s.defects.filter((x) => x !== d.id) : [...s.defects, d.id] })}>
                      {d.ko}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <details>
          <summary>📝 QC 점수 (선택){avg !== null && <b className={needsRegen(s.qc) ? 'neg' : 'green'}> 평균 {avg.toFixed(1)}{needsRegen(s.qc) ? ' — 3.5 미만, 재생성 권장' : ''}</b>}</summary>
          {QC_LABELS.map((l, q) => (
            <div key={l} className="qcrow">
              <span>{l}</span>
              <span className="row">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={`dot5 ${s.qc[q] >= n ? 'on' : ''}`} onClick={() => { const qc = [...s.qc] as Shot['qc']; qc[q] = s.qc[q] === n ? 0 : n; setShot({ qc }); }} aria-label={`${l} ${n}점`}>{n}</button>
                ))}
              </span>
            </div>
          ))}
        </details>
        <details>
          <summary>🎞 멀티앵글 — 같은 순간을 6가지 앵글로</summary>
          {buildCoverage(s, p.bible, p.brief.format, p.characters, p.locations).map((cv, k) => (
            <PromptBox key={k} c={c} kind="cov" title={`${s.id}-${String.fromCharCode(65 + k)} ${cv.label}`} text={cv.prompt} />
          ))}
        </details>

        <div className="row between">
          <button onClick={() => c.setFocus(Math.max(0, i - 1))} disabled={i === 0}>← 이전 샷</button>
          <button className="link" onClick={() => c.go('board', i)}>콘티에서 수정</button>
          <button onClick={() => c.setFocus(Math.min(p.shots.length - 1, i + 1))} disabled={i === p.shots.length - 1}>다음 샷 →</button>
        </div>
      </div>
    </section>
  );
}
