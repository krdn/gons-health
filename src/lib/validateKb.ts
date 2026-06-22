import type { InteractionEntry, Severity, ActionType, EvidenceLevel } from '../types'

const SEVERITIES: Severity[] = ['high', 'medium', 'low']
const ACTIONS: ActionType[] = ['avoid', 'monitor', 'spacing']
const EVIDENCE: EvidenceLevel[] = ['강', '중', '약']

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

export function validateKb(entries: unknown): InteractionEntry[] {
  if (!Array.isArray(entries)) {
    throw new Error('KB는 배열이어야 합니다')
  }
  return entries.map((e, i) => {
    const ctx = `엔트리 #${i}`
    if (typeof e !== 'object' || e === null) throw new Error(`${ctx}: 객체가 아님`)
    const entry = e as Record<string, unknown>

    if (!isNonEmptyString(entry.id)) throw new Error(`${ctx}: id 누락`)
    if (!isNonEmptyString(entry.drug_class)) throw new Error(`${ctx}: drug_class 누락`)
    if (
      !Array.isArray(entry.drug_ingredient) ||
      entry.drug_ingredient.length === 0 ||
      !entry.drug_ingredient.every(isNonEmptyString)
    )
      throw new Error(`${ctx}: drug_ingredient 누락 또는 비문자열 요소`)
    if (!isNonEmptyString(entry.supplement)) throw new Error(`${ctx}: supplement 누락`)
    if (!SEVERITIES.includes(entry.severity as Severity)) throw new Error(`${ctx}: severity 부적합`)
    if (!ACTIONS.includes(entry.action_type as ActionType)) throw new Error(`${ctx}: action_type 부적합`)
    if (!isNonEmptyString(entry.mechanism)) throw new Error(`${ctx}: mechanism 누락`)
    if (!isNonEmptyString(entry.recommendation)) throw new Error(`${ctx}: recommendation 누락`)
    // 근거 강도 라벨은 전 엔트리 강제 (Global Constraint)
    if (!EVIDENCE.includes(entry.evidence_level as EvidenceLevel))
      throw new Error(`${ctx}: evidence_level 누락 또는 부적합 (강/중/약 필수)`)
    // cite-or-abstain: 인용 출처 강제
    const src = entry.source as Record<string, unknown> | undefined
    if (
      !src ||
      !isNonEmptyString(src.url) ||
      !isNonEmptyString(src.id) ||
      !isNonEmptyString(src.db) ||
      !isNonEmptyString(src.quote) ||
      !isNonEmptyString(src.retrieved_date)
    )
      throw new Error(`${ctx}: source 필드 누락 (url/id/db/quote/retrieved_date 필수)`)
    if (!isNonEmptyString(entry.last_reviewed)) throw new Error(`${ctx}: last_reviewed 누락`)
    // verified는 boolean 필수 — 누락 시 명시적 에러로 드러냄
    if (typeof entry.verified !== 'boolean')
      throw new Error(`${ctx}: verified 누락 또는 boolean 아님`)
    // auto_verified는 옵셔널 — 있으면 boolean 강제
    if (entry.auto_verified !== undefined && typeof entry.auto_verified !== 'boolean')
      throw new Error(`${ctx}: auto_verified는 boolean이어야 함`)
    // auto_review는 옵셔널 — 있으면 status 조건부 검증
    if (entry.auto_review !== undefined) {
      const ar = entry.auto_review as Record<string, unknown>
      if (ar.status !== 'pass' && ar.status !== 'fail')
        throw new Error(`${ctx}: auto_review.status는 pass|fail`)
      // 공통 필드
      if (
        typeof ar.direction_match !== 'boolean' ||
        typeof ar.reason !== 'string' ||
        typeof ar.pmid !== 'string' ||
        typeof ar.evidence_sentence !== 'string' ||
        !isNonEmptyString(ar.reviewed_date)
      )
        throw new Error(`${ctx}: auto_review 필드 누락/부적합`)
      // status별 강제: pass는 실제 근거 필수(안전 불변식), fail은 사유 필수
      if (ar.status === 'pass') {
        if (!isNonEmptyString(ar.pmid) || !isNonEmptyString(ar.evidence_sentence))
          throw new Error(`${ctx}: pass 판정은 pmid·evidence_sentence 필수 (근거 없는 통과 금지)`)
      } else {
        if (!isNonEmptyString(ar.reason))
          throw new Error(`${ctx}: fail 판정은 reason 필수`)
      }
    }

    return entry as unknown as InteractionEntry
  })
}
