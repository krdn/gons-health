import { describe, it, expect } from 'vitest'
import { pct, milestonePct, kbDynamicHelp, aggregate, detectMilestoneDrift } from './aggregate'
import type { RawData, Milestone } from './types'

describe('pct', () => {
  it('3/5 → 60', () => expect(pct(3, 5)).toBe(60))
  it('2/10 → 20', () => expect(pct(2, 10)).toBe(20))
  it('0/0 → 0 (0 나눗셈 안전)', () => expect(pct(0, 0)).toBe(0))
})

describe('milestonePct — state 1차 소스', () => {
  it('done은 체크박스 무관 100', () => {
    expect(milestonePct({ id: 'm', title: 't', state: 'done' })).toBe(100)
  })
  it('todo는 0', () => {
    expect(milestonePct({ id: 'm', title: 't', state: 'todo' })).toBe(0)
  })
  it('in_progress는 체크박스 비율', () => {
    expect(milestonePct({ id: 'm', title: 't', state: 'in_progress' }, { done: 3, total: 5 })).toBe(60)
  })
  it('in_progress인데 체크박스 없으면 0', () => {
    expect(milestonePct({ id: 'm', title: 't', state: 'in_progress' })).toBe(0)
  })
})

describe('kbDynamicHelp — 동적 해설 (사실만, 가치판단 없음)', () => {
  it('PENDING 있으면 검증율·PENDING 수·효용비례를 사실로 보고한다', () => {
    const help = kbDynamicHelp({ total: 10, verified: 2, pending: 8, entries: [] })
    expect(help).toContain('20%')
    expect(help).toContain('8')
    expect(help).toContain('verified')
  })
  it('PENDING을 "병목"이라 단정하지 않는다 (미검증 vs 근거상 정상기권을 코드가 구별 못 하므로 해석은 의도파일에 위임)', () => {
    const help = kbDynamicHelp({ total: 10, verified: 2, pending: 8, entries: [] })
    expect(help).not.toContain('병목')
  })
  it('PENDING 없으면 전 엔트리 검증 완료를 보고한다', () => {
    const help = kbDynamicHelp({ total: 2, verified: 2, pending: 0, entries: [] })
    expect(help).not.toContain('병목')
    expect(help).toContain('100%')
  })
})

describe('aggregate — 통합 모델', () => {
  const raw: RawData = {
    state: {
      project: { name: 'gons-health', tagline: 'T', phase: 'P', status: 'active' },
      milestones: [
        { id: 'm1', title: 'A', state: 'done' },
        { id: 'm2', title: 'B', state: 'in_progress', planFile: 'docs/p.md' },
      ],
      nextActions: [{ rank: 1, title: 'X', why: 'Y', priority: 'high' }],
      constraints: [{ icon: '🚫', title: 'C', body: 'D' }],
      gates: [{ num: '1', name: 'G1', file: 'f.ts', body: 'b' }],
      flow: [{ label: 'A', gate: false }, { label: 'B', gate: true }],
      artifacts: [{ name: 'pkg', cmd: 'c', out: 'o', use: 'u' }],
      help: { kbStatus: '고정설명' },
    },
    kb: {
      total: 3,
      verified: 1,
      pending: 2,
      entries: [
        { id: 'a', drug_class: 'D1', supplement: 'S1', evidence_level: '중', action_type: 'avoid', verified: true, sourceId: 'PMID:111' },
        { id: 'b', drug_class: 'D1', supplement: 'S2', evidence_level: '약', action_type: 'avoid', verified: false, sourceId: 'PENDING' },
        { id: 'c', drug_class: 'D2', supplement: 'S3', evidence_level: '강', action_type: 'spacing', verified: false, sourceId: 'PENDING' },
      ],
    },
    git: { ok: true, value: [{ sha: 'abc123', subject: '커밋1' }] },
    test: { ok: true, value: { passed: 21, failed: 0, total: 21 } },
    gh: { ok: false, reason: 'gh 미설치' },
    checkboxes: { 'docs/p.md': { done: 1, total: 4 } },
    milestoneAncestry: {},
    gitSha: 'abc123',
    generatedAt: '2026-06-22T00:00:00.000Z',
  }

  it('KB 모델 계산', () => {
    const model = aggregate(raw)
    expect(model.kb.total).toBe(3)
    expect(model.kb.verified).toBe(1)
    expect(model.kb.pct).toBe(33)
    expect(model.kb.chips).toHaveLength(3)
  })

  it('verified chip은 src 채움, PENDING은 빈 문자열', () => {
    const model = aggregate(raw)
    const verifiedChip = model.kb.chips.find((c) => c.verified)
    const pendingChip = model.kb.chips.find((c) => !c.verified)
    expect(verifiedChip?.src).toBe('PMID:111')
    expect(pendingChip?.src).toBe('')
  })

  it('마일스톤 뷰: done 100, in_progress 체크박스 비율', () => {
    const model = aggregate(raw)
    expect(model.milestones[0].pct).toBe(100)
    expect(model.milestones[1].pct).toBe(25)
    expect(model.milestones[1].detail).toBe('1/4 태스크')
  })

  it('도움말 2층: 고정 + 동적 (동적은 사실 보고, raw는 verified 1/pending 2)', () => {
    const model = aggregate(raw)
    expect(model.help.kbStatus.fixed).toBe('고정설명')
    expect(model.help.kbStatus.dynamic).toContain('PENDING 2개')
    expect(model.help.kbStatus.dynamic).not.toContain('병목')
  })

  it('테스트 통과 stat 생성', () => {
    const model = aggregate(raw)
    const testStat = model.stats.find((s) => s.label.includes('테스트'))
    expect(testStat?.num).toBe('21/21')
    expect(testStat?.tone).toBe('good')
  })

  it('gh 실패 시 ghIssues는 ok:false 보존', () => {
    const model = aggregate(raw)
    expect(model.ghIssues.ok).toBe(false)
  })

  it('gates/flow/artifacts를 메타에서 그대로 통과', () => {
    const model = aggregate(raw)
    expect(model.gates).toHaveLength(1)
    expect(model.flow).toHaveLength(2)
    expect(model.artifacts[0].name).toBe('pkg')
  })

  it('chip label: drug_class는 / 앞, supplement는 ( 앞만 남긴다', () => {
    const labelRaw: RawData = {
      ...raw,
      kb: {
        total: 1,
        verified: 1,
        pending: 0,
        entries: [
          { id: 'x', drug_class: '항응고제/항혈소판제', supplement: '은행 (Ginkgo biloba)', evidence_level: '중', action_type: 'avoid', verified: true, sourceId: 'PMID:111' },
        ],
      },
    }
    const model = aggregate(labelRaw)
    expect(model.kb.chips[0].label).toBe('항응고제 × 은행')
  })
})

