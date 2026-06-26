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

// 보조 지표 strip: KB(label에 'KB' 포함)는 히어로 카드로 따로 빠지므로 strip에서 제외.
function renderStats(model: DashboardModel): string {
  return model.stats
    .filter((s) => !s.label.includes('KB'))
    .map(
      (s) => `<div class="stat ${s.tone}"><span class="spark">${s.spark}</span>
        <div><div class="num">${escapeHtml(s.num)}</div>
        <div class="lbl">${escapeHtml(s.label)}</div></div></div>`,
    )
    .join('\n')
}

// 히어로 KB 카드: 도구 효용을 결정하는 핵심 지표를 가장 크게 강조.
function renderHeroKb(model: DashboardModel): string {
  const { verified, total, pct } = model.kb
  const tone = model.kb.pct === 100 ? 'k-done' : 'k-pending'
  return `<div class="hero-kb ${tone}">
    <div class="k-label">검증된 KB 엔트리</div>
    <div class="k-big"><span class="k-num">${verified}</span><span class="k-of">/ ${total}</span></div>
    <div class="k-sub">lookup은 verified 엔트리만 노출 — 도구 효용은 이 숫자에 비례</div>
    <div class="kb-bar"><div class="fill" style="width:${pct}%"></div></div>
  </div>`
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
      (c) => `<div class="con"><div class="c-icon">${escapeHtml(c.icon)}</div>
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
      (g) => `<div class="gate flow">
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
    /* 라이트 테마 — 색 반전이 아니라 흰 배경 전제로 재정의. 앰버는 대비 위해 L 낮춤. */
    --bg: oklch(98.5% 0.003 260); --panel: oklch(100% 0 0);
    --panel-2: oklch(97% 0.004 260); --line: oklch(90% 0.006 260);
    --line-strong: oklch(84% 0.008 260);
    --text: oklch(24% 0.012 260); --muted: oklch(45% 0.012 260);
    --ok: oklch(54% 0.15 150); --ok-bg: oklch(95% 0.04 150);
    --pending: oklch(58% 0.13 60); --pending-bg: oklch(95% 0.05 75);
    --danger: oklch(55% 0.2 25); --danger-bg: oklch(96% 0.03 25);
    --accent: oklch(52% 0.18 255); --accent-bg: oklch(96% 0.03 255);
    --shadow: 0 1px 2px oklch(0% 0 0 / 0.04), 0 2px 8px oklch(0% 0 0 / 0.04);
    --shadow-lift: 0 1px 3px oklch(0% 0 0 / 0.06), 0 8px 24px oklch(0% 0 0 / 0.08);
    --radius: 14px;
    --mono: ui-monospace, "SF Mono", Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text);
    font-family: "Pretendard", -apple-system, "Apple SD Gothic Neo", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; line-height: 1.5; }
  a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 28px 24px 80px; }

  /* ── 히어로: 정체성 + KB를 가장 크게 ── */
  .hero { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; align-items: stretch;
    margin-bottom: 28px; }
  .hero-id { background: var(--panel); border: 1px solid var(--line); border-radius: 18px;
    padding: 24px 26px; box-shadow: var(--shadow-lift); }
  .hero-id .id-top { display: flex; align-items: center; gap: 11px; flex-wrap: wrap; }
  .hero-id h1 { font-size: 26px; margin: 0; letter-spacing: -0.025em; font-weight: 800; }
  .hero-id .tag { font-size: 11.5px; font-weight: 600; color: var(--accent);
    background: var(--accent-bg); border: 1px solid var(--line); padding: 3px 10px; border-radius: 999px; }
  .hero-id .tag.live { color: var(--ok); background: var(--ok-bg); }
  .hero-id .one-line { color: var(--muted); font-size: 14px; margin: 14px 0 0; line-height: 1.55; }

  /* KB 히어로 카드 — 도구 효용의 핵심 지표를 가장 강조 */
  .hero-kb { background: linear-gradient(160deg, var(--accent-bg), var(--panel));
    border: 1px solid var(--line-strong); border-radius: 18px; padding: 22px 24px;
    box-shadow: var(--shadow-lift); display: flex; flex-direction: column; }
  .hero-kb .k-label { font-size: 12px; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.06em; }
  .hero-kb .k-big { display: flex; align-items: baseline; gap: 10px; margin: 6px 0 2px; }
  .hero-kb .k-num { font-size: 52px; font-weight: 800; letter-spacing: -0.04em; line-height: 1;
    color: var(--accent); }
  .hero-kb .k-of { font-size: 17px; color: var(--muted); font-weight: 600; }
  .hero-kb .k-sub { font-size: 12.5px; color: var(--muted); margin-bottom: 12px; }
  .hero-kb .kb-bar { height: 12px; border-radius: 999px; background: var(--panel-2);
    overflow: hidden; border: 1px solid var(--line); margin-top: auto; }
  .hero-kb .kb-bar .fill { height: 100%; background: var(--accent); border-radius: 999px;
    transition: width .4s; }

  /* ── 보조 지표 strip (3개, KB 제외) ── */
  .strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 12px; }
  .stat { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 16px 18px; box-shadow: var(--shadow); display: flex; align-items: center; gap: 14px; }
  .stat .spark { font-size: 22px; flex: none; }
  .stat .num { font-size: 26px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; }
  .stat .lbl { font-size: 12px; color: var(--muted); margin-top: 5px; }
  .stat.good .num { color: var(--ok); } .stat.warn .num { color: var(--pending); }

  /* ── 섹션 제목: 운영(채움 강조) vs 참조(약하게) 위계 ── */
  h2 { font-size: 16px; letter-spacing: -0.01em; color: var(--text);
    margin: 34px 0 14px; font-weight: 700; display: flex; align-items: center; gap: 9px; }
  h2 .sec-kicker { font-size: 11px; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.07em; background: var(--panel-2);
    border: 1px solid var(--line); padding: 2px 8px; border-radius: 6px; }
  .ref-zone h2 { color: var(--muted); }

  /* 2단 운영 레이아웃 */
  .ops { display: grid; grid-template-columns: 1.1fr 1fr; gap: 28px; align-items: start; }
  .ops .col-title { font-size: 13px; font-weight: 700; color: var(--text); margin: 0 0 12px;
    display: flex; align-items: center; gap: 8px; }
  .ops .col-title .help-toggle { margin-left: 0; }

  .gates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .gate { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 16px; box-shadow: var(--shadow); }
  .gate .g-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .gate .g-num { font-size: 11px; font-weight: 700; color: #fff; background: var(--accent);
    width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; flex: none; }
  .gate .g-name { font-weight: 700; font-size: 15px; }
  .gate .g-file { font-size: 11px; color: var(--muted); font-family: var(--mono); }
  .gate.flow { border-color: var(--line-strong); border-top: 3px solid var(--accent); }
  .gate .g-body { font-size: 13px; color: var(--muted); margin-top: 8px; line-height: 1.5; }
  .flow-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 14px 16px; box-shadow: var(--shadow); font-size: 13px; margin-bottom: 14px; }
  .flow-row .node { background: var(--panel-2); border: 1px solid var(--line);
    padding: 7px 11px; border-radius: 8px; font-family: var(--mono); font-size: 12px; }
  .flow-row .node.gate-mark { border-color: var(--ok); color: var(--ok); background: var(--ok-bg);
    font-weight: 600; }
  .flow-row .arr { color: var(--muted); }
  .flow-row .flow-note { margin-left: auto; font-size: 12px; color: var(--danger); font-weight: 600; }
  .dual { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .art { background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 16px; box-shadow: var(--shadow); }
  .art .a-name { font-family: var(--mono); font-size: 14px; font-weight: 700; }
  .art .a-cmd { font-size: 12px; color: var(--accent); font-family: var(--mono); margin-top: 6px; }
  .art .a-out { font-size: 12px; color: var(--muted); margin-top: 6px; }
  .art .a-use { font-size: 12.5px; color: var(--muted); margin-top: 8px; line-height: 1.5; }

  /* KB 칩 (운영 좌측) */
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { display: inline-flex; align-items: center; gap: 7px; padding: 7px 11px;
    border-radius: 9px; font-size: 12.5px; border: 1px solid var(--line); background: var(--panel); cursor: default; }
  .chip .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .chip.v { border-color: var(--ok); background: var(--ok-bg); }
  .chip.v .dot { background: var(--ok); }
  .chip.p { border-style: dashed; } .chip.p .dot { background: var(--pending); }
  .chip .ev { font-size: 10px; color: var(--muted); border: 1px solid var(--line);
    border-radius: 5px; padding: 1px 5px; }
  .chip .src { font-size: 10px; color: var(--ok); font-family: var(--mono); font-weight: 600; }

  /* 마일스톤 */
  .ms { background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 13px 15px; box-shadow: var(--shadow); margin-bottom: 10px; }
  .ms-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 9px; gap: 8px; }
  .ms-title { font-weight: 600; font-size: 14px; }
  .ms-state { font-size: 11px; color: var(--muted); font-weight: 600; flex: none;
    padding: 2px 8px; border-radius: 6px; background: var(--panel-2); border: 1px solid var(--line); }
  .ms.done .ms-state { color: var(--ok); background: var(--ok-bg); border-color: var(--ok); }
  .ms.in_progress .ms-state { color: var(--accent); background: var(--accent-bg); }
  .ms-bar { height: 7px; border-radius: 999px; background: var(--panel-2); overflow: hidden; border: 1px solid var(--line); }
  .ms-fill { height: 100%; background: var(--accent); border-radius: 999px; }
  .ms.done .ms-fill { background: var(--ok); }

  /* 다음 행동 */
  .actions { display: grid; gap: 10px; }
  .act { display: flex; gap: 13px; align-items: flex-start; background: var(--panel);
    border: 1px solid var(--line); border-left: 3px solid var(--line-strong); border-radius: 12px;
    padding: 14px 16px; box-shadow: var(--shadow); }
  .act.prio { border-left-color: var(--pending); background: var(--pending-bg); }
  .act .rank { font-size: 13px; font-weight: 800; color: #fff; background: var(--muted);
    width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; flex: none; }
  .act.prio .rank { background: var(--pending); }
  .act .a-title { font-weight: 600; font-size: 14.5px; }
  .act .a-why { font-size: 12.5px; color: var(--muted); margin-top: 4px; line-height: 1.5; }

  /* 범위 제약 */
  .constr { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .con { background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 15px; box-shadow: var(--shadow); font-size: 13px; }
  .con .c-icon { font-size: 20px; } .con .c-title { font-weight: 700; margin: 8px 0 5px; }
  .con .c-body { color: var(--muted); font-size: 12.5px; line-height: 1.5; }

  /* 커밋·이슈 리스트 */
  .commit, .issue { display: flex; gap: 10px; padding: 9px 0; font-size: 13px;
    border-bottom: 1px solid var(--line); align-items: center; }
  .commit:last-child, .issue:last-child { border-bottom: none; }
  .commit code { color: var(--accent); font-family: var(--mono); font-size: 12px;
    background: var(--accent-bg); padding: 1px 6px; border-radius: 5px; flex: none; }
  .commit span { color: var(--text); }
  .issue-num { color: var(--muted); font-family: var(--mono); font-weight: 600; flex: none; }
  .list-wrap { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 6px 18px; box-shadow: var(--shadow); }
  .empty { color: var(--muted); font-size: 13px; padding: 14px 0; }

  /* 도움말 토글 */
  .help-toggle { width: 19px; height: 19px; border-radius: 50%; border: 1px solid var(--line-strong);
    background: var(--panel); color: var(--muted); font-size: 11px; cursor: pointer; padding: 0;
    line-height: 1; font-weight: 700; } .help-toggle:hover { color: var(--accent); border-color: var(--accent); }
  .help-body { background: var(--accent-bg); border: 1px solid var(--line); border-radius: 10px;
    padding: 12px 14px; margin: 8px 0 12px; font-size: 13px; color: var(--text); line-height: 1.55; }
  .help-body p { margin: 0 0 6px; } .help-body p:last-child { margin: 0; }
  .help-dynamic { color: var(--accent); font-weight: 500; }
  .warn-box { margin-top: 14px; background: var(--danger-bg); border: 1px solid var(--danger);
    border-radius: 10px; padding: 12px 14px; font-size: 12.5px; line-height: 1.55; }
  .warn-box b { color: var(--danger); }
  .kb-note { font-size: 12.5px; color: var(--muted); margin: 6px 0 14px; line-height: 1.5; }

  /* 참조 존 구분선 */
  .ref-zone { margin-top: 44px; padding-top: 4px; border-top: 2px dashed var(--line); }
  .ref-zone .ref-banner { font-size: 12px; color: var(--muted); margin: 18px 0 0;
    display: flex; align-items: center; gap: 8px; }

  footer { margin-top: 40px; padding-top: 18px; border-top: 1px solid var(--line);
    font-size: 12px; color: var(--muted); display: flex; justify-content: space-between;
    flex-wrap: wrap; gap: 8px; }

  @media (max-width: 860px) {
    .hero, .ops { grid-template-columns: 1fr; }
    .strip, .gates, .constr { grid-template-columns: 1fr 1fr; }
    .dual { grid-template-columns: 1fr; }
  }
  @media (max-width: 540px) {
    .strip, .gates, .constr { grid-template-columns: 1fr; }
  }
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
  <!-- ── 히어로: 정체성 + KB 핵심 지표 ── -->
  <div class="hero">
    <div class="hero-id">
      <div class="id-top">
        <h1>🛡 ${escapeHtml(p.name)}</h1>
        <span class="tag">${escapeHtml(p.phase)}</span>
        <span class="tag live">${escapeHtml(p.status)}</span>
      </div>
      <p class="one-line">${escapeHtml(p.tagline)}</p>
    </div>
    ${renderHeroKb(model)}
  </div>

  <!-- 보조 지표 (테스트·게이트·산출물) -->
  <div class="strip">${renderStats(model)}</div>

  <!-- ── 운영 현황: 좌 진행 / 우 KB 칩 ── -->
  <div class="ops">
    <div class="ops-left">
      <div class="col-title">마일스톤 ${helpToggle('milestones', model.help['milestones'])}</div>
      ${renderMilestones(model)}

      <div class="col-title" style="margin-top:22px">다음 행동 ${helpToggle('nextActions', model.help['nextActions'])}</div>
      <div class="actions">${renderActions(model)}</div>
    </div>
    <div class="ops-right">
      <div class="col-title">KB 검증 현황 — ${model.kb.pct}% ${helpToggle('kbStatus', model.help['kbStatus'])}</div>
      ${model.help['kbStatus']?.dynamic ? `<div class="kb-note">${escapeHtml(model.help['kbStatus'].dynamic)}</div>` : ''}
      <div class="chips">${renderChips(model)}</div>
    </div>
  </div>

  <!-- ── 참조 존: 설계 사실·산출물·이력·제약 ── -->
  <div class="ref-zone">
    <p class="ref-banner">📐 아래는 매번 변하지 않는 설계·구조 참조 영역입니다.</p>

    <h2><span class="sec-kicker">안전</span> 데이터 흐름과 3중 게이트 ${helpToggle('safetyGates', model.help['safetyGates'])}</h2>
    ${renderFlow(model)}
    <div class="gates">${renderGates(model)}</div>

    <h2><span class="sec-kicker">패키징</span> 듀얼 산출물 구조 ${helpToggle('dualArtifact', model.help['dualArtifact'])}</h2>
    <div class="dual">${renderArtifacts(model)}</div>
    ${model.artifactWarning ? `<div class="warn-box">${escapeHtml(model.artifactWarning)}</div>` : ''}

    <h2><span class="sec-kicker">제약</span> 범위 제약 ${helpToggle('constraints', model.help['constraints'])}</h2>
    <div class="constr">${renderConstraints(model)}</div>

    <h2><span class="sec-kicker">이력</span> 최근 작업</h2>
    <div class="list-wrap">${renderCommits(model)}</div>

    <h2><span class="sec-kicker">할 일</span> GitHub 이슈</h2>
    <div class="list-wrap">${renderGhIssues(model)}</div>
  </div>

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
