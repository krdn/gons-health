import type { DashboardModel, SectionHelp } from './types'

// 모델 → 완전한 HTML 문서. 순수 함수. 기존 dashboard.html 디자인 포팅.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ? 토글: 섹션 제목 옆 버튼. 클릭 시 고정+동적 도움말 펼침.
function helpToggle(id: string, help?: SectionHelp): string {
  if (!help) return ''
  const fixed = escapeHtml(help.fixed)
  const dynamic = help.dynamic ? escapeHtml(help.dynamic) : ''
  return `<button class="help-toggle" data-help="${id}" aria-label="도움말">?</button>
    <div class="help-body" id="help-${id}" hidden>
      <p>${fixed}</p>
      ${dynamic ? `<p class="help-dynamic">▸ ${dynamic}</p>` : ''}
    </div>`
}

function renderStats(model: DashboardModel): string {
  return model.stats
    .map(
      (s) => `<div class="stat ${s.tone}"><span class="spark">${s.spark}</span>
        <div class="num">${escapeHtml(s.num)}</div>
        <div class="lbl">${escapeHtml(s.label)}</div></div>`,
    )
    .join('\n')
}

function renderMilestones(model: DashboardModel): string {
  return model.milestones
    .map((m) => {
      const stateLabel = m.state === 'done' ? '완료' : m.state === 'in_progress' ? '진행 중' : '예정'
      const detail = m.detail ? ` · ${escapeHtml(m.detail)}` : ''
      return `<div class="ms ${m.state}">
        <div class="ms-head"><span class="ms-title">${escapeHtml(m.title)}</span>
          <span class="ms-state">${stateLabel}${detail}</span></div>
        <div class="ms-bar"><div class="ms-fill" style="width:${m.pct}%"></div></div>
      </div>`
    })
    .join('\n')
}

function renderChips(model: DashboardModel): string {
  return model.kb.chips
    .map((c) => {
      const cls = c.verified ? 'chip v' : 'chip p'
      const src = c.src ? `<span class="src">${escapeHtml(c.src)}</span>` : ''
      return `<span class="${cls}"><span class="dot"></span>${escapeHtml(c.label)}
        <span class="ev">${escapeHtml(c.evidence)}</span>${src}</span>`
    })
    .join('\n')
}

function renderActions(model: DashboardModel): string {
  return model.nextActions
    .map((a) => {
      const prio = a.priority === 'high' ? ' prio' : ''
      return `<div class="act${prio}"><span class="rank">${a.rank}</span>
        <div><div class="a-title">${escapeHtml(a.title)}</div>
        <div class="a-why">${escapeHtml(a.why)}</div></div></div>`
    })
    .join('\n')
}

function renderConstraints(model: DashboardModel): string {
  return model.constraints
    .map(
      (c) => `<div class="con"><div class="c-icon">${c.icon}</div>
        <div class="c-title">${escapeHtml(c.title)}</div>
        <div class="c-body">${escapeHtml(c.body)}</div></div>`,
    )
    .join('\n')
}

function renderFlow(model: DashboardModel): string {
  if (model.flow.length === 0) return ''
  const nodes = model.flow
    .map((n, i) => {
      const cls = n.gate ? 'node gate-mark' : 'node'
      const arrow = i < model.flow.length - 1 ? '<span class="arr">→</span>' : ''
      return `<span class="${cls}">${escapeHtml(n.label)}</span>${arrow}`
    })
    .join('\n')
  return `<div class="flow-row">${nodes}
    <span class="arr flow-note">하나라도 무너지면 환각 경고가 샌다</span></div>`
}

function renderGates(model: DashboardModel): string {
  return model.gates
    .map(
      (g) => `<div class="gate">
        <div class="g-head"><span class="g-num">${escapeHtml(g.num)}</span>
          <span class="g-name">${escapeHtml(g.name)}</span></div>
        <div class="g-file">${escapeHtml(g.file)}</div>
        <div class="g-body">${escapeHtml(g.body)}</div></div>`,
    )
    .join('\n')
}

function renderArtifacts(model: DashboardModel): string {
  return model.artifacts
    .map(
      (a) => `<div class="art">
        <div class="a-name">${escapeHtml(a.name)}</div>
        <div class="a-cmd">${escapeHtml(a.cmd)}</div>
        <div class="a-out">${escapeHtml(a.out)}</div>
        <div class="a-use">${escapeHtml(a.use)}</div></div>`,
    )
    .join('\n')
}

function renderCommits(model: DashboardModel): string {
  if (model.recentCommits.length === 0) {
    return '<div class="empty">git 이력 없음</div>'
  }
  return model.recentCommits
    .map(
      (c) => `<div class="commit"><code>${escapeHtml(c.sha)}</code>
        <span>${escapeHtml(c.subject)}</span></div>`,
    )
    .join('\n')
}

