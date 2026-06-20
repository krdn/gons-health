import { useMemo, useState } from 'react'
import { validateKb } from '../lib/validateKb'
import { lookup } from '../lib/lookup'
import { DRUG_CLASSES, SUPPLEMENTS } from '../data/vocabulary'
import { ResultCard } from './ResultCard'
import type { LookupResult } from '../types'
import rawKb from '../data/interactions.json'

export function InteractionChecker() {
  // KB는 앱 로드 시 1회 검증 (스키마 위반은 빌드/로드 시 즉시 드러남)
  const kb = useMemo(() => validateKb(rawKb), [])
  const [drugClass, setDrugClass] = useState('')
  const [supplement, setSupplement] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)

  const canCheck = drugClass !== '' && supplement !== ''

  function handleCheck() {
    if (!canCheck) return
    setResult(lookup(kb, drugClass, supplement))
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>건기식 상호작용 체커</h1>
      <p style={{ color: '#666', fontSize: 14 }}>
        환자 처방약 × 추천 건기식/식품의 문서화된 상호작용을 확인합니다. 이 도구는{' '}
        <strong>정보 제공용</strong>이며, 최종 판단은 약사가 합니다.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
        <label>
          처방약 클래스
          <br />
          <select value={drugClass} onChange={(e) => setDrugClass(e.target.value)}>
            <option value="">— 선택 —</option>
            {DRUG_CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          추천 건기식/식품
          <br />
          <select value={supplement} onChange={(e) => setSupplement(e.target.value)}>
            <option value="">— 선택 —</option>
            {SUPPLEMENTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button onClick={handleCheck} disabled={!canCheck} style={{ alignSelf: 'flex-end' }}>
          확인
        </button>
      </div>

      {result && <ResultCard result={result} />}
    </main>
  )
}
