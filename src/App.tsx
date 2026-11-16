import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkRules, projectRealNames, type Project } from './lib';
import { OLD_KEY, STORE_KEY, loadStore, newStore, nextAction, progress, projectTitle, walletSummary, type StepKey, type Store } from './assist';
import { copyText, type Ctx } from './ui';
import StepPlan from './StepPlan';
import StepBoard from './StepBoard';
import StepShoot from './StepShoot';
import StepWrap from './StepWrap';
import Library from './Library';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'plan', label: '기획' },
  { key: 'board', label: '콘티' },
  { key: 'shoot', label: '제작' },
  { key: 'wrap', label: '마무리' },
];

function initial(): { store: Store; error: string } {
  let v2: string | null = null;
  let v1: string | null = null;
  try {
    v2 = localStorage.getItem(STORE_KEY);
    v1 = localStorage.getItem(OLD_KEY);
  } catch {
    return { store: newStore(), error: '이 브라우저는 저장소를 쓸 수 없어 새로고침하면 내용이 사라집니다. 마무리 탭에서 백업 파일을 내려받으세요.' };
  }
  try {
    return { store: loadStore(v2, v1), error: '' };
  } catch {
    // 읽지 못한 원본은 지우지 않고 따로 보관 (덮어쓰기로 인한 데이터 손실 방지)
    try {
      localStorage.setItem(`flow-studio-broken-${Date.now()}`, v2 ?? v1 ?? '');
    } catch {
      /* 무시 */
    }
    return { store: newStore(), error: '저장된 데이터를 읽지 못해 새로 시작했습니다. 원본은 브라우저에 따로 보관해 두었습니다.' };
  }
}

export default function App() {
  const init = useMemo(initial, []);
  const [store, setStoreRaw] = useState<Store>(init.store);
  const [error, setError] = useState(init.error);
  const [step, setStep] = useState<StepKey>(() => nextAction(init.store.projects.find((x) => x.id === init.store.activeId) ?? init.store.projects[0]).step);
  const [focus, setFocus] = useState(0);
  const [boardOpen, setBoardOpen] = useState<number | null>(null);
  const [lib, setLib] = useState(false);
  const [toast, setToast] = useState<{ msg: string; undo?: Store } | null>(null);
  const timer = useRef<number>();

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      setError('저장에 실패했습니다 (브라우저 저장 공간 부족 또는 차단). 마무리 탭에서 전체 백업을 내려받으세요.');
    }
  }, [store]);

  const p = store.projects.find((x) => x.id === store.activeId) ?? store.projects[0];

  const show = useCallback((msg: string, undo?: Store) => {
    window.clearTimeout(timer.current);
    setToast({ msg, undo });
    timer.current = window.setTimeout(() => setToast(null), undo ? 8000 : 2200);
  }, []);

  const c: Ctx = {
    store,
    p,
    focus,
    setFocus,
    boardOpen,
    setBoardOpen,
    setStore: (fn) => setStoreRaw(fn),
    setP: (fn) =>
      setStoreRaw((s) => ({ ...s, projects: s.projects.map((x) => (x.id === s.activeId ? { ...fn(x), id: x.id, updatedAt: Date.now() } : x)) })),
    commit: (label, fn) => {
      const before = store;
      setStoreRaw((s) => {
        const next = fn(s);
        return { ...next, projects: next.projects.map((x) => (x.id === next.activeId ? { ...x, updatedAt: Date.now() } : x)) };
      });
      show(`✅ ${label}`, before);
    },
    say: (m) => show(m),
    copy: async (t, label) => show((await copyText(t)) ? `✅ ${label ?? '복사됨'}` : '⚠️ 복사 실패 — 글자를 길게 눌러 직접 복사하세요'),
    go: (k, shotIndex) => {
      setStep(k);
      if (shotIndex !== undefined) {
        if (k === 'shoot') setFocus(shotIndex);
        if (k === 'board') setBoardOpen(shotIndex);
      }
      setLib(false);
      window.scrollTo({ top: 0 });
    },
  };

  const warnings = useMemo(() => checkRules(p.shots, p.brief.format), [p.shots, p.brief.format]);
  const realNames = useMemo(() => projectRealNames(p as Project), [p]);
  const next = nextAction(p);
  const pr = progress(p);
  const w = walletSummary(store, p);

  return (
    <div className="app">
      <header>
        <div className="top">
          <h1><span className="dot" />Flow 콘티 스튜디오</h1>
          <button className="epbtn" onClick={() => setLib(!lib)} title="편 바꾸기 · 새 편 만들기">
            📁 <span>{projectTitle(p)}</span> ▾
          </button>
          <button className={`credit ${w.remaining < 0 || w.afterPlan < 0 ? 'low' : ''}`} onClick={() => c.go('wrap')} title="크레딧 지갑">
            💳 {w.remaining.toLocaleString()}
          </button>
        </div>
        <nav>
          {STEPS.map((s, i) => (
            <button key={s.key} className={s.key === step ? 'on' : ''} onClick={() => c.go(s.key)}>
              <i>{i + 1}</i>
              {s.label}
              {s.key === 'board' && warnings.length > 0 && <span className="badge">{warnings.length}</span>}
              {s.key === 'shoot' && <small>{pr.adopted}/{pr.total}</small>}
            </button>
          ))}
        </nav>
      </header>

      {!lib && (
        <button className="next" onClick={() => c.go(next.step, next.shotIndex)}>
          <span>▶ 다음 할 일</span>
          <b>{next.text}</b>
          <em>이동 →</em>
        </button>
      )}
      {error && <div className="alert">⚠️ {error} <button className="link" onClick={() => setError('')}>닫기</button></div>}
      {realNames.length > 0 && (
        <div className="alert">⚠️ 실존 인물·정당으로 보이는 이름: <b>{realNames.join(', ')}</b> — 가상 인물·단체로 바꾸세요.</div>
      )}

      <main>
        {lib ? <Library c={c} close={() => setLib(false)} /> : step === 'plan' ? <StepPlan c={c} /> : step === 'board' ? <StepBoard c={c} /> : step === 'shoot' ? <StepShoot c={c} /> : <StepWrap c={c} />}
      </main>
      <footer>서버·API 키 없음 · 이 브라우저에만 자동 저장 · 백업은 마무리 탭</footer>
      {toast && (
        <div className="toast" role="status">
          {toast.msg}
          {toast.undo && (
            <button onClick={() => { setStoreRaw(toast.undo!); setToast(null); }}>되돌리기</button>
          )}
        </div>
      )}
    </div>
  );
}
