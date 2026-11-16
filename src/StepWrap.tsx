import { useRef } from 'react';
import { MODELS, beatLabel, buildBridge, exportJson, exportMarkdown, sanitizeProject, shotImagePrompt, shotPrompt } from './lib';
import { buildAudioCue, buildEditCsv, safeFileName } from './director';
import { DEFAULT_COSTS, buildNarrationScript, buildSrt, loadStore, narrationTotal, progress, projectTitle, walletSummary } from './assist';
import { Field, Fold, PromptBox, download, numIn, type Ctx } from './ui';

export default function StepWrap({ c }: { c: Ctx }) {
  const { p, store } = c;
  const fileRef = useRef<HTMLInputElement>(null);
  const pr = progress(p);
  const w = walletSummary(store, p);
  const total = p.shots.filter((s) => s.status !== '폐기').reduce((a, s) => a + (Number(s.seconds) || 0), 0);
  const script = buildNarrationScript(p);
  const fname = (ext: string) => safeFileName(p.brief.series, ext, new Date());
  const pct = Math.max(0, Math.min(100, store.wallet.start > 0 ? (w.remaining / store.wallet.start) * 100 : 0));
  const setWallet = (patch: Partial<typeof store.wallet>) => c.setStore((s) => ({ ...s, wallet: { ...s.wallet, ...patch } }));
  const all = p.shots
    .map((s) => {
      const v = `### ${s.id} (${beatLabel(s.beat)}, ${s.seconds}s, ${s.model})\n${shotPrompt(p, s)}`;
      return s.keyframe ? `### ${s.id} 키프레임(Nano Banana)\n${shotImagePrompt(p, s)}\n\n${v}` : v;
    })
    .join('\n\n');
  const bridges = p.shots.slice(0, -1).map((a, k) => ({ a, b: p.shots[k + 1], t: buildBridge(a, p.shots[k + 1], p.bible, p.brief.format) })).filter((x) => x.t);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const text = await f.text();
      const d = JSON.parse(text);
      if (Array.isArray(d?.projects)) {
        if (!confirm(`전체 백업 파일입니다 (${d.projects.length}편). 지금 보관함 전체를 이 백업으로 바꿀까요?`)) return;
        const st = loadStore(text, null);
        c.commit('전체 백업 복원', () => st);
      } else {
        const q = { ...sanitizeProject(d), id: `p${Date.now().toString(36)}`, updatedAt: Date.now() };
        c.commit(`'${projectTitle(q)}' 불러오기`, (s) => ({ ...s, projects: [...s.projects, q], activeId: q.id }));
        c.go('board');
      }
    } catch (e) {
      alert('불러오기 실패: ' + (e as Error).message);
    }
  };

  return (
    <section>
      <div className="card">
        <b className="sub">📦 {projectTitle(p)}</b>
        <div className="stats">
          <div><small>채택</small><b>{pr.adopted}/{pr.total}</b></div>
          <div><small>영상 길이</small><b>{total}s</b></div>
          <div><small>나레이션</small><b>{narrationTotal(p).toFixed(0)}s</b></div>
          <div><small>이번 편 사용</small><b>{p.shots.reduce((a, s) => a + s.credits, 0)}</b></div>
        </div>
        {pr.done < pr.total && <div className="muted">아직 {pr.total - pr.done}샷이 남았습니다 — <button className="link" onClick={() => c.go('shoot')}>제작으로 돌아가기</button></div>}
      </div>

      <div className="card">
        <b className="sub">🎙 나레이션 대본 <small className="muted">— TTS·녹음용</small></b>
        {script ? (
          <>
            <pre className="ko">{script}</pre>
            <div className="row wrap">
              <button className="primary" onClick={() => c.copy(script, '대본 복사됨')}>📋 대본 복사</button>
              <button onClick={() => download(fname('srt'), buildSrt(p), 'application/x-subrip')}>⬇️ 자막 파일 (SRT)</button>
            </div>
          </>
        ) : (
          <div className="muted">콘티의 각 샷에 나레이션을 적으면 여기에 대본과 자막 파일이 만들어집니다.</div>
        )}
      </div>

      <div className="card">
        <b className="sub">⬇️ 편집용 파일</b>
        <div className="row wrap">
          <button onClick={() => download(fname('csv'), buildEditCsv(p), 'text/csv')}>편집 큐시트 (CSV·엑셀)</button>
          <button onClick={() => download(fname('md'), exportMarkdown(p), 'text/markdown')}>콘티 문서 (Markdown)</button>
          <button onClick={() => c.copy(all, `전체 ${p.shots.length}샷 프롬프트 복사됨`)}>📋 전체 프롬프트 복사</button>
        </div>
      </div>

      <Fold title="🔊 오디오 큐시트" badge={<small className="muted">배경음악 프롬프트(Lyria·Suno) + 샷별 효과음</small>}>
        <PromptBox c={c} kind="cov" title="음악 구조 + 타임코드" text={buildAudioCue(p)} label="오디오 큐시트 복사됨" />
      </Fold>

      <Fold title="🔀 전환 브리지" badge={<small className="muted">{bridges.length}개 · 매치컷·빛변화·암전을 잇는 2초 연결 샷</small>}>
        {bridges.length === 0 && <div className="muted">전환이 모두 하드컷이라 연결 샷이 필요 없습니다.</div>}
        {bridges.map((x, k) => <PromptBox key={k} c={c} kind="cov" title={`${x.a.id} → ${x.b.id} · ${x.a.transition}`} text={x.t!} />)}
      </Fold>

      <div className="card">
        <b className="sub">💳 크레딧 지갑 <small className="muted">— 모든 편 합산</small></b>
        <div className="bar"><div style={{ width: `${pct}%` }} className={pct < 20 ? 'low' : ''} /></div>
        <div className="stats">
          <div><small>잔량</small><b className={w.remaining < 0 ? 'neg' : ''}>{w.remaining.toLocaleString()}</b></div>
          <div><small>1편 평균</small><b>{w.avgPerEpisode ? Math.round(w.avgPerEpisode).toLocaleString() : '—'}</b></div>
          <div><small>더 만들 수 있는 편</small><b>{w.possibleEpisodes === null ? '—' : `${w.possibleEpisodes}편`}</b></div>
          <div><small>이번 편 남은 비용(예상)</small><b className={w.afterPlan < 0 ? 'neg' : ''}>{w.planLikely}</b></div>
        </div>
        <div className="muted">
          남은 샷을 한 번에 성공하면 {w.planMin}cr.
          {w.hasRetryData ? ` 내 기록상 채택 1컷당 평균 ${w.retryRate.toFixed(1)}회 생성 → 예상 ${w.planLikely}cr.` : ' 채택 기록이 3컷 이상 쌓이면 내 재생성률을 반영해 예상합니다.'}
          {w.afterPlan < 0 && <b className="neg"> 크레딧이 {-w.afterPlan} 부족합니다 — 콘티에서 모델 배분을 '절약'으로 바꾸세요.</b>}
        </div>
        <div className="grid4">
          <Field label="이번 달 시작 크레딧"><input type="number" min={0} value={store.wallet.start} onChange={(e) => setWallet({ start: numIn(e.target.value) })} /></Field>
          <Field label="앱 밖에서 쓴 크레딧" hint="이미지 생성·테스트 등"><input type="number" min={0} value={store.wallet.otherUsed} onChange={(e) => setWallet({ otherUsed: numIn(e.target.value) })} /></Field>
        </div>
        <Fold title="모델별 1회 생성 비용" badge={<small className="warn">기본값은 추정치 — Flow에서 실제 차감값 확인 후 수정</small>}>
          <div className="grid4">
            {MODELS.map((m) => (
              <Field key={m} label={m}>
                <input type="number" min={0} value={store.wallet.costs[m]} onChange={(e) => setWallet({ costs: { ...store.wallet.costs, [m]: numIn(e.target.value) } })} />
              </Field>
            ))}
          </div>
          <button className="link" onClick={() => setWallet({ costs: { ...DEFAULT_COSTS } })}>기본값으로</button>
        </Fold>
      </div>

      <div className="card">
        <b className="sub">🗄 백업 · 가져오기</b>
        <div className="row wrap">
          <button onClick={() => download(fname('json'), JSON.stringify(exportJson(p), null, 2), 'application/json')}>이 편 내보내기 (JSON)</button>
          <button onClick={() => download(safeFileName('backup-all', 'json', new Date()), JSON.stringify(store, null, 2), 'application/json')}>전체 백업 (모든 편 + 지갑)</button>
          <button onClick={() => fileRef.current?.click()}>📂 JSON 불러오기</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <div className="muted">데이터는 이 브라우저에만 저장됩니다. PC·태블릿을 오갈 때는 전체 백업 파일을 옮겨서 불러오세요. 편 파일을 불러오면 지금 편을 덮어쓰지 않고 보관함에 새 편으로 추가됩니다.</div>
      </div>
    </section>
  );
}
