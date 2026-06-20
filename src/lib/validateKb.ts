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
    if (!src || !isNonEmptyString(src.url) || !isNonEmptyString(src.id))
      throw new Error(`${ctx}: source.url/id 누락 (인용 필수)`)
    if (!isNonEmptyString(entry.last_reviewed)) throw new Error(`${ctx}: last_reviewed 누락`)

    return entry as unknown as InteractionEntry
  })
}
