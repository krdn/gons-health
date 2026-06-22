import { describe, it, expect } from 'vitest'
import { pct, milestonePct, kbDynamicHelp, aggregate } from './aggregate'
import type { RawData } from './types'

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

describe('kbDynamicHelp — 동적 해설', () => {
  it('PENDING 있으면 병목 문구 포함', () => {
    const help = kbDynamicHelp({ total: 10, verified: 2, pending: 8, entries: [] })
    expect(help).toContain('20%')
    expect(help).toContain('8')
    expect(help).toContain('병목')
  })
  it('PENDING 없으면 병목 문구 없음', () => {
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

  it('도움말 2층: 고정 + 동적', () => {
    const model = aggregate(raw)
    expect(model.help.kbStatus.fixed).toBe('고정설명')
    expect(model.help.kbStatus.dynamic).toContain('병목')
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
