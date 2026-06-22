import { describe, it, expect, test } from 'vitest'
import { validateKb } from './validateKb'

function validBaseEntry() {
  return {
    id: 'x-1',
    drug_class: 'A',
    drug_ingredient: ['a'],
    supplement: 'B',
    severity: 'high' as const,
    action_type: 'avoid' as const,
    mechanism: 'm',
    recommendation: 'r',
    evidence_level: '중' as const,
    source: { db: 'PubMed', id: 'PMID:1', url: 'https://x', quote: 'q', retrieved_date: '2026-06-22' },
    last_reviewed: '2026-06-22',
    verified: true,
  }
}

test('auto_verified가 boolean이 아니면 throw', () => {
  const entry = { ...validBaseEntry(), auto_verified: 'yes' }
  expect(() => validateKb([entry])).toThrow(/auto_verified/)
})

test('auto_review.status가 pass/fail이 아니면 throw', () => {
  const entry = {
    ...validBaseEntry(),
    auto_review: {
      status: 'maybe',
      pmid: 'PMID:1',
      evidence_sentence: 's',
      direction_match: true,
      reason: '',
      reviewed_date: '2026-06-22',
    },
  }
  expect(() => validateKb([entry])).toThrow(/auto_review.*status/)
})

test('auto_verified/auto_review 없는 기존 엔트리는 통과', () => {
  expect(() => validateKb([validBaseEntry()])).not.toThrow()
})

test('fail 판정 엔트리는 validateKb를 통과한다 (evidence_sentence 비어도)', () => {
  // fail은 정상 경로 — 근거 못 집으면 fail. 이게 KB를 brick하면 안 됨.
  const e = {
    ...validBaseEntry(),
    auto_verified: false,
    auto_review: {
      status: 'fail', pmid: '', evidence_sentence: '',
      direction_match: false, reason: '관련 논문 없음', reviewed_date: '2026-06-22',
    },
  }
  expect(() => validateKb([e])).not.toThrow()
})

test('pass 판정인데 evidence_sentence 비면 throw (안전 불변식)', () => {
  const e = {
    ...validBaseEntry(),
    auto_verified: true,
    auto_review: {
      status: 'pass', pmid: 'PMID:1', evidence_sentence: '',
      direction_match: true, reason: '', reviewed_date: '2026-06-22',
    },
  }
  expect(() => validateKb([e])).toThrow()
})

describe('validateKb', () => {
  it('evidence_level 없는 엔트리를 거부한다', () => {
    const bad = [
      {
        id: 'x-001',
        drug_class: '항응고제/항혈소판제',
        drug_ingredient: ['warfarin'],
        supplement: '은행 (Ginkgo biloba)',
        severity: 'high',
        action_type: 'avoid',
        mechanism: '출혈 위험',
        recommendation: '권하지 말 것',
        // evidence_level 누락
        source: { db: 'PMC', id: 'PMID:1', url: 'http://x', retrieved_date: '2026-06-21', quote: 'q' },
        last_reviewed: '2026-06-21',
      },
    ]
    expect(() => validateKb(bad)).toThrow(/evidence_level/)
  })

  it('필수 필드를 모두 갖춘 엔트리를 통과시킨다', () => {
    const good = [
      {
        id: 'anticoag-ginkgo-001',
        drug_class: '항응고제/항혈소판제',
        drug_ingredient: ['warfarin', 'apixaban'],
        supplement: '은행 (Ginkgo biloba)',
        severity: 'high',
        action_type: 'avoid',
        mechanism: '혈소판 응집 억제 상가작용으로 출혈 위험 증가',
        recommendation: '병용 시 출혈 위험 증가. 환자에게 권하지 말 것.',
        evidence_level: '중',
        source: { db: 'PMC', id: 'PMID:18205318', url: 'https://pubmed.ncbi.nlm.nih.gov/18205318/', retrieved_date: '2026-06-21', quote: 'Ginkgo may increase bleeding risk.' },
        last_reviewed: '2026-06-21',
        verified: true,
      },
    ]
    const result = validateKb(good)
    expect(result).toHaveLength(1)
    expect(result[0].evidence_level).toBe('중')
  })

  it('source.url 없는 엔트리를 거부한다 (cite-or-abstain은 인용을 강제)', () => {
    const bad = [
      {
        id: 'x-002', drug_class: 'a', drug_ingredient: ['x'], supplement: 's',
        severity: 'low', action_type: 'monitor', mechanism: 'm', recommendation: 'r',
        evidence_level: '약', source: { db: 'PMC', id: 'PMID:1', url: '', retrieved_date: '2026-06-21', quote: 'q' },
        last_reviewed: '2026-06-21',
      },
    ]
    expect(() => validateKb(bad)).toThrow(/source/)
  })

  it('source.quote 없는 엔트리를 거부한다 (cite-or-abstain은 인용을 강제)', () => {
    const bad = [
      {
        id: 'x-004', drug_class: 'a', drug_ingredient: ['x'], supplement: 's',
        severity: 'low', action_type: 'monitor', mechanism: 'm', recommendation: 'r',
        evidence_level: '약', source: { db: 'PMC', id: 'PMID:1', url: 'http://x', retrieved_date: '2026-06-21', quote: '' },
        last_reviewed: '2026-06-21',
      },
    ]
    expect(() => validateKb(bad)).toThrow(/source/)
  })

  it('drug_ingredient에 비문자열 요소가 있으면 거부한다', () => {
    const bad = [
      {
        id: 'x-003', drug_class: '항응고제/항혈소판제', drug_ingredient: ['warfarin', null],
        supplement: '은행 (Ginkgo biloba)', severity: 'high', action_type: 'avoid',
        mechanism: 'm', recommendation: 'r', evidence_level: '중',
        source: { db: 'PMC', id: 'PMID:1', url: 'http://x', retrieved_date: '2026-06-21', quote: 'q' },
        last_reviewed: '2026-06-21',
      },
    ]
    expect(() => validateKb(bad)).toThrow(/drug_ingredient/)
  })

  it('verified 누락 엔트리를 거부한다', () => {
    const bad = [
      {
        id: 'x-005', drug_class: 'a', drug_ingredient: ['x'], supplement: 's',
        severity: 'low', action_type: 'monitor', mechanism: 'm', recommendation: 'r',
        evidence_level: '약', source: { db: 'PMC', id: 'PMID:1', url: 'http://x', retrieved_date: '2026-06-21', quote: 'q' },
        last_reviewed: '2026-06-21',
        // verified 누락
      },
    ]
    expect(() => validateKb(bad)).toThrow(/verified/)
  })

  it('verified가 boolean이 아니면 거부한다', () => {
    const bad = [
      {
        id: 'x-006', drug_class: 'a', drug_ingredient: ['x'], supplement: 's',
        severity: 'low', action_type: 'monitor', mechanism: 'm', recommendation: 'r',
        evidence_level: '약', source: { db: 'PMC', id: 'PMID:1', url: 'http://x', retrieved_date: '2026-06-21', quote: 'q' },
        last_reviewed: '2026-06-21',
        verified: 'true', // 문자열 — boolean 아님
      },
    ]
    expect(() => validateKb(bad)).toThrow(/verified/)
  })
})
