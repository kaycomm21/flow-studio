import { useState, type ReactNode } from 'react';
import type { Project } from './lib';
import type { StepKey, Store } from './assist';

/** 모든 화면이 공유하는 조작 묶음 */
export interface Ctx {
  store: Store;
  p: Project;
  /** 현재 편 수정 (자잘한 입력용, 되돌리기 없음) */
  setP: (fn: (p: Project) => Project) => void;
  /** 큰 변경 (되돌리기 가능) */
  commit: (label: string, fn: (s: Store) => Store) => void;
  setStore: (fn: (s: Store) => Store) => void;
  copy: (text: string, label?: string) => void;
  say: (msg: string) => void;
  go: (step: StepKey, shotIndex?: number) => void;
  focus: number;
  boardOpen: number | null;
  setBoardOpen: (i: number | null) => void;
  setFocus: (i: number) => void;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 프롬프트 블록: 줄 머리("Setting:" 등)를 코드 에디터처럼 색 구분 */
export function Code({ t, kind }: { t: string; kind?: 'img' | 'cov' }) {
  return (
    <pre className={kind ?? ''}>
      {t.split('\n').map((line, i) => {
        if (/^No text/i.test(line)) return <span key={i} className="c-cm">{line + '\n'}</span>;
        const m = line.match(/^([A-Z][A-Za-z ]{2,24}:)(.*)$/);
        if (m) return <span key={i}><span className="c-kw">{m[1]}</span>{m[2] + '\n'}</span>;
        if (i === 0) return <span key={i} className="c-fn">{line + '\n'}</span>;
        return <span key={i}>{line + '\n'}</span>;
      })}
    </pre>
  );
}

export function Sel<T extends string>({ v, opts, on, empty, bad, labels }: { v: T; opts: readonly T[]; on: (v: T) => void; empty?: string; bad?: boolean; labels?: Partial<Record<T, string>> }) {
  return (
    <select value={v} className={bad ? 'bad' : ''} onChange={(e) => on(e.target.value as T)}>
      {opts.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? (o || empty || '-')}
        </option>
      ))}
    </select>
  );
}

/** 프롬프트 한 덩어리: 제목 + [복사] + 본문 */
export function PromptBox({ title, text, kind, c, primary, label }: { title: ReactNode; text: string; kind?: 'img' | 'cov'; c: Ctx; primary?: boolean; label?: string }) {
  return (
    <div className="pbox">
      <div className="cardhead">
        <b>{title}</b>
        <button className={primary ? 'primary' : ''} onClick={() => c.copy(text, label)}>
          📋 복사
        </button>
      </div>
      <Code t={text} kind={kind} />
    </div>
  );
}

/** 접었다 펴는 구역 (고급 설정을 기본 화면에서 숨김) */
export function Fold({ title, children, open, badge }: { title: ReactNode; children: ReactNode; open?: boolean; badge?: ReactNode }) {
  const [on, setOn] = useState(!!open);
  return (
    <div className={`fold ${on ? 'open' : ''}`}>
      <button className="foldhead" onClick={() => setOn(!on)} aria-expanded={on}>
        <span>{on ? '▾' : '▸'} {title}</span>
        {badge}
      </button>
      {on && <div className="foldbody">{children}</div>}
    </div>
  );
}

export function Field({ label, children, hint, wide }: { label: ReactNode; children: ReactNode; hint?: ReactNode; wide?: boolean }) {
  return (
    <label className={`f ${wide ? 'wide' : ''}`}>
      <span className="fl">{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

export const numIn = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
