import { describe, test, expect } from 'vitest'
import { listPromotable, promote } from './promoteQueue'

function autoVerifiedEntry(over = {}) {
  return {
    id: 'e-1', drug_class: 'A', supplement: 'B',
    severity: 'high', action_type: 'avoid', mechanism: 'm', recommendation: 'r',
    evidence_level: '중',
    source: { db: '미확정', id: 'PENDING', url: 'https://x', quote: 'q', retrieved_date: '2026-06-21' },
    last_reviewed: '2026-06-21', verified: false, auto_verified: true,
    auto_review: { status: 'pass', pmid: 'PMID:99', evidence_sentence: 'ES', direction_match: true, reason: '', reviewed_date: '2026-06-22' },
    ...over,
  }
}

describe('listPromotable', () => {
  test('auto_verified=true & verified=false 만 후보', () => {
    const kb = [autoVerifiedEntry(), autoVerifiedEntry({ id: 'e-2', verified: true }), autoVerifiedEntry({ id: 'e-3', auto_verified: false })]
    const out = listPromotable(kb)
    expect(out.map((x) => x.id)).toEqual(['e-1'])
    expect(out[0].pmid).toBe('PMID:99')
  })
})

describe('promote', () => {
  test('지정 id를 verified=true로 + source를 pmid로 채움', () => {
    const kb = [autoVerifiedEntry()]
    const out = promote(kb, ['e-1'], '2026-06-22')
    expect(out[0].verified).toBe(true)
    expect(out[0].source.id).toBe('PMID:99')
    expect(out[0].last_reviewed).toBe('2026-06-22')
  })

  test('지정 안 한 id는 그대로', () => {
    const kb = [autoVerifiedEntry(), autoVerifiedEntry({ id: 'e-2' })]
    const out = promote(kb, ['e-1'], '2026-06-22')
    expect(out.find((x) => x.id === 'e-2').verified).toBe(false)
  })

  test('승격 시 quote를 grounded 근거 문장으로 교체 (낡은 PENDING quote 제거)', () => {
    // fixture: source.quote='q', auto_review.evidence_sentence='ES'
    const out = promote([autoVerifiedEntry()], ['e-1'], '2026-06-22')
    expect(out[0].source.quote).toBe('ES') // 'q'(낡은 값) 아님 — 환각 quote가 verified로 새는 것 차단
  })

  test('fail 엔트리(auto_verified=false)는 명시 지정해도 승격 안 됨', () => {
    const kb = [autoVerifiedEntry({ auto_verified: false })]
    const out = promote(kb, ['e-1'], '2026-06-22')
    expect(out[0].verified).toBe(false) // 후보 아니므로 차단 — 오타 한 번에 미검증이 금본위로 새는 것 방지
  })

  test('원본 불변', () => {
    const kb = [autoVerifiedEntry()]
    promote(kb, ['e-1'], '2026-06-22')
    expect(kb[0].verified).toBe(false)
  })
})
