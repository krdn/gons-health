import type {
  RawData,
  DashboardModel,
  Stat,
  MilestoneView,
  ChipView,
  SectionHelp,
  Milestone,
  CheckboxCount,
  KbRaw,
  Ancestry,
  MilestoneDrift,
} from './types'

// 순수 함수. 네트워크·LLM·I/O 0. 입력 raw → 출력 모델.

export function pct(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

export function milestonePct(m: Milestone, cb?: CheckboxCount): number {
  // state가 1차 소스. 체크박스는 in_progress의 세부 진행 보조.
  if (m.state === 'done') return 100
  if (m.state === 'todo') return 0
  if (cb && cb.total > 0) return pct(cb.done, cb.total)
  return 0
}

// 순수 함수. anchor의 main 조상여부(ancestry)와 state를 양방향 대조.
// anchor가 done에 묶이지 않음 — "출시 증거 커밋"이라 state와 독립이어야
// 'shipped-not-done'(출시됐는데 done 아님 = m3 버그)을 잡는다.
export function detectMilestoneDrift(
  milestones: Milestone[],
  ancestry: Record<string, Ancestry>,
): MilestoneDrift[] {
  const drifts: MilestoneDrift[] = []
  for (const m of milestones) {
    const anc = ancestry[m.id] // anchor 없으면 undefined

    if (m.state === 'done' && !m.anchor) {
      drifts.push({
        id: m.id, title: m.title, kind: 'done-without-anchor',
        detail: `state=done인데 anchor 필드 없음 — 출시 증거 커밋 미연결`,
      })
      continue
    }
    if (!m.anchor) continue // anchor 없는 비-done(parked/todo/in_progress)은 면제

    if (anc === 'absent') {
      drifts.push({
        id: m.id, title: m.title, kind: 'anchor-missing',
        detail: `anchor ${m.anchor}가 git에 없음 — 오타·유실 의심`,
      })
    } else if (anc === 'yes' && m.state !== 'done') {
      drifts.push({
        id: m.id, title: m.title, kind: 'shipped-not-done',
        detail: `anchor ${m.anchor}가 main에 있으나 state=${m.state} — 출시됐는데 done 아님`,
      })
    } else if (anc === 'no' && m.state === 'done') {
      drifts.push({
        id: m.id, title: m.title, kind: 'done-not-shipped',
        detail: `state=done인데 anchor ${m.anchor}가 main에 없음 — 거짓 done`,
      })
    }
    // anc === 'unknown' (환경 조회 실패) → 침묵
  }
  return drifts
}

export function kbDynamicHelp(kb: KbRaw): string {
  // 사실만 보고한다. PENDING이 "미검증 병목"인지 "근거상 정상 기권"인지는
  // KB 데이터로 구별 불가(검증 이력은 의도) → "병목" 같은 가치판단을 코드가 단정하지 않는다.
  // 해석은 project-state.json 의 kbStatus 고정 도움말·nextActions 에 위임.
  const p = pct(kb.verified, kb.total)
  if (kb.pending > 0) {
    return `검증 ${p}% — PENDING ${kb.pending}개. lookup은 verified만 노출하므로 도구 효용은 verified(${kb.verified}개)에 비례한다.`
  }
  return `검증 ${p}% — 전 엔트리 검증 완료.`
}

function buildStats(raw: RawData): Stat[] {
  const stats: Stat[] = []

  // 1) 테스트
  if (raw.test.ok) {
    const t = raw.test.value
    stats.push({
      num: `${t.passed}/${t.total}`,
      label: '테스트 통과 · 빌드 OK',
      tone: t.failed === 0 ? 'good' : 'warn',
      spark: t.failed === 0 ? '✅' : '❌',
    })
  } else {
    stats.push({ num: '—', label: '테스트 미실행', tone: 'neutral', spark: '⏳' })
  }

  // 2) KB verified
  stats.push({
    num: `${raw.kb.verified}/${raw.kb.total}`,
    label: 'KB 엔트리 verified',
    tone: raw.kb.pending > 0 ? 'warn' : 'good',
    spark: raw.kb.pending > 0 ? '⏳' : '✅',
  })

  // 3) 안전 게이트 (고정 3)
  stats.push({ num: '3', label: '안전 게이트 (합성)', tone: 'neutral', spark: '🔒' })

  // 4) 산출물 (고정 2: 앱 + 코어패키지)
  stats.push({ num: '2', label: '산출물: 앱 + 코어패키지', tone: 'neutral', spark: '📦' })

  return stats
}

function buildMilestones(raw: RawData): MilestoneView[] {
  return raw.state.milestones.map((m) => {
    const cb = m.planFile ? raw.checkboxes[m.planFile] : undefined
    const p = milestonePct(m, cb)
    const detail =
      m.state === 'in_progress' && cb && cb.total > 0
        ? `${cb.done}/${cb.total} 태스크`
        : ''
    return { title: m.title, state: m.state, pct: p, detail }
  })
}

function buildChips(kb: KbRaw): ChipView[] {
  return kb.entries.map((e) => ({
    label: `${e.drug_class.split('/')[0]} × ${e.supplement.split(' (')[0]}`,
    evidence: `${e.evidence_level}·${e.action_type}`,
    verified: e.verified,
    src: e.verified ? e.sourceId : '',
  }))
}

function buildHelp(raw: RawData): Record<string, SectionHelp> {
  const help: Record<string, SectionHelp> = {}
  for (const [key, fixed] of Object.entries(raw.state.help)) {
    help[key] = { fixed, dynamic: '' }
  }
  // 동적 해설 주입
  help.kbStatus = {
    fixed: raw.state.help.kbStatus ?? '',
    dynamic: kbDynamicHelp(raw.kb),
  }
  return help
}

export function aggregate(raw: RawData): DashboardModel {
  return {
    project: raw.state.project,
    stats: buildStats(raw),
    milestones: buildMilestones(raw),
    milestoneDrifts: detectMilestoneDrift(raw.state.milestones, raw.milestoneAncestry),
    nextActions: raw.state.nextActions,
    constraints: raw.state.constraints,
    gates: raw.state.gates,
    flow: raw.state.flow,
    artifacts: raw.state.artifacts,
    artifactWarning: raw.state.artifactWarning ?? '',
    kb: {
      total: raw.kb.total,
      verified: raw.kb.verified,
      pct: pct(raw.kb.verified, raw.kb.total),
      chips: buildChips(raw.kb),
    },
    recentCommits: raw.git.ok ? raw.git.value : [],
    ghIssues: raw.gh,
    help: buildHelp(raw),
    gitSha: raw.gitSha,
    generatedAt: raw.generatedAt,
  }
}
