import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ANGLES,
  BEATS,
  BIBLES,
  CHARACTERS,
  LOCATIONS,
  SCREEN_DIRS,
  MODELS,
  MOVES,
  QC_LABELS,
  SIZES,
  SPEEDS,
  STATUSES,
  TRANSITIONS,
  beatLabel,
  blankShot,
  nextShotId,
  buildBridge,
  buildCharacterSheet,
  buildCoverage,
  buildImagePrompt,
  buildVideoPrompt,
  checkRules,
  creditSummary,
  defaultProject,
  defaultShots,
  exportJson,
  exportMarkdown,
  needsRegen,
  parseProject,
  projectRealNames,
  qcAverage,
  type Character,
  type Location,
  type PresetKey,
  type Project,
  type Shot,
} from './lib';
import {
  DEFECTS,
  buildAudioCue,
  buildEditCsv,
  buildLocationSheet,
  buildLocationTour,
  buildRegenPrompt,
  buildScenarioRequest,
  parseScenarioResponse,
  safeFileName,
} from './director';
import { BEAT_RECO, TECHNIQUES, TECH_CATS, isCompatible, recommend, techById } from './techniques';

const KEY = 'flow-studio-v1';
const TABS = ['브리프', '콘티', '연출', '프롬프트', '기록·크레딧'] as const;
type Tab = (typeof TABS)[number];

