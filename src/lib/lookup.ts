import type { InteractionEntry, LookupResult } from '../types'

// cite-or-abstain 상수 — 미스 시 정확히 이 문구. 절대 생성하지 않음, 절대 "안전함" 아님.
export const ABSTAIN_MESSAGE =
  '검색한 자료 내 문서화된 상호작용 없음 — 안전하다는 의미가 아닙니다. 약사 판단 필요.' as const

/**
 * 결정론적 closed-set lookup. drug_class × supplement 정확 일치.
 * 히트 → 저장된 인용 엔트리 반환. 미스 → 기권 상수.
 * 순수 함수. 런타임 LLM/외부 API 없음.
 */
export function lookup(
  kb: InteractionEntry[],
  drugClass: string,
  supplement: string,
): LookupResult {
  const entries = kb.filter(
    (e) => e.drug_class === drugClass && e.supplement === supplement,
  )
  if (entries.length === 0) {
    return { kind: 'abstain', message: ABSTAIN_MESSAGE }
  }
  return { kind: 'hit', entries }
}
