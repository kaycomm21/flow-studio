import { BIBLES, type PresetKey } from './lib';
import { blankProject, duplicateProject, nextEpisode, progress, projectTitle, projectUsed } from './assist';
import type { Ctx } from './ui';

export default function Library({ c, close }: { c: Ctx; close: () => void }) {
  const { store, p } = c;
  const add = (label: string, q: ReturnType<typeof blankProject>) => {
    c.commit(label, (s) => ({ ...s, projects: [...s.projects, q], activeId: q.id }));
    c.go('plan');
    close();
  };
  const sorted = [...store.projects].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className="card lib">
      <div className="cardhead">
        <b>📁 보관함 — {store.projects.length}편</b>
        <button className="x" onClick={close}>닫기</button>
      </div>
      <div className="row wrap">
        <button className="primary" onClick={() => add('다음 편 만들기', nextEpisode(p))} title="지금 편의 스타일·캐릭터·장소·샷 구성을 그대로 가져옵니다">➕ 다음 편 (지금 편 스타일 유지)</button>
        {(['A', 'B', 'C'] as PresetKey[]).map((k) => (
          <button key={k} onClick={() => add(`새 편 (${BIBLES[k].name})`, blankProject(k))}>새 편: {BIBLES[k].name}</button>
        ))}
      </div>
      {sorted.map((q) => {
        const pr = progress(q);
        return (
          <div key={q.id} className={`librow ${q.id === p.id ? 'cur' : ''}`}>
            <button className="libmain" onClick={() => { c.setStore((s) => ({ ...s, activeId: q.id })); c.setFocus(0); c.setBoardOpen(null); close(); }}>
              <b>{projectTitle(q)}</b>
              <small>{BIBLES[q.brief.preset].name} · {q.brief.format === 'shorts' ? '쇼츠' : '롱폼'} · 채택 {pr.adopted}/{pr.total} · {projectUsed(q)}cr · {new Date(q.updatedAt).toLocaleDateString('ko-KR')}</small>
            </button>
            <button onClick={() => c.commit('편 복제', (s) => ({ ...s, projects: [...s.projects, { ...duplicateProject(q), brief: { ...q.brief, episode: `${q.brief.episode} (복사본)`.trim() } }] }))}>복제</button>
            <button
              className="x"
              disabled={store.projects.length <= 1}
              onClick={() =>
                confirm(`'${projectTitle(q)}' 편을 삭제할까요?`) &&
                c.commit('편 삭제', (s) => {
                  const projects = s.projects.filter((x) => x.id !== q.id);
                  return { ...s, projects, activeId: s.activeId === q.id ? projects[0].id : s.activeId };
                })
              }
            >
              삭제
            </button>
          </div>
        );
      })}
    </div>
  );
}
