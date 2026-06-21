// @krdn/gons-health 패키지 public API (코어 전용 — React UI 미포함).
// 다른 프로젝트(gons-dashboard 등)는 이 배럴을 통해서만 import 한다.
//
// 안전 계약: KB는 raw interactions.json 으로 노출하지 않는다.
// validateKb 를 거친 loadKb() 만 노출해 fail-loud 검증과 verified 게이트를
// 소비자 쪽에서 우회할 수 없게 한다. (resolveJsonModule 설정 차이도 회피)

import rawKb from './data/interactions.json'
import { validateKb } from './lib/validateKb'
import type { InteractionEntry } from './types'

// 순수 lookup 엔진 + cite-or-abstain 상수
export { lookup, ABSTAIN_MESSAGE } from './lib/lookup'

// KB 스키마 검증기 (fail-loud)
export { validateKb } from './lib/validateKb'

// closed-set 통제 어휘 (드롭다운 단일 출처)
export { DRUG_CLASSES, SUPPLEMENTS } from './data/vocabulary'

// 공개 타입
export type {
  InteractionEntry,
  Source,
  Severity,
  ActionType,
  EvidenceLevel,
  LookupResult,
  HitResult,
  AbstainResult,
} from './types'

/**
 * 검증된 KB를 반환한다. 번들된 interactions.json 을 validateKb 로 통과시킨 결과만 노출.
 * 스키마 위반 시 즉시 throw (fail-loud). 소비자가 raw JSON 을 직접 import 하지 못하게 하는
 * 단일 진입점 — verified 게이트와 인용 강제를 보존한다.
 */
export function loadKb(): InteractionEntry[] {
  return validateKb(rawKb)
}