function load(): Project {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseProject(raw);
  } catch {
    /* 저장소 없음/손상 → 기본값 */
  }
  return defaultProject('A');
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export default function App() {
  const [p, setP] = useState<Project>(load);
  const [tab, setTab] = useState<Tab>('브리프');
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [sel, setSel] = useState(0); // 연출 탭에서 선택된 샷
  const [openCov, setOpenCov] = useState<number | null>(null);
  const [openTour, setOpenTour] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiIssues, setAiIssues] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* 무시 */
    }
  }, [p]);

  const warnings = useMemo(() => checkRules(p.shots, p.brief.format), [p.shots, p.brief.format]);
  const realNames = useMemo(() => projectRealNames(p), [p]);
  const flagged = useMemo(() => new Set(warnings.flatMap((w) => w.shotIds)), [warnings]);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 1600);
  };
  const copy = async (t: string, label = '복사됨') => say((await copyText(t)) ? `✅ ${label}` : '⚠️ 복사 실패');

  const setBrief = (patch: Partial<Project['brief']>) => setP((x) => ({ ...x, brief: { ...x.brief, ...patch } }));
  const setShot = (i: number, patch: Partial<Shot>) =>
    setP((x) => ({ ...x, shots: x.shots.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const setChar = (i: number, patch: Partial<Character>) =>
    setP((x) => ({ ...x, characters: x.characters.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const toggleTech = (i: number, id: string) =>
    setP((x) => ({
      ...x,
      shots: x.shots.map((s, j) =>
        j !== i ? s : { ...s, techniques: s.techniques.includes(id) ? s.techniques.filter((t) => t !== id) : [...s.techniques, id] },
      ),
    }));
  const autoDirect = () => {
    if (!confirm('모든 샷의 연출 기법을 비트별 추천으로 덮어쓸까요?')) return;
    setP((x) => ({ ...x, shots: x.shots.map((s) => ({ ...s, techniques: recommend(s.beat, s.move) })) }));
    say('✅ 비트별 추천 연출 적용');
  };
  const ch = p.characters;
  const charName = (id: string) => ch.find((c) => c.id === id)?.name ?? '';
  const lc = p.locations;
  const locName = (id: string) => lc.find((l) => l.id === id)?.name ?? '';
  const setLoc = (i: number, patch: Partial<Location>) =>
    setP((x) => ({ ...x, locations: x.locations.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const toggleDefect = (i: number, id: string) =>
    setP((x) => ({
      ...x,
      shots: x.shots.map((s, j) => (j !== i ? s : { ...s, defects: s.defects.includes(id) ? s.defects.filter((d) => d !== id) : [...s.defects, id] })),
    }));
  const applyAi = () => {
    try {
      const { shots, issues } = parseScenarioResponse(aiText, p);
      if (!confirm(`AI 답변에서 ${shots.length}샷을 읽었습니다. 현재 콘티를 덮어쓸까요?${issues.length ? `\n(자동 교정 ${issues.length}건)` : ''}`)) return;
      setP((x) => ({ ...x, shots }));
      setAiIssues(issues);
      say(`✅ AI 콘티 ${shots.length}샷 적용`);
    } catch (e) {
      alert('적용 실패: ' + (e as Error).message);
    }
  };

  const applyPreset = (k: PresetKey) => {
    if (!confirm(`프리셋 ${BIBLES[k].name}로 바꾸고 8샷을 다시 배치할까요?\n(현재 샷 내용은 덮어씁니다)`)) return;
    setP((x) => ({ ...x, brief: { ...x.brief, preset: k }, bible: { ...BIBLES[k] }, characters: CHARACTERS[k].map((c) => ({ ...c })), locations: LOCATIONS[k].map((l) => ({ ...l })), shots: defaultShots(k) }));
    say('✅ 프리셋 적용 + 8샷 자동 배치');
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      setP(parseProject(await f.text()));
      say('✅ 불러오기 완료');
    } catch (e) {
      alert('불러오기 실패: ' + (e as Error).message);
    }
  };

  const fname = (ext: string) => safeFileName(p.brief.series, ext, new Date());

  const allPrompts = p.shots
    .map((s) => {
      const v = `### ${s.id} (${beatLabel(s.beat)}, ${s.seconds}s, ${s.model})\n${buildVideoPrompt(s, p.bible, p.brief.format, ch, lc)}`;
      return s.keyframe ? `${v}\n\n### ${s.id} 키프레임(Nano Banana)\n${buildImagePrompt(s, p.bible, p.brief.format, ch, lc)}` : v;
    })
    .join('\n\n');

  const cs = creditSummary(p.credit, p.shots);
  const pct = Math.max(0, Math.min(100, p.credit.start > 0 ? (cs.remaining / p.credit.start) * 100 : 0));
  const totalSec = p.shots.reduce((a, s) => a + (Number(s.seconds) || 0), 0);

  return (
    <div className="app">
      <header>
        <h1><span className="dot" />Flow 콘티 스튜디오 <small>// cinematic prompt studio</small></h1>
        <nav>
          {TABS.map((t) => (
            <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
              {t}
              {t === '콘티' && warnings.length > 0 && <span className="badge">{warnings.length}</span>}
            </button>
          ))}
        </nav>
      </header>

      {realNames.length > 0 && (
        <div className="alert">
          ⚠️ 실존 인물·정당으로 보이는 이름이 있습니다: <b>{realNames.join(', ')}</b> — 가상 인물/단체로 바꾸세요.
        </div>
      )}

      <main>
        {tab === '브리프' && (
          <section className="card form">
            <label>
              시리즈명
              <input value={p.brief.series} onChange={(e) => setBrief({ series: e.target.value })} placeholder="예: 잊힌 신전 미스터리" />
            </label>
            <label>
              채널
              <input value={p.brief.channel} onChange={(e) => setBrief({ channel: e.target.value })} placeholder="예: 경제적 자유구역" />
            </label>
            <div className="field">
              장르 프리셋
              <div className="seg">
                {(['A', 'B', 'C'] as PresetKey[]).map((k) => (
                  <button key={k} className={p.brief.preset === k ? 'on' : ''} onClick={() => applyPreset(k)}>
                    {BIBLES[k].name}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              포맷
              <div className="seg">
                <button className={p.brief.format === 'shorts' ? 'on' : ''} onClick={() => setBrief({ format: 'shorts' })}>
                  쇼츠 60초 9:16
                </button>
                <button className={p.brief.format === 'long' ? 'on' : ''} onClick={() => setBrief({ format: 'long' })}>
                  롱폼 16:9
                </button>
              </div>
            </div>
            <label>
              주제 한 줄
              <input value={p.brief.topic} onChange={(e) => setBrief({ topic: e.target.value })} placeholder="예: 산속 지하에 숨겨진 황금 기하학 신전" />
            </label>
            {p.brief.facts.map((f, i) => (
              <label key={i}>
                핵심 사실 {i + 1}
                <input
                  value={f}
                  onChange={(e) => {
                    const facts = [...p.brief.facts] as Project['brief']['facts'];
                    facts[i] = e.target.value;
                    setBrief({ facts });
                  }}
                />
              </label>
            ))}
            <label>
              STYLE BIBLE (프롬프트에 그대로 들어감 · 수정 가능)
              <textarea rows={4} value={p.bible.block} onChange={(e) => setP((x) => ({ ...x, bible: { ...x.bible, block: e.target.value } }))} />
            </label>
            <div className="row">
              <label>
                렌즈(와이드)
                <input value={p.bible.lensWide} onChange={(e) => setP((x) => ({ ...x, bible: { ...x.bible, lensWide: e.target.value } }))} />
              </label>
              <label>
                렌즈(CU·INSERT)
                <input value={p.bible.lensClose} onChange={(e) => setP((x) => ({ ...x, bible: { ...x.bible, lensClose: e.target.value } }))} />
              </label>
            </div>
            <div className="field">
              <b className="sub">👤 캐릭터 시트 (샷마다 같은 외형으로 고정 · 실존 인물 금지)</b>
              {ch.map((c, i) => (
                <div key={i} className="charrow">
                  <div className="row">
                    <input className="w5" value={c.id} onChange={(e) => setChar(i, { id: e.target.value })} title="ID" />
                    <input value={c.name} placeholder="이름(한국어 라벨, 프롬프트 제외)" onChange={(e) => setChar(i, { name: e.target.value })} />
                    <button className="x" onClick={() => confirm(`${c.name || c.id} 삭제?`) && setP((x) => ({ ...x, characters: x.characters.filter((_, j) => j !== i) }))}>
                      ✕
                    </button>
                  </div>
                  <input value={c.look} placeholder="look (외형, 영어)" onChange={(e) => setChar(i, { look: e.target.value })} />
                  <input value={c.wardrobe} placeholder="wardrobe (의상, 영어)" onChange={(e) => setChar(i, { wardrobe: e.target.value })} />
                  <input value={c.signature} placeholder="signature (상징 소품·습관, 영어)" onChange={(e) => setChar(i, { signature: e.target.value })} />
                </div>
              ))}
              <div>
                <button
                  onClick={() =>
                    setP((x) => ({ ...x, characters: [...x.characters, { id: `C${x.characters.length + 1}`, name: '', look: '', wardrobe: '', signature: '' }] }))
                  }
                >
                  + 캐릭터 추가
                </button>
              </div>
            </div>
            <div className="field">
              <b className="sub">📍 월드 시트 (장소를 한 번 정의 → 모든 샷에서 같은 공간으로 고정)</b>
              {lc.map((l, i) => (
                <div key={i} className="charrow">
                  <div className="row">
                    <input className="w5" value={l.id} onChange={(e) => setLoc(i, { id: e.target.value })} title="ID" />
                    <input value={l.name} placeholder="장소 이름(한국어 라벨)" onChange={(e) => setLoc(i, { name: e.target.value })} />
                    <button className="x" onClick={() => confirm(`${l.name || l.id} 삭제?`) && setP((x) => ({ ...x, locations: x.locations.filter((_, j) => j !== i) }))}>
                      ✕
                    </button>
                  </div>
                  <input value={l.place} placeholder="place (어떤 장소, 영어)" onChange={(e) => setLoc(i, { place: e.target.value })} />
                  <input value={l.details} placeholder="details (재질·랜드마크·구조, 영어)" onChange={(e) => setLoc(i, { details: e.target.value })} />
                </div>
              ))}
              <div>
                <button onClick={() => setP((x) => ({ ...x, locations: [...x.locations, { id: `L${x.locations.length + 1}`, name: '', place: '', details: '' }] }))}>
                  + 장소 추가
                </button>
              </div>
            </div>
            <div className="row wrap">
              <button onClick={() => download(fname('json'), JSON.stringify(exportJson(p), null, 2), 'application/json')}>⬇️ JSON 내보내기</button>
              <button onClick={() => fileRef.current?.click()}>📂 JSON 불러오기</button>
              <button onClick={() => download(fname('md'), exportMarkdown(p), 'text/markdown')}>⬇️ Markdown 콘티</button>
              <button onClick={() => download(fname('csv'), buildEditCsv(p), 'text/csv')}>⬇️ 편집 큐시트 CSV</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
                  onImport(e.target.files?.[0]);
                  e.target.value = '';
                }} />
            </div>
          </section>
        )}

        {tab === '콘티' && (
          <section>
            <div className="beats">
              {BEATS.map((b) => (
                <div key={b.key} className="beat">
                  <b>{b.label}</b>
                  <span>
                    {b.from}–{b.to}초
                  </span>
                  <small>{p.shots.filter((s) => s.beat === b.key).map((s) => s.id).join(' ') || '—'}</small>
                </div>
              ))}
            </div>
            <div className={warnings.length ? 'warns' : 'ok'}>
              {warnings.length === 0 ? '✅ 규칙 경고 없음' : warnings.map((w, i) => <span key={i} className="red">{w.message}</span>)}
            </div>
            <div className="row wrap">
              <span className="muted">총 {totalSec}초 / 목표 {p.brief.format === 'shorts' ? '60' : '—'}초 · 피사체/동작/장소/조명은 영어로 쓰면 그대로 프롬프트에 들어갑니다</span>
              <button onClick={() => setP((x) => ({ ...x, shots: [...x.shots, { ...blankShot(x.shots.length), id: nextShotId(x.shots) }] }))}>+ 샷 추가</button>
              <button onClick={() => applyPreset(p.brief.preset)}>↺ 8샷 자동 배치</button>
              <button className="primary" onClick={() => setAiOpen(!aiOpen)}>
                🤖 AI로 콘티 채우기
              </button>
            </div>
            {aiOpen && (
              <div className="card">
                <b className="sub">🤖 AI 시나리오 연결 — 내 Claude·Gemini 구독으로 콘티 초안 받기 (API 키 불필요)</b>
                <div className="muted">① 요청문 복사 → ② Claude/Gemini에 붙여넣기 → ③ 받은 답변 전체를 아래 칸에 붙여넣고 [적용]</div>
                <div className="row wrap">
                  <button onClick={() => copy(buildScenarioRequest(p), 'AI 요청문 복사됨')}>① 요청문 복사</button>
                  <button className="primary" disabled={!aiText.trim()} onClick={applyAi}>
                    ③ 적용
                  </button>
                </div>
                <textarea rows={6} value={aiText} placeholder="② AI 답변을 통째로 붙여넣기 (```json 코드블록·설명 문장이 섞여 있어도 됩니다)" onChange={(e) => setAiText(e.target.value)} />
                {aiIssues.length > 0 && (
                  <div className="muted">
                    🔧 자동 교정 {aiIssues.length}건: {aiIssues.slice(0, 8).join(' · ')}
                    {aiIssues.length > 8 ? ' …' : ''}
                  </div>
                )}
              </div>
            )}
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>샷ID</th>
                    <th>비트</th>
                    <th>목적</th>
                    <th>샷크기</th>
                    <th>앵글</th>
                    <th>카메라무브·속도·끝상태</th>
                    <th>피사체 · 동작 1개</th>
                    <th>장소 · 조명·시간</th>
                    <th>연출 · 캐릭터</th>
                    <th>전환</th>
                    <th>초</th>
                    <th>모델</th>
                    <th>KF</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {p.shots.map((s, i) => (
                    <tr key={i} className={flagged.has(s.id) ? 'flag' : ''}>
                      <td>
                        <input className="w4" value={s.id} onChange={(e) => setShot(i, { id: e.target.value })} />
                      </td>
                      <td>
                        <select value={s.beat} onChange={(e) => setShot(i, { beat: e.target.value as Shot['beat'] })}>
                          {BEATS.map((b) => (
                            <option key={b.key} value={b.key}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select value={s.purposeType} onChange={(e) => setShot(i, { purposeType: e.target.value as Shot['purposeType'] })}>
                          <option>질문</option>
                          <option>답</option>
                        </select>
                        <input value={s.purpose} onChange={(e) => setShot(i, { purpose: e.target.value })} />
                      </td>
                      <td>
                        <Sel v={s.size} opts={SIZES} on={(v) => setShot(i, { size: v })} />
                      </td>
                      <td>
                        <Sel v={s.angle} opts={ANGLES} on={(v) => setShot(i, { angle: v })} />
                      </td>
                      <td>
                        <div className="row">
                          <Sel v={s.move} opts={MOVES} on={(v) => setShot(i, { move: v })} empty="(미지정)" bad={!s.move} />
                          <Sel v={s.speed} opts={SPEEDS} on={(v) => setShot(i, { speed: v })} empty="속도" />
                        </div>
                        <input value={s.endState} placeholder="끝상태 (ending ...)" onChange={(e) => setShot(i, { endState: e.target.value })} />
                      </td>
                      <td>
                        <input value={s.subject} placeholder="subject" onChange={(e) => setShot(i, { subject: e.target.value })} />
                        <input
                          value={s.action}
                          placeholder="ONE action"
                          className={/그리고|\band\b|&/i.test(s.action) ? 'bad' : ''}
                          onChange={(e) => setShot(i, { action: e.target.value })}
                        />
                      </td>
                      <td>
                        <input value={s.setting} placeholder="setting" onChange={(e) => setShot(i, { setting: e.target.value })} />
                        <input value={s.lighting} placeholder="lighting, time" onChange={(e) => setShot(i, { lighting: e.target.value })} />
                      </td>
                      <td>
                        <button
                          className="linkbtn"
                          onClick={() => {
                            setSel(i);
                            setTab('연출');
                          }}
                        >
                          🎥 {s.techniques.map((id) => techById(id)?.ko).filter(Boolean).join(', ') || '기법 선택'}
                          {s.characterId && <small> · 👤{charName(s.characterId) || s.characterId}</small>}
                          {s.locationId && <small> · 📍{locName(s.locationId) || s.locationId}</small>}
                          {s.screenDir && <small> · {s.screenDir}</small>}
                        </button>
                      </td>
                      <td>
                        <Sel v={s.transition} opts={TRANSITIONS} on={(v) => setShot(i, { transition: v })} />
                      </td>
                      <td>
                        <input className="w3" type="number" min={0} step={0.5} value={s.seconds} onChange={(e) => setShot(i, { seconds: Number(e.target.value) })} />
                      </td>
                      <td>
                        <Sel v={s.model} opts={MODELS} on={(v) => setShot(i, { model: v })} />
                      </td>
                      <td>
                        <select value={s.keyframe ? 'Y' : 'N'} onChange={(e) => setShot(i, { keyframe: e.target.value === 'Y' })}>
                          <option>Y</option>
                          <option>N</option>
                        </select>
                      </td>
                      <td>
                        <button className="x" title="삭제" onClick={() => confirm(`${s.id} 삭제?`) && setP((x) => ({ ...x, shots: x.shots.filter((_, j) => j !== i) }))}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === '연출' && p.shots.length > 0 && (() => {
          const i = Math.min(sel, p.shots.length - 1);
          const s = p.shots[i];
          const reco = BEAT_RECO[s.beat];
          return (
            <section>
              <div className="card">
                <div className="row wrap">
                  <b className="sub">🎥 영화 연출 기법 — 샷에 붙이면 프롬프트에 "Cinematography:" 줄로 들어갑니다</b>
                  <button className="primary" onClick={autoDirect}>
                    ✨ 전체 샷 비트별 추천 적용
                  </button>
                </div>
                <div className="chips">
                  {p.shots.map((x, j) => (
                    <button key={j} className={j === i ? 'on' : flagged.has(x.id) ? 'warnchip' : ''} onClick={() => setSel(j)}>
                      {x.id} <small>{beatLabel(x.beat)}·{x.techniques.length}</small>
                    </button>
                  ))}
                </div>
                <div className="muted">
                  {s.id} · {beatLabel(s.beat)} · {s.size} · {s.angle} · 무브 <b>{s.move || '미지정'}</b> — ★ = 이 비트 추천, 회색 = 현재 무브와 안 맞음(콘티에서 무브 변경)
                </div>
                <label className="inline">
                  👤 캐릭터 고정
                  <select value={s.characterId} onChange={(e) => setShot(i, { characterId: e.target.value })}>
                    <option value="">(없음)</option>
                    {ch.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="row wrap">
                  <label className="inline">
                    📍 장소 고정
                    <select value={s.locationId} onChange={(e) => setShot(i, { locationId: e.target.value })}>
                      <option value="">(없음)</option>
                      {lc.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.id} {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inline" title="연속 샷에서 좌→우가 우→좌로 뒤집히면 180도 규칙 경고">
                    ↔ 화면 방향
                    <Sel v={s.screenDir} opts={SCREEN_DIRS} on={(v) => setShot(i, { screenDir: v })} empty="(지정 안 함)" />
                  </label>
                </div>
                <label className="inline">
                  🔊 효과음
                  <input value={s.sfx} placeholder="비우면 장소·동작으로 자동 생성 (영어)" onChange={(e) => setShot(i, { sfx: e.target.value })} />
                </label>
              </div>
              {TECH_CATS.map((cat) => (
                <div key={cat} className="card">
                  <b className="sub">{cat}</b>
                  <div className="techgrid">
                    {TECHNIQUES.filter((t) => t.cat === cat).map((t) => {
                      const on = s.techniques.includes(t.id);
                      const ok = isCompatible(t, s.move);
                      return (
                        <button key={t.id} className={`tech ${on ? 'on' : ''} ${!ok ? 'dim' : ''}`} onClick={() => toggleTech(i, t.id)} title={t.en}>
                          <span>
                            {reco.includes(t.id) && '★ '}
                            {t.ko}
                          </span>
                          <small>{t.use}{t.moves ? ` · 무브: ${t.moves.join('/')}` : ''}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="card">
                <div className="cardhead">
                  <b>미리보기 — {s.id} 영상 프롬프트</b>
                  <button onClick={() => copy(buildVideoPrompt(s, p.bible, p.brief.format, ch, lc), `${s.id} 복사됨`)}>복사</button>
                </div>
                <Code t={buildVideoPrompt(s, p.bible, p.brief.format, ch, lc)} />
              </div>
            </section>
          );
        })()}

        {tab === '프롬프트' && (
          <section>
            <div className="row wrap">
              <button className="primary" onClick={() => copy(allPrompts, `전체 ${p.shots.length}샷 복사됨`)}>
                📋 전체 복사
              </button>
              <span className="muted">{p.bible.name} · {p.brief.format === 'shorts' ? '9:16' : '16:9'}</span>
            </div>
            {ch.map((c) => {
              const t = buildCharacterSheet(c, p.bible);
              return (
                <div key={c.id} className="card">
                  <div className="cardhead">
                    <b>👤 {c.id} {c.name} — 캐릭터 시트 (먼저 이미지로 만들어 참조 이미지로 사용)</b>
                    <button onClick={() => copy(t, `${c.id} 캐릭터 시트 복사됨`)}>복사</button>
                  </div>
                  <Code t={t} kind="img" />
                </div>
              );
            })}
            {lc.map((l) => {
              const t = buildLocationSheet(l, p.bible);
              const tour = buildLocationTour(l, p.bible, p.brief.format);
              return (
                <div key={l.id} className="card">
                  <div className="cardhead">
                    <b>📍 {l.id} {l.name} — 월드 시트 (장소 참조 이미지)</b>
                    <button onClick={() => setOpenTour(openTour === l.id ? null : l.id)}>{openTour === l.id ? '접기' : '월드 카메라 5종'}</button>
                    <button onClick={() => copy(t, `${l.id} 월드 시트 복사됨`)}>복사</button>
                  </div>
                  <Code t={t} kind="img" />
                  {openTour === l.id &&
                    tour.map((v, k) => (
                      <div key={k}>
                        <div className="cardhead">
                          <b>🌐 {l.id}-{k + 1} {v.label}</b>
                          <button onClick={() => copy(v.prompt, `${l.id} ${v.label} 복사됨`)}>복사</button>
                        </div>
                        <Code t={v.prompt} kind="cov" />
                      </div>
                    ))}
                </div>
              );
            })}
            {p.shots.map((s, i) => {
              const v = buildVideoPrompt(s, p.bible, p.brief.format, ch, lc);
              const img = s.keyframe ? buildImagePrompt(s, p.bible, p.brief.format, ch, lc) : '';
              return (
                <div key={i} className={`card ${flagged.has(s.id) ? 'flagcard' : ''}`}>
                  <div className="cardhead">
                    <b>
                      {s.id} · {beatLabel(s.beat)} · {s.size} · {s.seconds}s · {s.model}
                    </b>
                    {flagged.has(s.id) && <span className="red">규칙 경고</span>}
                    <button onClick={() => setOpenCov(openCov === i ? null : i)}>{openCov === i ? '접기' : '멀티앵글'}</button>
                    <button onClick={() => copy(v, `${s.id} 복사됨`)}>복사</button>
                  </div>
                  <Code t={v} />
                  {openCov === i &&
                    buildCoverage(s, p.bible, p.brief.format, ch, lc).map((cv, k) => (
                      <div key={k}>
                        <div className="cardhead">
                          <b>🎞 {s.id}-{String.fromCharCode(65 + k)} {cv.label}</b>
                          <button onClick={() => copy(cv.prompt, `${s.id} ${cv.label} 복사됨`)}>복사</button>
                        </div>
                        <Code t={cv.prompt} kind="cov" />
                      </div>
                    ))}
                  {img && (
                    <>
                      <div className="cardhead">
                        <b>🖼 키프레임 (Nano Banana)</b>
                        <button onClick={() => copy(img, `${s.id} 키프레임 복사됨`)}>복사</button>
                      </div>
                      <Code t={img} kind="img" />
                    </>
                  )}
                </div>
              );
            })}
            <div className="card">
              <b className="sub">🔊 오디오 큐시트 — 배경음악(Lyria·Suno) + 샷별 효과음</b>
              <div className="cardhead">
                <b className="muted">비트별 음악 구조 + 타임코드</b>
                <button onClick={() => copy(buildAudioCue(p), '오디오 큐시트 복사됨')}>복사</button>
              </div>
              <Code t={buildAudioCue(p)} kind="cov" />
            </div>
            <div className="card">
              <b className="sub">🔀 전환 브리지 — 매치컷·빛변화·암전 사이를 잇는 2초 연결 샷 (시작·끝 프레임 모드용)</b>
              {p.shots.slice(0, -1).map((a, k) => {
                const b = p.shots[k + 1];
                const t = buildBridge(a, b, p.bible, p.brief.format);
                return t ? (
                  <div key={k}>
                    <div className="cardhead">
                      <b>
                        {a.id} → {b.id} · {a.transition}
                      </b>
                      <button onClick={() => copy(t, `${a.id}→${b.id} 브리지 복사됨`)}>복사</button>
                    </div>
                    <Code t={t} kind="cov" />
                  </div>
                ) : null;
              })}
              <div className="muted">하드컷 구간은 브리지가 필요 없어 생략됩니다.</div>
            </div>
          </section>
        )}

        {tab === '기록·크레딧' && (
          <section>
            <div className="card">
              <div className="row wrap">
                <label>
                  시작 크레딧
                  <input type="number" value={p.credit.start} onChange={(e) => setP((x) => ({ ...x, credit: { ...x.credit, start: Number(e.target.value) } }))} />
                </label>
                <label>
                  이전 편 누적 사용
                  <input type="number" value={p.credit.pastUsed} onChange={(e) => setP((x) => ({ ...x, credit: { ...x.credit, pastUsed: Number(e.target.value) } }))} />
                </label>
                <label>
                  이전 완성 편수
                  <input type="number" value={p.credit.pastEpisodes} onChange={(e) => setP((x) => ({ ...x, credit: { ...x.credit, pastEpisodes: Number(e.target.value) } }))} />
                </label>
              </div>
              <div className="bar">
                <div style={{ width: `${pct}%` }} className={pct < 20 ? 'low' : ''} />
              </div>
              <div className="stats">
                <div>
                  <small>잔량</small>
                  <b className={cs.remaining < 0 ? 'neg' : ''}>{cs.remaining.toLocaleString()}</b>
                </div>
                <div>
                  <small>이번 편 사용</small>
                  <b>{cs.currentUsed.toLocaleString()}</b>
                </div>
                <div>
                  <small>1편 평균 단가</small>
                  <b>{cs.avgPerEpisode ? Math.round(cs.avgPerEpisode).toLocaleString() : '—'}</b>
                </div>
                <div>
                  <small>남은 크레딧으로 가능</small>
                  <b>{cs.possibleEpisodes === null ? '—' : `${cs.possibleEpisodes}편`}</b>
                </div>
              </div>
            </div>
            {p.shots.map((s, i) => {
              const avg = qcAverage(s.qc);
              const regen = needsRegen(s.qc);
              return (
                <div key={i} className={`card rec ${regen ? 'flagcard' : ''}`}>
                  <div className="cardhead">
                    <b>
                      {s.id} · {beatLabel(s.beat)} · {s.model}
                    </b>
                    {regen && <span className="red">재생성 필요 (QC {avg!.toFixed(1)})</span>}
                    {!regen && avg !== null && <span className="green">QC {avg.toFixed(1)}</span>}
                  </div>
                  <div className="row wrap">
                    <Sel v={s.status} opts={STATUSES} on={(v) => setShot(i, { status: v })} />
                    <label className="inline">
                      사용 크레딧
                      <input className="w5" type="number" min={0} value={s.credits} onChange={(e) => setShot(i, { credits: Number(e.target.value) })} />
                    </label>
                  </div>
                  <div className="chips">
                    {DEFECTS.map((d) => (
                      <button key={d.id} className={s.defects.includes(d.id) ? 'on' : ''} onClick={() => toggleDefect(i, d.id)}>
                        {d.ko}
                      </button>
                    ))}
                  </div>
                  {(s.defects.length > 0 || regen) && (() => {
                    const rp = buildRegenPrompt(buildVideoPrompt(s, p.bible, p.brief.format, ch, lc), s);
                    return (
                      <>
                        <div className="cardhead">
                          <b className="muted">🔁 재생성 보정 프롬프트 {s.defects.length === 0 && '— 위에서 결함을 골라야 보정 줄이 붙습니다'}</b>
                          <button onClick={() => copy(rp, `${s.id} 보정 프롬프트 복사됨`)}>복사</button>
                        </div>
                        <Code t={rp} kind="cov" />
                      </>
                    );
                  })()}
                  <div className="qc">
                    {QC_LABELS.map((l, q) => (
                      <label key={l}>
                        {l}
                        <select
                          value={s.qc[q]}
                          onChange={(e) => {
                            const qc = [...s.qc] as Shot['qc'];
                            qc[q] = Number(e.target.value);
                            setShot(i, { qc });
                          }}
                        >
                          <option value={0}>-</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>
      <footer className="muted">서버·API 키 없음 · 이 브라우저(localStorage)에만 저장됩니다 · 백업은 JSON 내보내기</footer>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// 프롬프트 블록: 줄 머리("Setting:" 등)를 코드 에디터처럼 색 구분
function Code({ t, kind }: { t: string; kind?: 'img' | 'cov' }) {
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

function Sel<T extends string>({ v, opts, on, empty, bad }: { v: T; opts: readonly T[]; on: (v: T) => void; empty?: string; bad?: boolean }) {
  return (
    <select value={v} className={bad ? 'bad' : ''} onChange={(e) => on(e.target.value as T)}>
      {opts.map((o) => (
        <option key={o} value={o}>
          {o || empty || '-'}
        </option>
      ))}
    </select>
  );
}
