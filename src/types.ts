export type Severity = 'high' | 'medium' | 'low'
export type ActionType = 'avoid' | 'monitor' | 'spacing'
export type EvidenceLevel = '강' | '중' | '약'

export interface Source {
  db: string // 예: "PMC", "openFDA", "식약처"
  id: string // 예: "PMID:18205318"
  url: string
  retrieved_date: string // YYYY-MM-DD
  quote: string // 인용된 원문 한 줄
}

export interface InteractionEntry {
  id: string
  drug_class: string // lookup 키
  drug_ingredient: string[] // 표시용 성분 목록
  supplement: string // lookup 키
  severity: Severity
  action_type: ActionType
  mechanism: string // 한국어 기전 설명
  recommendation: string // 한국어 약사 행동 권고
  evidence_level: EvidenceLevel
  source: Source
  last_reviewed: string // YYYY-MM-DD
}

// 미스 시 출력 (cite-or-abstain 상수)
export interface AbstainResult {
  kind: 'abstain'
  message: string
}

export interface HitResult {
  kind: 'hit'
  entries: InteractionEntry[]
}

export type LookupResult = HitResult | AbstainResult
