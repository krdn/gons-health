import { describe, it, expect } from 'vitest'
import { loadState, countKb, countCheckboxes, collect } from './collect'

describe('loadState — 메타파일 fail-loud', () => {
  it('project.name 누락 시 throw', () => {
    expect(() => loadState({ milestones: [], nextActions: [], constraints: [], help: {} })).toThrow()
  })

  it('milestones 배열 아니면 throw', () => {
    expect(() =>
      loadState({ project: { name: 'x', tagline: 't', phase: 'p', status: 'active' }, milestones: 'no', nextActions: [], constraints: [], help: {} }),
    ).toThrow()
  })

  it('유효한 메타는 그대로 반환', () => {
    const valid = {
      project: { name: 'gons-health', tagline: 't', phase: 'p', status: 'active' },
      milestones: [{ id: 'm1', title: 'A', state: 'done' }],
      nextActions: [],
      constraints: [],
      gates: [],
      flow: [],
      artifacts: [],
      help: { kbStatus: 'x' },
    }
    const result = loadState(valid)
    expect(result.project.name).toBe('gons-health')
    expect(result.milestones).toHaveLength(1)
  })

  it('gates 배열 아니면 throw', () => {
    expect(() =>
      loadState({ project: { name: 'x', tagline: 't', phase: 'p', status: 'active' }, milestones: [], nextActions: [], constraints: [], gates: 'no', flow: [], artifacts: [], help: {} }),
    ).toThrow()
  })
})

describe('countKb — raw 비여과 카운트', () => {
  it('verified와 PENDING을 둘 다 센다 (verified만 거르지 않음)', () => {
    const kb = [
      { id: 'a', drug_class: 'D1', supplement: 'S1', evidence_level: '중', action_type: 'avoid', verified: true, source: { id: 'PMID:111' } },
      { id: 'b', drug_class: 'D1', supplement: 'S2', evidence_level: '약', action_type: 'avoid', verified: false, source: { id: 'PENDING' } },
      { id: 'c', drug_class: 'D2', supplement: 'S3', evidence_level: '강', action_type: 'spacing', verified: false, source: { id: 'PENDING' } },
    ]
    const result = countKb(kb)
    expect(result.total).toBe(3)
    expect(result.verified).toBe(1)
    expect(result.pending).toBe(2)
    expect(result.entries[0].sourceId).toBe('PMID:111')
  })
})

describe('collect — vitest 가드', () => {
  it('vitest 컨텍스트에서 collect()는 행 안 걸고 test:{ok:false} 반환', () => {
    const raw = collect()
    expect(raw.test.ok).toBe(false) // 가드가 vitest 스폰 차단
    expect(raw.kb.total).toBeGreaterThan(0) // 나머지 수집은 정상
  })
})

describe('countCheckboxes — 체크박스 파싱', () => {
  it('완료/전체를 센다', () => {
    const md = `
# Plan
- [ ] 미완료 1
- [x] 완료 1
- [ ] 미완료 2
일반 텍스트
- [x] 완료 2
`
    const result = countCheckboxes(md)
    expect(result.done).toBe(2)
    expect(result.total).toBe(4)
  })

  it('체크박스 없으면 0/0', () => {
    const result = countCheckboxes('# 제목\n본문만')
    expect(result.done).toBe(0)
    expect(result.total).toBe(0)
  })
})