describe('detectMilestoneDrift — 양방향 state↔git 대조', () => {
  const ms = (over: Partial<Milestone>): Milestone => ({
    id: 'm', title: 't', state: 'todo', ...over,
  })

  it('출시됐는데 done 아님 → shipped-not-done (이 작업을 촉발한 m3 버그)', () => {
    // anchor가 main에 있는데(yes) state는 in_progress
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm3', title: '살아있는 대시보드', state: 'in_progress', anchor: 'a95fbaf' })],
      { m3: 'yes' },
    )
    expect(drifts).toHaveLength(1)
    expect(drifts[0].kind).toBe('shipped-not-done')
    expect(drifts[0].id).toBe('m3')
  })

  it('done인데 main에 없음 → done-not-shipped (거짓 done)', () => {
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm9', state: 'done', anchor: 'beef123' })],
      { m9: 'no' },
    )
    expect(drifts).toHaveLength(1)
    expect(drifts[0].kind).toBe('done-not-shipped')
  })

  it('done인데 anchor 필드 없음 → done-without-anchor', () => {
    const drifts = detectMilestoneDrift([ms({ id: 'm9', state: 'done' })], {})
    expect(drifts).toHaveLength(1)
    expect(drifts[0].kind).toBe('done-without-anchor')
  })

  it('정상 done (anchor main에 있음) → 드리프트 0', () => {
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm1', state: 'done', anchor: 'a025d6d' })],
      { m1: 'yes' },
    )
    expect(drifts).toHaveLength(0)
  })

  it('parked/todo + anchor 없음 → 드리프트 0 (면제)', () => {
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm2', state: 'parked' }), ms({ id: 'm4', state: 'todo' })],
      {},
    )
    expect(drifts).toHaveLength(0)
  })

  it('anchor가 absent(커밋 오타·유실) → anchor-missing', () => {
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm9', state: 'in_progress', anchor: 'deadbee' })],
      { m9: 'absent' },
    )
    expect(drifts).toHaveLength(1)
    expect(drifts[0].kind).toBe('anchor-missing')
  })

  it('anchor가 unknown(환경 조회 실패) → 침묵 (드리프트 0)', () => {
    const drifts = detectMilestoneDrift(
      [ms({ id: 'm9', state: 'done', anchor: 'a95fbaf' })],
      { m9: 'unknown' },
    )
    expect(drifts).toHaveLength(0)
  })
})