function renderGhIssues(model: DashboardModel): string {
  if (!model.ghIssues.ok) {
    return `<div class="empty">GitHub 이슈 연계 안 됨 (${escapeHtml(model.ghIssues.reason)})</div>`
  }
  if (model.ghIssues.value.length === 0) {
    return '<div class="empty">열린 GitHub 이슈 없음</div>'
  }
  return model.ghIssues.value
    .map(
      (i) => `<div class="issue"><span class="issue-num">#${i.number}</span>
        <a href="${escapeHtml(i.url)}">${escapeHtml(i.title)}</a></div>`,
    )
    .join('\n')
}

const STYLE = `
  :root {
    --bg: oklch(16% 0.01 260); --panel: oklch(21% 0.015 260);
    --panel-2: oklch(25% 0.02 260); --line: oklch(32% 0.02 260);
    --text: oklch(94% 0.01 260); --muted: oklch(68% 0.015 260);
    --ok: oklch(72% 0.16 150); --pending: oklch(76% 0.14 75);
    --danger: oklch(68% 0.2 25); --accent: oklch(72% 0.15 250);
    --shadow: 0 1px 0 oklch(100% 0 0 / 0.04) inset, 0 8px 24px oklch(0% 0 0 / 0.35);
    --radius: 14px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; line-height: 1.45; }
  a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 22px 80px; }
  header { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
    border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 22px; }
  header h1 { font-size: 22px; margin: 0; letter-spacing: -0.02em; }
  header .tag { font-size: 12px; color: var(--muted); background: var(--panel-2);
    border: 1px solid var(--line); padding: 3px 9px; border-radius: 999px; }
  header .one-line { flex-basis: 100%; color: var(--muted); font-size: 14px; margin-top: 4px; }
  .strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
  .stat { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 16px 16px 14px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
  .stat .num { font-size: 30px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; }
  .stat .lbl { font-size: 12px; color: var(--muted); margin-top: 7px; }
  .stat.good .num { color: var(--ok); } .stat.warn .num { color: var(--pending); }
  .stat .spark { position: absolute; right: 12px; top: 12px; font-size: 16px; opacity: .55; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted);
    margin: 30px 0 12px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .gates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .gate { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 16px; box-shadow: var(--shadow); }
  .gate .g-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .gate .g-num { font-size: 11px; font-weight: 700; color: var(--bg); background: var(--accent);
    width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; flex: none; }
  .gate .g-name { font-weight: 600; font-size: 15px; }
  .gate .g-file { font-size: 11px; color: var(--muted); font-family: ui-monospace, Menlo, monospace; }
  .gate .g-body { font-size: 13px; color: var(--muted); margin-top: 8px; }
  .flow-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 14px 16px; box-shadow: var(--shadow); font-size: 13px; margin-bottom: 14px; }
  .flow-row .node { background: var(--panel-2); border: 1px solid var(--line);
    padding: 7px 11px; border-radius: 8px; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  .flow-row .node.gate-mark { border-color: var(--ok); color: var(--ok); }
  .flow-row .arr { color: var(--muted); }
  .flow-row .flow-note { margin-left: auto; font-size: 12px; }
  .dual { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .art { background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 16px; box-shadow: var(--shadow); }
  .art .a-name { font-family: ui-monospace, Menlo, monospace; font-size: 14px; font-weight: 600; }
  .art .a-cmd { font-size: 12px; color: var(--accent); font-family: ui-monospace, Menlo, monospace; margin-top: 6px; }
  .art .a-out { font-size: 12px; color: var(--muted); margin-top: 6px; }
  .art .a-use { font-size: 12.5px; color: var(--muted); margin-top: 8px; }
  .kb-bar-wrap { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 18px; box-shadow: var(--shadow); }
  .kb-bar-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .kb-bar-head .pct { font-size: 26px; font-weight: 700; color: var(--pending); }
  .kb-bar { height: 14px; border-radius: 999px; background: var(--panel-2);
    overflow: hidden; border: 1px solid var(--line); }
  .kb-bar .fill { height: 100%; background: linear-gradient(90deg, var(--ok), oklch(78% 0.14 130));
    border-radius: 999px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .chip { display: inline-flex; align-items: center; gap: 7px; padding: 7px 11px;
    border-radius: 9px; font-size: 12.5px; border: 1px solid var(--line); background: var(--panel-2); }
  .chip .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .chip.v { border-color: oklch(72% 0.16 150 / 0.45); }
  .chip.v .dot { background: var(--ok); box-shadow: 0 0 8px var(--ok); }
  .chip.p { opacity: .82; } .chip.p .dot { background: var(--pending); }
  .chip .ev { font-size: 10px; color: var(--muted); border: 1px solid var(--line);
    border-radius: 5px; padding: 1px 5px; }
  .chip .src { font-size: 10px; color: var(--ok); font-family: ui-monospace, Menlo, monospace; }
  .ms { background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 13px 15px; box-shadow: var(--shadow); margin-bottom: 8px; }
  .ms-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .ms-title { font-weight: 600; font-size: 14px; }
  .ms-state { font-size: 11px; color: var(--muted); }
  .ms-bar { height: 8px; border-radius: 999px; background: var(--panel-2); overflow: hidden; }
  .ms-fill { height: 100%; background: var(--accent); border-radius: 999px; }
  .ms.done .ms-fill { background: var(--ok); }
  .actions { display: grid; gap: 10px; }
  .act { display: flex; gap: 14px; align-items: flex-start; background: var(--panel);
    border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 12px;
    padding: 14px 16px; box-shadow: var(--shadow); }
  .act.prio { border-left-color: var(--pending); }
  .act .rank { font-size: 12px; font-weight: 700; color: var(--muted); width: 18px; flex: none; }
  .act .a-title { font-weight: 600; font-size: 14.5px; }
  .act .a-why { font-size: 12.5px; color: var(--muted); margin-top: 3px; }
  .constr { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .con { background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 14px; box-shadow: var(--shadow); font-size: 13px; }
  .con .c-icon { font-size: 18px; } .con .c-title { font-weight: 600; margin: 6px 0 4px; }
  .con .c-body { color: var(--muted); font-size: 12.5px; }
  .commit, .issue { display: flex; gap: 10px; padding: 7px 0; font-size: 13px;
    border-bottom: 1px solid var(--line); }
  .commit code { color: var(--accent); font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  .commit span { color: var(--muted); }
  .list-wrap { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 8px 16px; box-shadow: var(--shadow); }
  .empty { color: var(--muted); font-size: 13px; padding: 12px 0; }
  .help-toggle { width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--line);
    background: var(--panel-2); color: var(--muted); font-size: 11px; cursor: pointer; padding: 0;
    line-height: 1; } .help-toggle:hover { color: var(--text); border-color: var(--accent); }
  .help-body { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px;
    padding: 12px 14px; margin: 8px 0 12px; font-size: 13px; color: var(--muted); }
  .help-body p { margin: 0 0 6px; } .help-body p:last-child { margin: 0; }
  .help-dynamic { color: var(--pending); }
  footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid var(--line);
    font-size: 12px; color: var(--muted); display: flex; justify-content: space-between;
    flex-wrap: wrap; gap: 8px; }
  @media (max-width: 760px) { .strip, .gates, .constr { grid-template-columns: 1fr 1fr; }
    .dual { grid-template-columns: 1fr; } }
`

