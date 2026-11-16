import { useState } from 'react';
import { BIBLES, CHARACTERS, LOCATIONS, defaultShots, type PresetKey, type Project } from './lib';
import { buildScenarioRequest, parseScenarioResponse } from './director';
import { applyTranslation, buildTranslateRequest, koreanFields, nextAssetId, removeAsset } from './assist';
import { Field, Fold, type Ctx } from './ui';

export default function StepPlan({ c }: { c: Ctx }) {
  const { p, setP } = c;
  const [ai, setAi] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [tr, setTr] = useState('');
  const b = p.brief;
  const setBrief = (patch: Partial<Project['brief']>) => setP((x) => ({ ...x, brief: { ...x.brief, ...patch } }));
  const setBible = (patch: Partial<Project['bible']>) => setP((x) => ({ ...x, bible: { ...x.bible, ...patch } }));
  const ko = koreanFields(p);
  const koCount = Object.keys(ko).length;

  const applyPreset = (k: PresetKey) => {
    if (k === b.preset && !confirm('같은 프리셋을 다시 적용하면 샷·캐릭터·장소가 기본값으로 돌아갑니다. 진행할까요?')) return;
    c.commit(`프리셋 ${BIBLES[k].name} 적용`, (s) => ({
      ...s,
      projects: s.projects.map((x) =>
        x.id !== p.id
          ? x
          : { ...x, brief: { ...x.brief, preset: k }, bible: { ...BIBLES[k] }, characters: CHARACTERS[k].map((y) => ({ ...y })), locations: LOCATIONS[k].map((y) => ({ ...y })), shots: defaultShots(k) },
      ),
    }));
  };

  const applyAi = () => {
    try {
      const r = parseScenarioResponse(ai, p);
      c.commit(`AI 콘티 ${r.shots.length}샷 적용`, (s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? { ...x, shots: r.shots } : x)) }));
      setIssues(r.issues);
      setAi('');
      c.go('board');
    } catch (e) {
      alert('적용 실패: ' + (e as Error).message + '\n\nAI 답변 전체를 다시 복사해 붙여넣어 보세요.');
    }
  };

  const applyTr = () => {
    try {
      const r = applyTranslation(p, tr);
      c.commit(`영어 변환 ${r.applied}칸 적용`, (s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? r.project : x)) }));
      setTr('');
    } catch (e) {
      alert('적용 실패: ' + (e as Error).message);
    }
  };

  return (
    <section>
      <div className="card">
        <b className="sub">① 이번 편 정보</b>
        <div className="grid2">
          <Field label="시리즈명">
            <input value={b.series} onChange={(e) => setBrief({ series: e.target.value })} placeholder="예: 잊힌 신전 미스터리" />
          </Field>
          <Field label="편 제목">
            <input value={b.episode} onChange={(e) => setBrief({ episode: e.target.value })} placeholder="예: 1편 황금 방의 비밀" />
          </Field>
          <Field label="주제 한 줄 (가장 중요)" wide>
            <input className={b.topic.trim() ? '' : 'need'} value={b.topic} onChange={(e) => setBrief({ topic: e.target.value })} placeholder="예: 산속 지하에서 발견된 황금 기하학 신전, 누가 왜 만들었나" />
          </Field>
          {b.facts.map((f, i) => (
            <Field key={i} label={`핵심 사실 ${i + 1}`} wide={i === 2}>
              <input
                value={f}
                onChange={(e) => {
                  const facts = [...b.facts] as Project['brief']['facts'];
                  facts[i] = e.target.value;
                  setBrief({ facts });
                }}
                placeholder={i === 0 ? '영상에 꼭 들어갈 사실' : ''}
              />
            </Field>
          ))}
          <Field label="채널">
            <input value={b.channel} onChange={(e) => setBrief({ channel: e.target.value })} placeholder="예: 경제적 자유구역" />
          </Field>
          <div className="f">
            <span className="fl">포맷</span>
            <div className="seg">
              <button className={b.format === 'shorts' ? 'on' : ''} onClick={() => setBrief({ format: 'shorts' })}>쇼츠 60초 9:16</button>
              <button className={b.format === 'long' ? 'on' : ''} onClick={() => setBrief({ format: 'long' })}>롱폼 16:9</button>
            </div>
          </div>
          <div className="f wide">
            <span className="fl">장르 프리셋 — 누르면 스타일·8샷·캐릭터·장소가 한 번에 세팅됩니다</span>
            <div className="seg">
              {(['A', 'B', 'C'] as PresetKey[]).map((k) => (
                <button key={k} className={b.preset === k ? 'on' : ''} onClick={() => applyPreset(k)}>{BIBLES[k].name}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card accent">
        <b className="sub">② 🤖 AI로 콘티 만들기 <small className="muted">— 내 Claude·Gemini 구독 사용, API 키 불필요</small></b>
        <ol className="steps">
          <li>
            <button className="primary" onClick={() => c.copy(buildScenarioRequest(p), 'AI 요청문 복사됨 — Claude/Gemini에 붙여넣으세요')}>요청문 복사</button>
            <span className="muted">위에 적은 주제·사실·캐릭터·규칙이 모두 들어갑니다</span>
          </li>
          <li><span>Claude 또는 Gemini 새 대화에 붙여넣고 답변을 받습니다</span></li>
          <li className="col">
            <textarea rows={4} value={ai} placeholder="받은 답변을 통째로 붙여넣기 (설명 문장이 섞여 있어도 됩니다)" onChange={(e) => setAi(e.target.value)} />
            <button className="primary" disabled={!ai.trim()} onClick={applyAi}>콘티에 적용 → 콘티 화면으로</button>
          </li>
        </ol>
        {issues.length > 0 && <div className="muted">🔧 AI 답변에서 자동 교정 {issues.length}건: {issues.slice(0, 6).join(' · ')}{issues.length > 6 ? ' …' : ''}</div>}
        <div className="muted">AI 없이 시작하려면 프리셋 기본 8샷이 이미 들어 있으니 바로 <button className="link" onClick={() => c.go('board')}>콘티</button>로 가서 고치면 됩니다.</div>
      </div>

      {koCount > 0 && (
        <div className="card warnbox">
          <b className="sub">🌐 한글이 남은 프롬프트 칸 {koCount}개 → 영어로 바꾸기</b>
          <div className="muted">영상 AI는 영어 지시를 훨씬 잘 따릅니다. 피사체·동작·장소·조명 등에 한글이 있으면 여기서 한 번에 바꾸세요. (나레이션은 한국어 그대로 둡니다)</div>
          <div className="row wrap">
            <button onClick={() => c.copy(buildTranslateRequest(p), '번역 요청문 복사됨')}>① 번역 요청문 복사</button>
            <button className="primary" disabled={!tr.trim()} onClick={applyTr}>③ 적용</button>
          </div>
          <textarea rows={3} value={tr} placeholder="② AI 답변 붙여넣기" onChange={(e) => setTr(e.target.value)} />
        </div>
      )}

      <Fold title="🎨 스타일 바이블 · 렌즈 · 소리" badge={<small className="muted">{p.bible.name}</small>}>
        <Field label="STYLE BIBLE — 모든 샷 프롬프트에 그대로 들어가는 스타일 문장 (영어)">
          <textarea rows={4} value={p.bible.block} onChange={(e) => setBible({ block: e.target.value })} />
        </Field>
        <div className="grid2">
          <Field label="렌즈 (와이드 샷)"><input value={p.bible.lensWide} onChange={(e) => setBible({ lensWide: e.target.value })} /></Field>
          <Field label="렌즈 (CU·INSERT)"><input value={p.bible.lensClose} onChange={(e) => setBible({ lensClose: e.target.value })} /></Field>
          <Field label="렌더 스타일"><input value={p.bible.render} onChange={(e) => setBible({ render: e.target.value })} /></Field>
          <label className="check">
            <input type="checkbox" checked={b.audio} onChange={(e) => setBrief({ audio: e.target.checked })} />
            <span>영상 프롬프트에 소리 지시(Audio 줄) 포함 — 효과음만, 대사·음악 없음</span>
          </label>
        </div>
      </Fold>

      <Fold title="👤 캐릭터" badge={<small className="muted">{p.characters.length}명 · 샷마다 같은 외형으로 고정</small>}>
        {p.characters.map((ch, i) => {
          const set = (patch: Partial<(typeof p.characters)[number]>) => setP((x) => ({ ...x, characters: x.characters.map((y, j) => (j === i ? { ...y, ...patch } : y)) }));
          return (
            <div key={ch.id} className="asset">
              <div className="row">
                <span className="idtag">{ch.id}</span>
                <input value={ch.name} placeholder="이름 (한국어, 메모용)" onChange={(e) => set({ name: e.target.value })} />
                <button className="x" title="삭제" onClick={() => c.commit(`${ch.id} 삭제`, (s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? removeAsset(x, 'char', ch.id) : x)) }))}>✕</button>
              </div>
              <input value={ch.look} placeholder="look — 외형 (영어)" onChange={(e) => set({ look: e.target.value, ready: false })} />
              <input value={ch.wardrobe} placeholder="wardrobe — 의상 (영어)" onChange={(e) => set({ wardrobe: e.target.value, ready: false })} />
              <input value={ch.signature} placeholder="signature — 상징 소품·습관 (영어)" onChange={(e) => set({ signature: e.target.value, ready: false })} />
            </div>
          );
        })}
        <button onClick={() => setP((x) => ({ ...x, characters: [...x.characters, { id: nextAssetId(x.characters.map((y) => y.id), 'C'), name: '', look: '', wardrobe: '', signature: '' }] }))}>+ 캐릭터 추가</button>
        <div className="muted">실존 인물은 넣지 마세요. 가상의 인물·동물만.</div>
      </Fold>

      <Fold title="📍 장소(월드)" badge={<small className="muted">{p.locations.length}곳 · 샷마다 같은 공간으로 고정</small>}>
        {p.locations.map((l, i) => {
          const set = (patch: Partial<(typeof p.locations)[number]>) => setP((x) => ({ ...x, locations: x.locations.map((y, j) => (j === i ? { ...y, ...patch } : y)) }));
          return (
            <div key={l.id} className="asset">
              <div className="row">
                <span className="idtag">{l.id}</span>
                <input value={l.name} placeholder="장소 이름 (한국어, 메모용)" onChange={(e) => set({ name: e.target.value })} />
                <button className="x" title="삭제" onClick={() => c.commit(`${l.id} 삭제`, (s) => ({ ...s, projects: s.projects.map((x) => (x.id === p.id ? removeAsset(x, 'loc', l.id) : x)) }))}>✕</button>
              </div>
              <input value={l.place} placeholder="place — 어떤 장소 (영어)" onChange={(e) => set({ place: e.target.value, ready: false })} />
              <input value={l.details} placeholder="details — 재질·랜드마크·구조 (영어)" onChange={(e) => set({ details: e.target.value, ready: false })} />
            </div>
          );
        })}
        <button onClick={() => setP((x) => ({ ...x, locations: [...x.locations, { id: nextAssetId(x.locations.map((y) => y.id), 'L'), name: '', place: '', details: '' }] }))}>+ 장소 추가</button>
      </Fold>
    </section>
  );
}
