import { describe, test, expect } from 'vitest'
import { mergeVerdict } from './applyVerdict'

const baseEntry = {
  id: 'e-1',
  drug_class: 'A',
  supplement: 'B',
  verified: false,
  source: { db: '미확정', id: 'PENDING', url: 'https://x', quote: 'q', retrieved_date: '2026-06-21' },
}

describe('mergeVerdict', () => {
  test('pass 판정은 auto_verified=true + auto_review 기록', () => {
    const v = {
      id: 'e-1', status: 'pass' as const, pmid: 'PMID:1',
      evidence_sentence: 's', direction_match: true, reason: '',
    }
    const out = mergeVerdict(baseEntry, v, '2026-06-22')
    expect(out.auto_verified).toBe(true)
    expect(out.auto_review?.status).toBe('pass')
    expect(out.auto_review?.pmid).toBe('PMID:1')
  })

  test('fail 판정은 auto_verified=false + 사유 기록', () => {
    const v = {
      id: 'e-1', status: 'fail' as const, pmid: 'PMID:2',
      evidence_sentence: '', direction_match: false, reason: '방향 불일치',
    }
    const out = mergeVerdict(baseEntry, v, '2026-06-22')
    expect(out.auto_verified).toBe(false)
    expect(out.auto_review?.reason).toBe('방향 불일치')
  })

  test('verified는 절대 건드리지 않는다 (금본위 보존)', () => {
    const v = { id: 'e-1', status: 'pass' as const, pmid: 'PMID:1', evidence_sentence: 's', direction_match: true, reason: '' }
    const out = mergeVerdict({ ...baseEntry, verified: false }, v, '2026-06-22')
    expect(out.verified).toBe(false) // pass여도 verified는 그대로
  })

  test('원본 객체를 변형하지 않는다 (불변)', () => {
    const v = { id: 'e-1', status: 'pass' as const, pmid: 'PMID:1', evidence_sentence: 's', direction_match: true, reason: '' }
    mergeVerdict(baseEntry, v, '2026-06-22')
    expect((baseEntry as any).auto_verified).toBeUndefined()
  })

  test('pass 판정인데 evidence_sentence가 비면 auto_verified=false (환각 quote 차단)', () => {
    const v = {
      id: 'e-1', status: 'pass' as const, pmid: 'PMID:1',
      evidence_sentence: '', direction_match: true, reason: '',
    }
    const out = mergeVerdict(baseEntry, v, '2026-06-22')
    expect(out.auto_verified).toBe(false)
    // validateKb pass-branch가 pmid·evidence_sentence 필수를 강제하므로 status도 fail로 강등
    expect(out.auto_review?.status).toBe('fail')
    // reason에 강등 사유 포함
    expect(out.auto_review?.reason).toMatch(/강등/)
  })

  test('bare 숫자 pmid는 PMID: 접두로 정규화된다', () => {
    const v = {
      id: 'e-1', status: 'pass' as const, pmid: '42136239',
      evidence_sentence: 's', direction_match: true, reason: '',
    }
    const out = mergeVerdict(baseEntry, v, '2026-06-22')
    expect(out.auto_review?.pmid).toBe('PMID:42136239')
    // auto_verified는 pass + non-empty evidence_sentence이므로 true
    expect(out.auto_verified).toBe(true)
  })
})