const SCRIPT = `
  document.querySelectorAll('.help-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-help');
      var body = document.getElementById('help-' + id);
      if (body) body.hidden = !body.hidden;
    });
  });
`

export function render(model: DashboardModel): string {
  const p = model.project
  const date = model.generatedAt.slice(0, 10)
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(p.name)} · 한눈에</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>🛡 ${escapeHtml(p.name)}</h1>
    <span class="tag">${escapeHtml(p.phase)}</span>
    <span class="tag">${escapeHtml(p.status)}</span>
    <p class="one-line">${escapeHtml(p.tagline)}</p>
  </header>

  <div class="strip">${renderStats(model)}</div>

  <h2>마일스톤 ${helpToggle('milestones', model.help['milestones'])}</h2>
  ${renderMilestones(model)}

  <h2>안전 모델 — 데이터 흐름과 3중 게이트 ${helpToggle('safetyGates', model.help['safetyGates'])}</h2>
  ${renderFlow(model)}
  <div class="gates">${renderGates(model)}</div>

  <h2>KB 검증 현황 ${helpToggle('kbStatus', model.help['kbStatus'])}</h2>
  <div class="kb-bar-wrap">
    <div class="kb-bar-head"><div>검증된 엔트리 비율</div><div class="pct">${model.kb.pct}%</div></div>
    <div class="kb-bar"><div class="fill" style="width:${model.kb.pct}%"></div></div>
    <div class="chips">${renderChips(model)}</div>
  </div>

  <h2>다음 행동 ${helpToggle('nextActions', model.help['nextActions'])}</h2>
  <div class="actions">${renderActions(model)}</div>

  <h2>듀얼 산출물 구조 ${helpToggle('dualArtifact', model.help['dualArtifact'])}</h2>
  <div class="dual">${renderArtifacts(model)}</div>

  <h2>최근 작업</h2>
  <div class="list-wrap">${renderCommits(model)}</div>

  <h2>GitHub 이슈 (할 일)</h2>
  <div class="list-wrap">${renderGhIssues(model)}</div>

  <h2>범위 제약 ${helpToggle('constraints', model.help['constraints'])}</h2>
  <div class="constr">${renderConstraints(model)}</div>

  <footer>
    <span>생성: ${escapeHtml(date)} · ${escapeHtml(model.gitSha)}</span>
    <span>npm run dashboard 로 갱신 · 의도는 project-state.json</span>
  </footer>
</div>
<script>${SCRIPT}</script>
</body>
</html>
`
}
