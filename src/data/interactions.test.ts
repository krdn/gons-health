import { describe, it, expect } from 'vitest'
import { validateKb } from '../lib/validateKb'
import { lookup } from '../lib/lookup'
import { DRUG_CLASSES, SUPPLEMENTS } from './vocabulary'
import kb from './interactions.json'

describe('앵커 KB', () => {
  it('전체 KB가 스키마 검증을 통과한다 (전 엔트리 evidence_level + 인용)', () => {
    expect(() => validateKb(kb)).not.toThrow()
  })

  it('앵커 클러스터(항응고제×은행)가 존재하고 히트한다', () => {
    const valid = validateKb(kb)
    const r = lookup(valid, '항응고제/항혈소판제', '은행 (Ginkgo biloba)')
    expect(r.kind).toBe('hit')
  })

  it('KB의 모든 drug_class가 통제 어휘에 존재한다', () => {
    const valid = validateKb(kb)
    for (const e of valid) {
      expect(DRUG_CLASSES).toContain(e.drug_class)
    }
  })

  it('KB의 모든 supplement가 통제 어휘에 존재한다', () => {
    const valid = validateKb(kb)
    for (const e of valid) {
      expect(SUPPLEMENTS).toContain(e.supplement)
    }
  })

  it('KB 엔트리 id가 중복 없이 고유하다', () => {
    const valid = validateKb(kb)
    const ids = valid.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
