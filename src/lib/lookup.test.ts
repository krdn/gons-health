import { describe, it, expect } from 'vitest'
import { lookup, ABSTAIN_MESSAGE } from './lookup'
import type { InteractionEntry } from '../types'

const KB: InteractionEntry[] = [
  {
    id: 'anticoag-ginkgo-001',
    drug_class: '항응고제/항혈소판제',
    drug_ingredient: ['warfarin', 'apixaban', 'aspirin', 'clopidogrel'],
    supplement: '은행 (Ginkgo biloba)',
    severity: 'high',
    action_type: 'avoid',
    mechanism: '혈소판 응집 억제 및 항응고 효과 상가작용으로 출혈 위험 증가',
    recommendation: '병용 시 출혈 위험 증가. 환자에게 권하지 말 것.',
    evidence_level: '중',
    source: { db: 'PMC', id: 'PMID:18205318', url: 'https://pubmed.ncbi.nlm.nih.gov/18205318/', retrieved_date: '2026-06-21', quote: 'Ginkgo may increase bleeding risk.' },
    last_reviewed: '2026-06-21',
  },
  {
    id: 'thyroid-calcium-001',
    drug_class: '갑상선약',
    drug_ingredient: ['levothyroxine'],
    supplement: '칼슘',
    severity: 'medium',
    action_type: 'spacing',
    mechanism: '칼슘이 levothyroxine 흡수를 저해 (chelation)',
    recommendation: '2-4시간 간격을 두고 복용하도록 안내.',
    evidence_level: '강',
    source: { db: 'openFDA', id: 'label:levothyroxine', url: 'https://open.fda.gov/', retrieved_date: '2026-06-21', quote: 'Calcium reduces levothyroxine absorption.' },
    last_reviewed: '2026-06-21',
  },
]

describe('lookup', () => {
  it('히트 시 저장된 엔트리를 인용과 함께 반환한다', () => {
    const r = lookup(KB, '항응고제/항혈소판제', '은행 (Ginkgo biloba)')
    expect(r.kind).toBe('hit')
    if (r.kind === 'hit') {
      expect(r.entries).toHaveLength(1)
      expect(r.entries[0].severity).toBe('high')
      expect(r.entries[0].source.url).toContain('pubmed')
    }
  })

  it('미스 시 정확한 기권 상수를 반환한다 (절대 "안전함" 아님)', () => {
    const r = lookup(KB, '항응고제/항혈소판제', '비타민C')
    expect(r.kind).toBe('abstain')
    if (r.kind === 'abstain') {
      expect(r.message).toBe(ABSTAIN_MESSAGE)
      expect(r.message).not.toContain('안전함')
      expect(r.message).toContain('약사 판단 필요')
    }
  })

  it('spacing action_type 엔트리도 정확히 히트한다', () => {
    const r = lookup(KB, '갑상선약', '칼슘')
    expect(r.kind).toBe('hit')
    if (r.kind === 'hit') {
      expect(r.entries[0].action_type).toBe('spacing')
    }
  })

  it('같은 클래스×보조제에 여러 엔트리가 있으면 모두 반환한다', () => {
    const multi: InteractionEntry[] = [
      ...KB,
      { ...KB[0], id: 'anticoag-ginkgo-002', evidence_level: '약', source: { ...KB[0].source, id: 'PMID:99999' } },
    ]
    const r = lookup(multi, '항응고제/항혈소판제', '은행 (Ginkgo biloba)')
    expect(r.kind).toBe('hit')
    if (r.kind === 'hit') expect(r.entries).toHaveLength(2)
  })

  it('빈 KB에서는 항상 기권한다', () => {
    const r = lookup([], '항응고제/항혈소판제', '은행 (Ginkgo biloba)')
    expect(r.kind).toBe('abstain')
  })
})
