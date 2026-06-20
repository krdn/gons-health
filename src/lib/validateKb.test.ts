import { describe, it, expect } from 'vitest'
import { validateKb } from './validateKb'

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
})
